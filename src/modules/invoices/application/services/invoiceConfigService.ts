/**
 * Configuración de Facturación Electrónica (TA-60, HU-09).
 *
 * Qué expone y qué NO expone, porque la distinción es de seguridad:
 *
 *  - SE EXPONE el entorno (MOCK/BETA/PRODUCCION), si hay usuario SOL
 *    configurado y la vigencia del certificado X.509. Son datos que el
 *    administrador necesita ver para saber si el sistema puede emitir.
 *  - NO SE EXPONE la clave SOL ni el certificado en Base64. Se publica
 *    únicamente si están presentes y hasta cuándo valen. Devolver la clave en
 *    un GET la deja en el historial del navegador, en los logs del proxy y en
 *    cualquier captura de pantalla de la demo.
 *
 * El endpoint es de LECTURA de estado, no un formulario de escritura: los
 * secretos viven en las variables de entorno del despliegue (Render), no en la
 * base de datos. Guardarlos en una tabla los pondría al alcance de cualquier
 * volcado de respaldo, y rotarlas exigiría una migración.
 *
 * Lo que SÍ se persiste es lo que cambia por empresa y no es secreto: las
 * series (`InvoiceSeries`), que son las que gobiernan el correlativo.
 */
import { Injectable, Logger } from '@nestjs/common';
import {
  CertificateService,
  type ValidatedCertificate,
} from '../../../sunat/certificate.service';
import { InvoiceSeriesService, type SerieFiscal } from './invoiceSeriesService';

/** Entornos de SUNAT reconocidos. */
export type EntornoFiscal = 'MOCK' | 'BETA' | 'PRODUCCION';

/** Estado de un punto de configuración. */
export interface EstadoConfiguracion {
  clave: string;
  descripcion: string;
  configurado: boolean;
  /** true si su ausencia impide emitir; false si solo degrada. */
  obligatorio: boolean;
  detalle?: string;
}

/** Respuesta de GET /api/v1/invoices/config. */
export interface ConfiguracionFiscal {
  entorno: EntornoFiscal;
  endpoint_bill_service: string;
  endpoint_consult_service: string;
  checklist: EstadoConfiguracion[];
  /** true solo si todos los puntos obligatorios están configurados. */
  listo_para_emitir: boolean;
  series: SerieFiscal[];
}

@Injectable()
export class InvoiceConfigService {
  private readonly logger = new Logger(InvoiceConfigService.name);

  constructor(
    private readonly series: InvoiceSeriesService,
    private readonly certificado: CertificateService,
  ) {}

  /**
   * Estado actual de la configuración de la empresa.
   *
   * `companyId` filtra las series: una empresa nunca ve las series de otra
   * (Anti-IDOR), aunque esta ruta no acepte el id por query.
   */
  async obtener(companyId: string): Promise<ConfiguracionFiscal> {
    const entorno = this.entorno();
    const listado = await this.series.listar(companyId);

    const checklist: EstadoConfiguracion[] = [
      this.chequeoEntorno(entorno),
      this.chequeoUsuarioSol(),
      this.chequeoCertificado(),
      this.chequeoSeries(listado),
    ];

    return {
      entorno,
      endpoint_bill_service: this.endpoint('SUNAT_BILL_SERVICE_URL', '/billService'),
      endpoint_consult_service: this.endpoint(
        'SUNAT_CONSULT_SERVICE_URL',
        '/billConsultService',
      ),
      checklist,
      listo_para_emitir: checklist
        .filter((punto) => punto.obligatorio)
        .every((punto) => punto.configurado),
      series: listado,
    };
  }

  /** Entorno declarado; MOCK por defecto para no apuntar a producción por error. */
  private entorno(): EntornoFiscal {
    const valor = (process.env.SUNAT_ENV ?? '').trim().toUpperCase();
    if (valor === 'PRODUCCION' || valor === 'PRODUCTION') return 'PRODUCCION';
    if (valor === 'BETA') return 'BETA';
    return 'MOCK';
  }

  /** Endpoint efectivo, sin secretos: la URL es pública. */
  private endpoint(variable: string, sufijo: string): string {
    const explicito = process.env[variable];
    if (explicito) return explicito;

    const base = process.env.SUNAT_BILL_SERVICE_URL;
    if (base) return base.replace(/\/billService$/, sufijo);

    return `(sin configurar: variable ${variable})`;
  }

  private chequeoEntorno(entorno: EntornoFiscal): EstadoConfiguracion {
    return {
      clave: 'entorno',
      descripcion: 'Entorno de SUNAT al que se envía',
      configurado: entorno !== 'MOCK',
      obligatorio: false,
      detalle:
        entorno === 'MOCK'
          ? 'Modo simulado: los envíos no salen a SUNAT'
          : `Envíos reales a ${entorno}`,
    };
  }

  /** Usuario SOL: se informa su presencia, NUNCA su valor ni el de la clave. */
  private chequeoUsuarioSol(): EstadoConfiguracion {
    const usuario = (process.env.SUNAT_SOL_USER ?? '').trim();
    const clave = (process.env.SUNAT_SOL_PASSWORD ?? '').trim();

    return {
      clave: 'usuario_sol',
      descripcion: 'Credenciales SOL del emisor',
      configurado: Boolean(usuario && clave),
      obligatorio: true,
      // Solo longitudes y presencia: jamás el contenido.
      detalle: !usuario
        ? 'Falta SUNAT_SOL_USER'
        : !clave
          ? 'Falta SUNAT_SOL_PASSWORD'
          : `Usuario de ${usuario.length} caracteres configurado`,
    };
  }

  /**
   * Certificado X.509: lo único que se publica es su vigencia.
   *
   * La fecha importa más que el propio certificado: uno vencido produce
   * rechazos de SUNAT en TODOS los envíos y el mensaje que devuelve no dice
   * "vencido". Mostrarlo aquí evita descubrirlo con la factura del cliente.
   *
   * `getCertificate()` lanza `BadRequestException` cuando falta una variable o
   * cuando el certificado no es vigente; ese mismo error se convierte aquí en
   * el motivo legible del punto del checklist.
   */
  private chequeoCertificado(): EstadoConfiguracion {
    const base = {
      clave: 'certificado_x509',
      descripcion: 'Certificado digital para firmar el XML',
      obligatorio: true,
    };

    let leido: ValidatedCertificate;
    try {
      leido = this.certificado.getCertificate();
    } catch (error) {
      const mensaje = error instanceof Error ? error.message : String(error);
      this.logger.warn(`[TA-60] Certificado no utilizable: ${mensaje}`);
      return { ...base, configurado: false, detalle: mensaje };
    }

    const vence = leido.validTo.toISOString().slice(0, 10);
    const aviso =
      leido.daysRemaining <= 30
        ? ` (¡vence en ${leido.daysRemaining} días!)`
        : ` (${leido.daysRemaining} días restantes)`;

    return {
      ...base,
      configurado: true,
      detalle: `Vigente hasta ${vence}${aviso}`,
    };
  }

  /** Sin al menos una serie activa no hay número que asignar. */
  private chequeoSeries(listado: SerieFiscal[]): EstadoConfiguracion {
    const activas = listado.filter((serie) => serie.is_active);

    return {
      clave: 'series',
      descripcion: 'Series con correlativo propio',
      configurado: activas.length > 0,
      obligatorio: true,
      detalle:
        activas.length === 0
          ? 'No hay ninguna serie activa: registre F001 (facturas) y B001 (boletas)'
          : `${activas.length} serie(s) activa(s): ` +
            activas
              .map((serie) => `${serie.document_type}-${serie.series}`)
              .join(', '),
    };
  }
}
