import { clasificarPreparacion, registrarEtapa, type EtapaPreparacion } from './application/services/preparationFailure';
import { descripcionCanonicaNota } from './application/services/noteDescription';
import { InvoiceForcedResendService } from './application/services/invoiceForcedResendService';
import { claimIndividualSummaryChannel } from './application/services/summaryIndividualClaim';
import {
  IssuerConfigResolver,
  type IssuerContext,
} from '../sunat/issuerConfigResolver';
/**
 * TA-28 - Consumidor de la cola de facturas y recarga del job.
 *
 * El defecto que corrige este archivo: `queue.enqueueInvoiceInTx` publicaba en
 * `sunat-invoice-queue` pero nadie escuchaba esa cola. El comprobante entraba a
 * pg-boss y se quedaba ahi para siempre: no llegaba a SUNAT ni obtenia CDR.
 *
 * Responsabilidades:
 *  1. Registrar `boss.work` sobre la cola de facturas (criterio 1).
 *  2. Traducir el payload minimo del job (`{ invoice_id }`) a los datos
 *     completos que necesita el envio: XML del payload_ubl, firma XMLDSig,
 *     ZIP y credenciales SOL.
 *  3. Aplicar la compuerta XSL oficial de TA-31 ANTES de tocar la red (TA-58).
 *  4. Delegar el envio en `InvoiceRetryService.processWithRetry`, que es quien
 *     aplica el backoff de 5/15/45 s (HU-04) y el Circuit Breaker (TA-33).
 *
 * Lo que este archivo NO hace, a proposito: backoff, conteo de intentos y
 * movimiento a la DLQ. Eso ya vive en `InvoiceRetryService` y duplicarlo haria
 * que cada job se reintente dos veces. Lo dice el propio spec del modulo:
 *
 *   "`InvoiceRetryService` es el unico punto que mueve jobs a la DLQ y marca la
 *    Invoice en `ERROR_RED`; el worker de facturacion no debe reimplementar esa
 *   secuencia."  (specs/m2_resilience.spec.md, TA-57)
 */
import { Injectable, Logger, OnModuleInit, Optional } from '@nestjs/common';
import { createHash } from 'node:crypto';
import AdmZip from 'adm-zip';
import { PrismaService } from '../../database/prismaService';
import { InvoiceStatus } from '../../generated/client/enums';
import { InvoiceAccountingFallbackService } from './application/services/invoiceAccountingFallbackService';
import {
  InvoiceRetryService,
  RetryInvoiceResult,
} from '../resilience/infrastructure/queue/invoiceRetryService';
import { QueueService } from '../resilience/infrastructure/queue/queue.service';
import { CdrPersistenceService } from '../sunat/cdr-persistence.service';
import { SignatureService } from '../sunat/signature.service';
import { buildZipFileName } from '../sunat/soap/soap.constants';
import type {
  ProcessCdrResult,
  SendInvoiceParams,
} from '../sunat/soap/sunatBillTypes';
import {
  AVISO_DEMO,
  ErrorValidacionBloqueada,
  decidirEnvio,
} from './application/services/invoiceSendGate';
import { SunatXslValidatorService } from './application/services/sunatXslValidatorService';
import type { InvoicePayload } from './invoicePayload';
import { UblGeneratorService } from './ublGeneratorService';
import { XsdValidatorService } from './xsdValidatorService';
import { InvoiceAccountingBridgeService } from './application/services/invoiceAccountingBridgeService';
import { InvoiceBridgeCoordinatorService } from './application/services/invoiceBridgeCoordinatorService';
import { SignedXmlStorageService } from './application/services/signedXmlStorageService';

const ESTADOS_FINALES: InvoiceStatus[] = [InvoiceStatus.ACEPTADO, InvoiceStatus.OBSERVADO,
  InvoiceStatus.RECHAZADO, InvoiceStatus.ANULADO];

class ComprobanteFinalizado extends Error {}

/** Payload que viaja en la cola: solo identifica el comprobante. */
export interface InvoiceJobPayload {
  invoice_id: string;
}

/** Fila minima de Invoice que necesita el consumidor. */
interface InvoiceRow {
  company_id: string;
  id: string;
  ruc_emisor: string;
  tipo_comprobante: string;
  serie: string;
  correlativo: number;
  estado: InvoiceStatus;
  payload_ubl: unknown;
  xml_storage_url: string | null;
}

/** Comprobante ya firmado y empaquetado, listo para `sendBill`. */
export interface JobAprobado {
  params: SendInvoiceParams;
  firmado: boolean;
  /**
   * TA-58: lo que decidio la compuerta XSL antes de tocar la red.
   *  - `null`: el XML paso la validacion y se puede enviar.
   *  - `ProcessCdrResult`: el XML esta mal emitido; el comprobante queda en el
   *    estado de ese resultado y NO se llama a SUNAT.
   */
  bloqueoXsl: ProcessCdrResult | null;
  /**
   * true si la compuerta se omitio por `BYPASS_XSL_GATE_DEMO=true`.
   *
   * Se propaga hasta aqui, y no solo hasta el log, para que quien inspeccione
   * el resultado de `preparar()` pueda saber si ese comprobante se envio sin
   * validar. En una exposicion eso es justo lo que hay que poder demostrar.
   */
  omitidaPorDemo: boolean;
}

@Injectable()
export class InvoiceJobConsumer implements OnModuleInit {
  private readonly logger = new Logger(InvoiceJobConsumer.name);

  constructor(
    private readonly queue: QueueService,
    private readonly retry: InvoiceRetryService,
    private readonly prisma: PrismaService,
    private readonly ublGenerator: UblGeneratorService,
    private readonly xsdValidator: XsdValidatorService,
    private readonly signature: SignatureService,
    // TA-58: las dos piezas que faltaban para cerrar la compuerta XSL.
    // `SunatXslValidatorService` ejecuta la hoja oficial de TA-31 y
    // `CdrPersistenceService` deja el rechazo en el historial, igual que un
    // rechazo de SUNAT.
    private readonly xslValidator: SunatXslValidatorService,
    private readonly cdrPersistence: CdrPersistenceService,
    // TA-68: puente facturacion -> Kardex + Contabilidad, solo tras ACEPTADO
    // u OBSERVADO. Es el dueño del asiento de venta.
    private readonly puenteContable: InvoiceAccountingBridgeService,
    /**
     * Guarda el XML firmado que se envía.
     *
     * Sin esto la descarga regeneraba el documento desde el payload y entregaba
     * un XML sin `<ds:Signature>`: el archivo se llamaba como el comprobante
     * pero no era el que viajó a SUNAT.
     */
    private readonly xmlFirmado: SignedXmlStorageService,
    /**
     * Asiento de venta de contabilidad (P0 de Oliver).
     *
     * Convive con el puente porque son idempotentes por REFERENCIAS DISTINTAS:
     * el puente busca por el número del comprobante (`F001-00000053`) y este
     * caso de uso por el UUID. Si se llamaran los dos sin más, la misma venta
     * quedaría asentada dos veces. Por eso solo actúa cuando el puente no dejó
     * asiento —ver `registrarEnContabilidad`—, y queda como respaldo.
     */
    @Optional()
    accounting?: InvoiceAccountingFallbackService,
    @Optional() private readonly issuerConfig?: IssuerConfigResolver,
    private readonly bridgeCoordinator: InvoiceBridgeCoordinatorService = new InvoiceBridgeCoordinatorService(prisma, puenteContable, accounting),
    @Optional() private readonly forcedResend?: InvoiceForcedResendService,
  ) {}

  async onModuleInit(): Promise<void> {
    // Un doble de QueueService en las pruebas e2e puede no exponer el metodo:
    // en ese caso no hay cola que consumir y el arranque no debe fallar.
    if (typeof this.queue.registerInvoiceWorker !== 'function') {
      this.logger.warn(
        'QueueService sin registerInvoiceWorker: el consumidor de comprobantes no se registra',
      );
      return;
    }

    await this.queue.registerInvoiceWorker((job) => this.procesar(job));
    this.logger.log('Consumidor de comprobantes registrado');
  }

  /**
   * El orquestador conserva los intentos SOAP. Preparación, infraestructura,
   * circuito abierto y efectos contables pendientes se relanzan a pg-boss,
   * cuya política durable reprograma el trabajo o lo conserva en DLQ.
   */
  async procesar(job: InvoiceJobPayload): Promise<RetryInvoiceResult | null> {
    const invoiceId = job?.invoice_id;
    if (!invoiceId) {
      this.logger.error('Job sin invoice_id: se descarta');
      return null;
    }

    if (!await claimIndividualSummaryChannel(this.prisma, invoiceId)) return null;
    let aprobado: JobAprobado;
    try {
      aprobado = await this.preparar(invoiceId);
    } catch (error) {
      // Una reentrega de la cola es un no-op, nunca un fallo de preparación.
      if (error instanceof ComprobanteFinalizado) {
        const final = await this.prisma.invoice.findUnique({ where: { id: invoiceId }, select: { estado: true } });
        if (final && [InvoiceStatus.ACEPTADO, InvoiceStatus.OBSERVADO].includes(final.estado as 'ACEPTADO' | 'OBSERVADO')) await this.registrarEnContabilidad(invoiceId, final.estado);
        return null;
      }
      const causa = clasificarPreparacion(error);
      this.logger.error(`[TA-28] ${invoiceId}: ${causa.codigo} (${causa.etapa})`);
      // El historial existente conserva JSON estructurado sin migrar el esquema.
      // La persistencia es atómica y protege estados finales concurrentes.
      await this.cdrPersistence.persistFailure({ invoiceId, estadoNuevo: InvoiceStatus.ERROR_RED,
        estadoAnterior: null, intento: 1, codigoError: causa.codigo,
        mensajeError: JSON.stringify(causa), tiempoRespuestaMs: null });
      if (error instanceof ErrorValidacionBloqueada) return this.bloqueoDeInfraestructura(invoiceId, error);
      throw new Error('M1_PREPARATION_PENDING');
    }

    // TA-58, criterio 1: si la compuerta XSL marco defectos en el comprobante,
    // el objeto ya quedo ENVIADO/RECHAZADO en la base de datos y NO se abre
    // socket SOAP. Antes de este corte, `processWithRetry` se llamaba igual y
    // el XML invalido gastaba los 3 intentos del backoff hasta la DLQ.
    if (aprobado.bloqueoXsl) {
      this.logger.error(
        `[TA-58] ${invoiceId} bloqueado antes de enviar por la validacion XSL: ${aprobado.bloqueoXsl.error ?? 'sin detalle'}`,
      );
      return null;
    }

    await this.forcedResend?.consumir(invoiceId);
    const resultado = await this.retry.processWithRetry(aprobado.params);
    if (resultado?.circuitoAbierto) throw new Error('M1_CIRCUIT_OPEN_RETRY');

    // TA-68: si SUNAT aceptó u observó el comprobante, cabe mover el stock y
    // asentar la venta. Con un rechazo o un error de red NO: el documento fiscal
    // todavía no es válido y contabilizarlo dejaría asientos de facturas que
    // nunca existieron.
    if (
      resultado &&
      (resultado.estado === InvoiceStatus.ACEPTADO ||
        resultado.estado === InvoiceStatus.OBSERVADO)
    ) {
      await this.registrarEnContabilidad(invoiceId, resultado.estado);
    }

    return resultado;
  }

  /**
   * Ejecuta el puente facturación → Kardex + Contabilidad (TA-68).
   *
   * Propaga el fallo contable sin invalidar la aceptación fiscal: la reentrega
   * completa el efecto pendiente y nunca vuelve a enviar el comprobante.
   */
  private async registrarEnContabilidad(
    invoiceId: string,
    estado: InvoiceStatus,
  ): Promise<void> {
    try {
      await this.bridgeCoordinator.registrarComoTrabajo(invoiceId, estado);
    } catch (error) {
      const motivo = error instanceof Error ? error.message : 'M1_ACCOUNTING_PENDING';
      this.logger.warn(`[TA-68] ${invoiceId}: ${motivo}`);
      this.logger.warn(`[CONTABILIDAD] ${invoiceId}: asiento automático omitido; trabajo pendiente recuperable.`);
      throw error;
    }
  }

  /** Adaptador puro; la liquidación vive únicamente en el coordinador. */
  private liquidarParaPuente(items: Parameters<InvoiceBridgeCoordinatorService['liquidarParaPuente']>[0], payload: InvoicePayload) {
    return this.bridgeCoordinator.liquidarParaPuente(items, payload);
  }

  /**
   * TA-58, criterio 2: el comprobante no se puede validar (falta la hoja XSL
   * oficial o su ejecucion fallo).
   *
   * Es un problema de INFRAESTRUCTURA, no del comprobante, asi que:
   *  - no se marca RECHAZADO: el XML puede estar perfecto;
   *  - no consume intentos SOAP; pg-boss reprograma y conserva su DLQ;
   *  - el error se relanza para que pg-boss vuelva a entregar el job cuando
   *    la hoja exista. Devolver `null` dejaria el comprobante trabado en
   *    EN_COLA para siempre.
   *
   * `reintentableSinConsumirIntento` documenta justo esa intencion.
   */
  private bloqueoDeInfraestructura(
    invoiceId: string,
    error: ErrorValidacionBloqueada,
  ): never {
    this.logger.error(
      `[TA-58] ${invoiceId} no se puede validar (${error.motivo}): el job se reprograma sin consumir intento SOAP`,
    );
    throw error;
  }

  /** Traduce `{ invoice_id }` a los datos completos del envio. */
  async preparar(invoiceId: string): Promise<JobAprobado> {
    let etapa: EtapaPreparacion = 'CARGA';
    try {
      const invoice = await this.cargar(invoiceId);
      etapa = 'DESCRIPCION_NOTA';
      await this.completarDescripcionNota(invoice);
      etapa = 'GENERACION_UBL';
      const xmlSinFirma = this.xmlDelComprobante(invoice);
      etapa = 'CONFIGURACION_EMISOR';
      const context = await this.issuerConfig?.resolve(invoice.company_id);
      etapa = 'FIRMA';
      const xml = this.firmar(invoice, xmlSinFirma, context);
      etapa = 'ZIP';
      const zip = this.comprimir(invoice, xml);

      // SE GUARDA EL XML FIRMADO, el que se envía.
      //
      // Antes no se guardaba y la descarga regeneraba el documento desde el
      // payload, entregando un XML SIN `<ds:Signature>`: un archivo con el nombre
      // del comprobante que no era el que viajó a SUNAT. Se detectó abriendo el
      // XML descargado el 31-10.
      //
      // Va antes de la compuerta XSL para que la copia exista incluso si el envío
      // se bloquea: el documento firmado ya es un hecho y hay que poder auditarlo.
      etapa = 'PERSISTENCIA_XML';
      const hashGuardado = await this.xmlFirmado.guardar(invoiceId, xml);
      if (!hashGuardado) throw new ErrorValidacionBloqueada('No se pudo persistir el XML firmado', 'XML_NO_PERSISTIDO');
      if (hashGuardado) {
        this.logger.log(
          `XML firmado de ${invoice.serie}-${invoice.correlativo} guardado (sha256 ${hashGuardado.slice(0, 16)}…)`,
        );
      }

      const params: SendInvoiceParams = {
        companyId: invoice.company_id,
        context,
        invoiceId: invoice.id,
        rucEmisor: invoice.ruc_emisor,
        tipoComprobante: invoice.tipo_comprobante,
        serie: invoice.serie,
        correlativo: invoice.correlativo,
        zip,
        estadoActual: invoice.estado,
      };

      // TA-58: la compuerta va DESPUES de firmar, porque la hoja oficial valida
      // el XML tal como se envia (el `ds:DigestValue` forma parte del
      // documento). Puede lanzar `ErrorValidacionBloqueada`, que se captura en
      // `procesar()`.
      //
      // TA-58/DEUDA: `decidirEnvio` es el mismo camino, pero ademas informa si la
      // compuerta se omitio por la bandera de demostracion. Cuando eso pasa el
      // aviso sale por consola con nivel WARN para que se vea en la terminal
      // durante la exposicion y no solo en el historial.
      etapa = 'VALIDACION_LOCAL';
      const decision = await decidirEnvio(
        params,
        xml,
        this.xslValidator,
        this.cdrPersistence,
      );
      if (decision.noConcluyente) {
        // Incluye XML ya firmado en intentos anteriores: esa ruta antes no se
        // volvía a comprobar. El servicio actual aplica estructura y negocio;
        // no ejecuta los esquemas XSD oficiales completos.
        const comprobacion = this.xsdValidator.validateInvoiceUbl21(xml);
        if (!comprobacion.isValid) {
          throw new Error(
            `XML invalido contra comprobaciones UBL: ${(comprobacion.errors ?? []).join(' | ')}`,
          );
        }
        await this.cdrPersistence.persistFailure({
          invoiceId: invoice.id,
          estadoNuevo: invoice.estado,
          estadoAnterior: invoice.estado,
          intento: params.intento ?? 1,
          codigoError: null,
          mensajeError:
            'Validación XSL no concluyente: falta commons/error/validate_utils.xsl; el despacho se apoya en comprobaciones estructurales UBL y reglas internas, no en una validación XSD oficial completa.',
          tiempoRespuestaMs: null,
        });
      }
      if (decision.omitidaPorDemo) {
        this.logger.warn(`[WARN][DEMO] ${invoiceId}: ${AVISO_DEMO}`);
      }

      return {
        // Un XML que ya traia la firma tampoco se vuelve a firmar: cuenta como
        // firmado porque el sobre sale con XMLDSig.
        firmado: xml.includes('<ds:Signature'),
        params,
        bloqueoXsl: decision.bloqueo,
        omitidaPorDemo: decision.omitidaPorDemo,
      };
    } catch (error) {
      registrarEtapa(error, etapa);
      throw error;
    }
  }

  /** Reparación de legado atómica y auditable antes de generar XML. */
  private async completarDescripcionNota(invoice: InvoiceRow): Promise<void> {
    const p = invoice.payload_ubl as InvoicePayload | null;
    if (!['07', '08'].includes(invoice.tipo_comprobante) || !p || p.descripcionMotivoNota?.trim()) return;
    const actualizado = await this.prisma.$transaction(async tx => {
      await tx.$executeRaw`SELECT id FROM invoices WHERE id = ${invoice.id} FOR UPDATE`;
      const actual = await tx.invoice.findUniqueOrThrow({ where: { id: invoice.id } });
      if (ESTADOS_FINALES.includes(actual.estado)) throw new ComprobanteFinalizado();
      const payload = actual.payload_ubl as unknown as InvoicePayload;
      if (payload.descripcionMotivoNota?.trim()) return payload;
      const descripcion = descripcionCanonicaNota(actual.tipo_comprobante, payload.codigoMotivoNota, payload.descripcionMotivoNota);
      const nuevo = { ...payload, descripcionMotivoNota: descripcion };
      await tx.invoice.update({ where: { id: invoice.id }, data: { payload_ubl: JSON.parse(JSON.stringify(nuevo)) } });
      await tx.transactionHistory.create({ data: { invoice_id: actual.id, company_id: actual.company_id,
        estado_anterior: actual.estado, estado_nuevo: actual.estado,
        codigo_error: 'M1_NOTE_DESCRIPTION_COMPLETED', mensaje_error: JSON.stringify({
          etapa: 'PREPARACION_LOCAL', accion: 'DESCRIPCION_CANONICA_COMPLETADA',
          codigoMotivoNota: payload.codigoMotivoNota, descripcionMotivoNota: descripcion,
        }) } });
      return nuevo;
    });
    invoice.payload_ubl = actualizado;
  }

  /** Lee el comprobante y rechaza los que ya estan en estado final. */
  private async cargar(invoiceId: string): Promise<InvoiceRow> {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id: invoiceId },
      select: {
        id: true,
        company_id: true,
        ruc_emisor: true,
        tipo_comprobante: true,
        serie: true,
        correlativo: true,
        estado: true,
        payload_ubl: true,
        xml_storage_url: true,
      },
    });

    if (!invoice) {
      throw new Error(`Comprobante ${invoiceId} no existe en la base de datos`);
    }

    if (ESTADOS_FINALES.includes(invoice.estado)) {
      throw new ComprobanteFinalizado(
        `Comprobante ${invoiceId} ya tiene estado final ${invoice.estado}: no se reenvia`,
      );
    }

    return invoice as InvoiceRow;
  }

  /**
   * Devuelve el XML del comprobante.
   *
   * Primero intenta el guardado por el worker de TA-11 en `xml_storage_url`;
   * si no existe, lo genera desde `payload_ubl` y lo valida contra el XSD.
   */
  private xmlDelComprobante(invoice: InvoiceRow): string {
    const guardado = invoice.xml_storage_url;
    if (guardado && guardado.trimStart().startsWith('<?xml')) return guardado;

    const payload = invoice.payload_ubl as InvoicePayload | null;
    if (!payload || typeof payload !== 'object') {
      throw new Error(
        `Comprobante ${invoice.id} sin payload_ubl: no se puede generar el XML`,
      );
    }

    const xml = this.ublGenerator.generateInvoiceXml(payload);
    const validacion = this.xsdValidator.validateInvoiceUbl21(xml);
    if (!validacion.isValid) {
      const detalle = (validacion.errors ?? []).join(' | ');
      throw new Error(`XML invalido contra UBL 2.1: ${detalle}`);
    }
    return xml;
  }

  /** Firma XMLDSig X.509. Sin certificado o firma verificable el despacho se bloquea. */
  private firmar(
    invoice: InvoiceRow,
    xml: string,
    context?: IssuerContext,
  ): string {
    if (xml.includes('<ds:Signature')) {
      if (!this.signature.verifySignature(xml)) throw new Error('Firma XML guardada inválida');
      return xml;
    }
    if (context ? !context.certificate : !process.env.CERT_BASE64) {
      this.logger.warn(
        `[TA-28] ${invoice.id} despacho bloqueado: CERT_BASE64 no esta configurado`,
      );
      throw new Error('Certificado no configurado: no se permite despachar XML sin firma');
    }
    const signed = this.signature.signXml(xml, context).signedXml;
    if (!this.signature.verifySignature(signed)) throw new Error('Firma XML generada inválida');
    return signed;
  }

  /** Empaqueta en el ZIP con la convencion de nombre que espera SUNAT. */
  private comprimir(invoice: InvoiceRow, xml: string): Buffer {
    const fileName = buildZipFileName({
      ruc: invoice.ruc_emisor,
      tipoComprobante: invoice.tipo_comprobante,
      serie: invoice.serie,
      correlativo: invoice.correlativo,
    });

    const zip = new AdmZip();
    zip.addFile(fileName.replace(/\.zip$/i, '.xml'), Buffer.from(xml, 'utf8'));
    return zip.toBuffer();
  }

  /**
   * Hash SHA-256 del XML: huella del contenido enviado, util para detectar
   * modificaciones posteriores. Se guarda en `xml_hash_sha256`.
   */
  hashDelXml(xml: string): string {
    return createHash('sha256').update(xml, 'utf8').digest('hex');
  }

}
