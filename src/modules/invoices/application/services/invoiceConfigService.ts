import { validaDeVerdad } from './sunatXslAdapter';
import { normalizarEntorno, resolveEndpoint, endpointCoherente } from '../../../sunat/soap/sunatBillTypes';
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

/** Resumen directo del certificado digital (.PFX / .P12) para la pantalla de Configuración. */
export interface EstadoCertificadoConfiguracion {
  archivo: string | null;
  configurado: boolean;
  estado: 'VIGENTE' | 'POR_VENCER' | 'VENCIDO' | 'AUN_NO_VIGENTE' | 'INVALIDO' | 'NO_CONFIGURADO';
  vence_el: string | null;
  dias_restantes: number | null;
  origen: 'company' | 'deployment';
}

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
  tipo_comprobante_predeterminado: '01' | '03' | null;
  entorno: EntornoFiscal | null;
  endpoint_bill_service: string | null;
  endpoint_consult_service: string | null;
  certificado: EstadoCertificadoConfiguracion;
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
    const entorno = context ? context.environment : normalizarEntorno(process.env.SUNAT_ENV);
    const billEndpoint = context?.endpoint ?? resolveEndpoint();
    const consultEndpoint = context?.consultEndpoint ?? process.env.SUNAT_CONSULT_SERVICE_URL ?? billEndpoint.replace(/\/billService$/, '/billConsultService');
    const listado = await this.series.listar(companyId);

    const { punto: puntoCertificado, resumen: resumenCertificado } =
      this.evaluarCertificado(context);
    const checklist: EstadoConfiguracion[] = [
      this.chequeoEntorno(entorno),
      { clave: 'endpoints', descripcion: 'Endpoints coherentes con el entorno', obligatorio: true,
        configurado: endpointCoherente(entorno, billEndpoint) && endpointCoherente(entorno, consultEndpoint) },
      { clave: 'validacion_oficial', descripcion: 'Validación oficial previa al envío', obligatorio: true,
        configurado: entorno === 'MOCK' || validaDeVerdad(),
        detalle: 'La validación XSL oficial requiere sus dependencias completas; sin ellas el envío externo está bloqueado' },
      this.chequeoUsuarioSol(context),
      puntoCertificado,
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
      tipo_comprobante_predeterminado: context?.commercialProfile === 'MAYORISTA' ? '01' : context?.commercialProfile === 'MINORISTA' ? '03' : null,
      entorno,
      endpoint_bill_service: this.publicEndpoint(billEndpoint),
      endpoint_consult_service: this.publicEndpoint(consultEndpoint),
      certificado: resumenCertificado,
      checklist,
      listo_para_emitir: checklist
        .filter((punto) => punto.obligatorio)
        .every((punto) => punto.configurado),
      series: listado,
    };
  }

  /** Actualización explícita de la configuración persistida. */
  async actualizar(
    companyId: string,
    body: unknown,
  ): Promise<ConfiguracionFiscal> {
    if (!this.writer) throw new Error('ISSUER_CONFIG_WRITER_UNAVAILABLE');
    await this.writer.save(companyId, body);
    return this.obtener(companyId);
  }

  private publicEndpoint(value: string): string | null {
    try {
      const url = new URL(value);
      url.username = '';
      url.password = '';
      url.search = '';
      url.hash = '';
      return url.toString();
    } catch {
      return null;
    }
  }

  private chequeoEntorno(entorno: EntornoFiscal | null): EstadoConfiguracion {
    return {
      clave: 'entorno',
      descripcion: 'Entorno de SUNAT al que se envía',
      configurado: entorno !== null,
      obligatorio: true,
      detalle:
        entorno === null ? 'Entorno sin configurar: envío bloqueado' : entorno === 'MOCK'
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
   * `inspectCertificate()` conserva fechas vencidas sin autorizar la firma.
   * Los errores de lectura se proyectan sin exponer detalles sensibles.
   */
  private evaluarCertificado(context?: IssuerContext): {
    punto: EstadoConfiguracion;
    resumen: EstadoCertificadoConfiguracion;
  } {
    const base = {
      clave: 'certificado_x509',
      descripcion: 'Certificado digital para firmar el XML',
      obligatorio: true,
    };
    const origen: 'company' | 'deployment' =
      context?.certificateSource === 'company' ? 'company' : 'deployment';

    const presente = context ? Boolean(context.certificate) : Boolean(process.env.CERT_BASE64);
    let leido: Pick<ValidatedCertificate, 'validFrom' | 'validTo' | 'daysRemaining' | 'issuerRuc'>;
    try {
      leido = this.certificado.inspectCertificate(context);
    } catch {
      const mensaje = 'Certificado no utilizable';
      this.logger.warn(`[TA-60] Certificado no utilizable: ${mensaje}`);
      return {
        punto: { ...base, configurado: false, detalle: mensaje },
        resumen: {
          archivo: null,
          configurado: false,
          estado: presente ? 'INVALIDO' : 'NO_CONFIGURADO',
          vence_el: null,
          dias_restantes: null,
          origen,
        },
      };
    }

    const vence = leido.validTo.toISOString().slice(0, 10);
    const dias = Math.ceil((leido.validTo.getTime() - Date.now()) / 86400000) || 0;
    const estado =
      leido.validFrom.getTime() > Date.now() ? 'AUN_NO_VIGENTE' : leido.validTo.getTime() < Date.now() ? 'VENCIDO' : dias <= 30 ? 'POR_VENCER' : 'VIGENTE';
    const utilizable = estado === 'VIGENTE' || estado === 'POR_VENCER';
    const aviso =
      dias <= 30
        ? ` (¡vence en ${dias} días!)`
        : ` (${dias} días restantes)`;

    return {
      punto: {
        ...base,
        configurado: utilizable,
        detalle: `${estado}: ${vence}${aviso}`,
      },
      resumen: {
        archivo: null,
        configurado: utilizable,
        estado,
        vence_el: vence,
        dias_restantes: dias,
        origen,
      },
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
          ? 'No hay ninguna serie activa: registre las series autorizadas de su empresa'
          : `${activas.length} serie(s) activa(s): ` +
            activas
              .map((serie) => `${serie.document_type}-${serie.series}`)
              .join(', '),
    };
  }
}
