import {
  IssuerConfigResolver,
  type IssuerContext,
} from '../../../sunat/issuerConfigResolver';
import { IssuerConfigWriter } from './issuerConfigWriter';
import { Injectable, Logger, Optional } from '@nestjs/common';
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
  origen_efectivo?: string;
  origen_sol?: string;
  origen_certificado?: string;
  sol_password_configurada?: boolean;
  cert_password_configurada?: boolean;
  ruc?: string;
  perfil_comercial?: 'MAYORISTA' | 'MINORISTA' | null;
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
    @Optional() private readonly resolver?: IssuerConfigResolver,
    @Optional() private readonly writer?: IssuerConfigWriter,
  ) {}

  /**
   * Estado actual de la configuración de la empresa.
   *
   * `companyId` filtra las series: una empresa nunca ve las series de otra
   * (Anti-IDOR), aunque esta ruta no acepte el id por query.
   */
  async obtener(companyId: string): Promise<ConfiguracionFiscal> {
    const context = await this.resolver?.resolve(companyId);
    const entorno = context?.environment ?? this.entorno();
    const listado = await this.series.listar(companyId);

    const checklist: EstadoConfiguracion[] = [
      this.chequeoEntorno(entorno),
      this.chequeoUsuarioSol(context),
      this.chequeoCertificado(context),
      this.chequeoSeries(listado),
    ];

    return {
      origen_efectivo: context?.source ?? 'deployment',
      origen_sol: context?.solSource ?? 'deployment',
      origen_certificado: context?.certificateSource ?? 'deployment',
      sol_password_configurada: context
        ? Boolean(context.sol)
        : Boolean(process.env.SUNAT_SOL_PASSWORD),
      cert_password_configurada: context
        ? Boolean(context.certificate)
        : Boolean(process.env.CERT_PASSWORD),
      ruc: context?.ruc,
      perfil_comercial: context?.commercialProfile ?? null,
      entorno,
      endpoint_bill_service: this.publicEndpoint(
        context?.endpoint ??
          this.endpoint('SUNAT_BILL_SERVICE_URL', '/billService'),
      ),
      endpoint_consult_service: this.publicEndpoint(
        context?.consultEndpoint ??
          this.endpoint('SUNAT_CONSULT_SERVICE_URL', '/billConsultService'),
      ),
      checklist,
      listo_para_emitir: checklist
        .filter((punto) => punto.obligatorio)
        .every((punto) => punto.configurado),
      series: listado,
    };
  }

  /** Entorno declarado; MOCK por defecto para no apuntar a producción por error. */
  async actualizar(
    companyId: string,
    body: unknown,
  ): Promise<ConfiguracionFiscal> {
    if (!this.writer) throw new Error('ISSUER_CONFIG_WRITER_UNAVAILABLE');
    await this.writer.save(companyId, body);
    return this.obtener(companyId);
  }

  private entorno(): EntornoFiscal {
    const valor = (process.env.SUNAT_ENV ?? '').trim().toUpperCase();
    if (valor === 'PRODUCCION' || valor === 'PRODUCTION') return 'PRODUCCION';
    if (valor === 'BETA') return 'BETA';
    return 'MOCK';
  }

  private publicEndpoint(value: string): string {
    try {
      const url = new URL(value);
      url.username = '';
      url.password = '';
      url.search = '';
      url.hash = '';
      return url.toString();
    } catch {
      return '(sin configurar)';
    }
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
  private chequeoUsuarioSol(context?: IssuerContext): EstadoConfiguracion {
    const usuario = context
      ? (context.sol?.username ?? '')
      : (process.env.SUNAT_SOL_USER ?? '').trim();
    const clave = context
      ? (context.sol?.password ?? '')
      : (process.env.SUNAT_SOL_PASSWORD ?? '').trim();

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
  private chequeoCertificado(context?: IssuerContext): EstadoConfiguracion {
    const base = {
      clave: 'certificado_x509',
      descripcion: 'Certificado digital para firmar el XML',
      obligatorio: true,
    };

    let leido: ValidatedCertificate;
    try {
      leido = this.certificado.getCertificate(context);
    } catch (error) {
      const mensaje = 'Certificado no utilizable';
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
