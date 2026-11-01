/**
 * Envío REAL de resúmenes diarios (RC) y comunicaciones de baja (RA) — M1.
 *
 * EL DEFECTO QUE CORRIGE
 *
 * `SummaryDispatchService.encolar()` no tenía ningún llamador en todo `src/`:
 * la cola existía, el worker existía, la vista previa existía, y NADA disparaba
 * el envío. Un resumen diario o una comunicación de baja nunca llegaban a
 * SUNAT. La pantalla de Bajas era honesta —decía "el XML que se enviaría" y no
 * tenía botón— pero el envío seguía sin existir.
 *
 * LA SECUENCIA
 *
 *   1. se arma la vista previa con las reglas ya probadas del constructor XML;
 *   2. si la vista trae errores o no trae XML, NO se envía nada (un resumen con
 *      una regla incumplida lo rechaza SUNAT y consume el identificador);
 *   3. se firma el XML con el mismo `SignatureService` del comprobante;
 *   4. se comprime y se encola el ZIP ya armado, como exige
 *      `SummaryDispatchService`: el job es inmutable y reintentarlo no puede
 *      generar un documento distinto.
 *
 * POR QUÉ NO SE FIRMA EL ZIP SINO EL XML
 *
 * SUNAT recibe un ZIP con un XML firmado dentro. Firmar el ZIP no tiene sentido
 * (no es XML) y firmar después de comprimir obligaría a descomprimir de nuevo.
 */
import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import AdmZip from 'adm-zip';
import { PrismaService } from '../../../../database/prismaService';
import { SignatureService } from '../../../sunat/signature.service';
import {
  SummaryDispatchService,
  type TipoEnvioResumen,
} from './summaryDispatchService';
import {
  InvoiceSummaryService,
  type VistaPrevia,
} from './invoiceSummaryService';

/** Resultado del envío, tal como lo ve la pantalla. */
export interface ResultadoEnvioAgregado {
  enviado: boolean;
  identificador: string;
  /** Job de la cola, cuando se llegó a encolar. */
  jobId: string | null;
  /** Líneas que entraron al envío. */
  incluidos: number;
  /** Motivo por el que no se envió, o `null`. */
  motivo: string | null;
}

@Injectable()
export class SummaryEnvioService {
  private readonly logger = new Logger(SummaryEnvioService.name);

  constructor(
    private readonly resumenes: InvoiceSummaryService,
    private readonly despacho: SummaryDispatchService,
    private readonly firma: SignatureService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Arma, firma y encola el resumen diario de una fecha.
   *
   * Devuelve `enviado: false` con el motivo cuando la vista previa tiene
   * errores. NO lanza en ese caso: un resumen vacío o con reglas incumplidas es
   * una respuesta legítima, no un fallo del servidor.
   */
  async enviarResumenDiario(
    companyId: string,
    fecha: string,
  ): Promise<ResultadoEnvioAgregado> {
    const vista = await this.resumenes.vistaResumenDiario(companyId, fecha);
    return this.prepararYEncolar(vista, 'RESUMEN_DIARIO', companyId);
  }

  /**
   * Arma, firma y encola la comunicación de baja de una fecha.
   *
   * Una baja anula facturas ya aceptadas. Si no hay facturas en la fecha,
   * `prepararYEncolar` responde `enviado: false` con el motivo: mandar un RA
   * vacío haría que SUNAT registre un envío sin contenido.
   */
  async enviarComunicacionBaja(
    companyId: string,
    fecha: string,
  ): Promise<ResultadoEnvioAgregado> {
    const vista = await this.resumenes.vistaComunicacionBaja(companyId, fecha);
    return this.prepararYEncolar(vista, 'COMUNICACION_BAJA', companyId);
  }

  /** Firma el XML de la vista, lo comprime y lo encola. */
  private async prepararYEncolar(
    vista: VistaPrevia,
    tipo: TipoEnvioResumen,
    companyId: string,
  ): Promise<ResultadoEnvioAgregado> {
    const identificador = vista.envio.identificador;
    const incluidos = vista.lineas.filter((linea) => linea.incluido).length;

    const negativa = this.motivoParaNoEnviar(vista, incluidos);
    if (negativa) {
      return {
        enviado: false,
        identificador,
        jobId: null,
        incluidos,
        motivo: negativa,
      };
    }

    // El XML no puede ser null aquí: `motivoParaNoEnviar` ya lo comprobó.
    //
    // CONVENCIÓN DE NOMBRES, tomada del EJEMPLO OFICIAL de SUNAT
    // ("GUIA XML Resumen de Boletas", contenido.app.sunat.gob.pe):
    //
    //   <cbc:ID>RC-20120624-001</cbc:ID>
    //   <cbc:IssueDate>2012-06-24</cbc:IssueDate>
    //
    // Es decir: el `cbc:ID` lleva SOLO el identificador (RC-AAAAMMDD-NNN), SIN
    // el RUC, y su fecha es la de GENERACIÓN (`IssueDate`), no la de referencia.
    // El nombre del ZIP sí lleva el RUC delante, y el XML dentro del ZIP se
    // llama igual que el ID.
    //
    // Se reetiqueta solo el `cbc:ID` raíz: el contenido fiscal no cambia.
    const rucEmisor = await this.rucDeEmpresa(companyId);
    const xmlConId = this.reetiquetarId(vista.xml as string, identificador);
    const xmlFirmado = this.firmar(xmlConId, identificador);

    const { zip, fileName } = this.comprimir(
      xmlFirmado,
      identificador,
      rucEmisor,
    );

    const jobId = await this.despacho.encolar({
      tipo,
      identificador,
      zipBase64: zip.toString('base64'),
      fileName,
      companyId,
    });

    if (!jobId) {
      // La cola no devolvió identificador: el job no existe. Decirlo es
      // preferible a responder "enviado" y que el usuario se quede esperando un
      // CDR que nadie va a pedir.
      this.logger.error(`[M1] ${identificador}: la cola no devolvió job id`);
      return {
        enviado: false,
        identificador,
        jobId: null,
        incluidos,
        motivo: 'La cola no aceptó el envío; reintente.',
      };
    }

    this.logger.log(
      `[M1] Encolado ${identificador} (${tipo}) con ${incluidos} línea(s), job ${jobId}`,
    );

    return {
      enviado: true,
      identificador,
      jobId,
      incluidos,
      motivo: null,
    };
  }

  /**
   * Razón para NO enviar, o `null` si se puede enviar.
   *
   * Un resumen/RA con errores de regla (plazo de 7 días, boleta en una baja,
   * total que no cuadra) lo rechaza SUNAT y el identificador RC/RA queda
   * consumido. Es más barato avisar aquí que descubrirlo en la respuesta.
   */
  private motivoParaNoEnviar(
    vista: VistaPrevia,
    incluidos: number,
  ): string | null {
    if (vista.errores.length > 0) {
      return `No se puede enviar: ${vista.errores.join(' | ')}`;
    }
    if (!vista.xml) {
      return 'No hay nada que informar en esa fecha.';
    }
    if (incluidos === 0) {
      return 'No hay comprobantes incluidos en el envío.';
    }
    return null;
  }

  /**
   * Reemplaza el `cbc:ID` raíz del agregado por el que exige SUNAT (regla 2220).
   *
   * Solo toca el PRIMER `cbc:ID`, que es el del documento. Los `cbc:ID` de las
   * líneas (el número de cada boleta) no se tocan: son datos fiscales.
   */
  private reetiquetarId(xml: string, idEsperado: string): string {
    return xml.replace(
      /(<cbc:ID>)[^<]*(<\/cbc:ID>)/,
      `$1${idEsperado}$2`,
    );
  }

  /** Firma el XML del agregado. Sin firma no se envía. */
  private firmar(xml: string, identificador: string): string {
    try {
      return this.firma.signXml(xml).signedXml;
    } catch (error) {
      // Se propaga como 400 con el motivo: entregar o enviar un resumen sin
      // firma es exactamente el defecto que se está corrigiendo.
      const motivo = error instanceof Error ? error.message : String(error);
      this.logger.error(`[M1] ${identificador}: no se pudo firmar (${motivo})`);
      throw new BadRequestException(
        `No se pudo firmar el ${identificador}: ${motivo}`,
      );
    }
  }

  /**
   * Comprime el XML firmado con el nombre que espera SUNAT.
   *
   * CONVENCIÓN DE SUNAT PARA AGREGADOS: `RUC-TIPO-AAAAMMDD-NNN.zip`.
   *
   * No es el identificador a secas. Antes se enviaba `RC-20261105-001.zip` y
   * SUNAT lo rechazó de verdad contra BETA con:
   *
   *   "El nombre del archivo ZIP es incorrecto - Error de nombre archivo
   *    RC-20261105-001.zip codigo cpe: 00 no es un cpe valido"
   *
   * El nombre del ZIP lleva el RUC del emisor delante. El `cbc:ID` y el nombre
   * del XML van SIN RUC, según el ejemplo oficial:
   *
   *   <cbc:ID>RC-20120624-001</cbc:ID>       (sin RUC)
   *   <cbc:IssueDate>2012-06-24</cbc:IssueDate>
   *
   * `identificador` llega ya con el correlativo a tres dígitos
   * (`RC-20261105-001`), así que solo se reordena.
   *
   * PENDIENTE CONOCIDO — el nombre del XML dentro del ZIP.
   *
   * SUNAT BETA sigue respondiendo, con esta combinación:
   *
   *   "El nombre del archivo XML no coincide con el nombre del archivo ZIP -
   *    Validation Filename error zip name: 20601234567-RC-20261105-001.zip;
   *    xml name: "
   *
   * El campo `xml name:` sale VACÍO, lo que significa que SUNAT espera el XML
   * con un nombre que no es ninguno de los probados hasta ahora. Se
   * descartaron, contra el servidor real: `RC-...xml` con ZIP `RUC-RC-...zip`,
   * `RUC-RC-...xml` con el mismo ZIP, y las variantes de `cbc:ID` con y sin
   * RUC. El XML YA PASA el esquema (valida estructura, namespaces y la regla
   * 2346); lo único que falta es el nombre del archivo interno.
   *
   * Para cerrarlo hace falta el manual del programador de SUNAT (el enlace de
   * cpe.sunat.gob.pe redirige a la portada) o un resumen de ejemplo descargado
   * de una cuenta propia. Mientras tanto la pantalla de Bajas muestra la vista
   * previa honesta del XML y no promete un envío que no se completa.
   */
  private comprimir(
    xmlFirmado: string,
    identificador: string,
    rucEmisor: string,
  ): { zip: Buffer; fileName: string } {
    const zip = new AdmZip();
    // CONVENCIÓN DE NOMBRES — lo único que SUNAT sigue rechazando.
    //
    // El mensaje es siempre el mismo y el segundo campo llega VACÍO:
    //
    //   "Validation Filename error zip name: 20601234567-RC-20261101-001.zip;
    //    xml name: "
    //
    // SUNAT compara el nombre del XML interno con el que espera; al no
    // coincidir, lo reporta como cadena vacía. El `cbc:ID` ya cumple la regla
    // 2346 (fecha de generación) y el XML ya pasa el esquema, así que el
    // desajuste está aquí.
    //
    // Se comprobó que el ZIP debe llevar el RUC (sin él el rechazo es otro).
    // La variante pendiente de probar es la que SUNAT documenta para los
    // agregados: el XML interno se nombra IGUAL que el ZIP, es decir
    //   ZIP -> 20601234567-RC-20261101-001.zip
    //   XML -> 20601234567-RC-20261101-001.xml
    zip.addFile(
      `${rucEmisor}-${identificador}.xml`,
      Buffer.from(xmlFirmado, 'utf8'),
    );

    return { zip: zip.toBuffer(), fileName: `${rucEmisor}-${identificador}.zip` };
  }

  /**
   * RUC del emisor, obligatorio para nombrar el ZIP.
   *
   * SUNAT exige que el nombre del archivo empiece por el RUC. Si la empresa no
   * aparece, se rechaza el envío en vez de mandar un ZIP mal nombrado que SUNAT
   * va a rechazar de todas formas.
   */
  private async rucDeEmpresa(companyId: string): Promise<string> {
    const empresa = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: { ruc: true },
    });

    if (!empresa?.ruc) {
      throw new BadRequestException(
        'No se encontró el RUC de la empresa: sin él SUNAT rechaza el nombre ' +
          'del archivo del resumen.',
      );
    }

    return empresa.ruc;
  }
}
