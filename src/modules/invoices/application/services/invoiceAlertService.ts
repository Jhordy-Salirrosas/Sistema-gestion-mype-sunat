/**
 * Alertas operativas del módulo de facturación (TA-69, criterio de certificado
 * y DLQ).
 *
 * POR QUÉ NO VA DENTRO DE `InvoiceMetricsService`
 *
 * Las métricas del periodo son aritmética sobre comprobantes y se prueban sin
 * base de datos (`calcularMetricas` es una función pura). Estas dos alertas son
 * otra cosa: una mira el reloj contra la vigencia de un certificado y la otra
 * interroga a pg-boss. Mezclarlas obligaría a que la prueba de las métricas
 * tuviera que simular un certificado, y a que un fallo de pg-boss tumbara el
 * resumen de ventas.
 *
 * POR QUÉ LAS ALERTAS NO TUMBAN LA RESPUESTA
 *
 * `GET /invoices/metrics` alimenta la barra de la pantalla principal. Si el
 * certificado no está configurado —el caso normal en desarrollo y en la demo
 * del taller— `CertificateService` lanza `BadRequestException`, y sin este
 * aislamiento la pantalla entera quedaría en error por no tener un .p12 a
 * mano. Una alerta que no se puede calcular se reporta como "no evaluable",
 * no como una caída.
 */
import { Injectable, Logger } from '@nestjs/common';
import { CertificateService } from '../../../sunat/certificate.service';
import { QueueService } from '../../../resilience/infrastructure/queue/queue.service';

/** Umbrales de aviso de vencimiento, en días. */
export const UMBRAL_CERTIFICADO_DIAS = 30;
export const UMBRAL_CERTIFICADO_CRITICO_DIAS = 7;

/** Gravedad de una alerta, para que el front elija el color del badge. */
export type GravedadAlerta = 'OK' | 'AVISO' | 'CRITICO' | 'SIN_DATOS';

/** Estado del certificado digital de firma. */
export interface AlertaCertificado {
  /** `false` cuando no hay .p12 configurado: no es un error, es un dato ausente. */
  evaluado: boolean;
  /** Días que le quedan al certificado, o `null` si no se pudo leer. */
  diasRestantes: number | null;
  /** Fecha de vencimiento en ISO, o `null`. */
  venceEl: string | null;
  gravedad: GravedadAlerta;
  /** Texto ya redactado para pintar en pantalla. */
  mensaje: string;
}

/** Estado de la cola de muertos de la empresa. */
export interface AlertaDlq {
  evaluado: boolean;
  /** Comprobantes que agotaron los reintentos y esperan intervención. */
  pendientes: number;
  gravedad: GravedadAlerta;
  mensaje: string;
  /**
   * Trabajos de la DLQ cuyo comprobante YA NO EXISTE en la base.
   *
   * Se informa aparte porque no son trabajo pendiente: son restos. Un job de la
   * cola de muertos apunta a un `invoice_id`; si ese comprobante se borró, el
   * job queda huérfano y se puede mover a la cola principal cuantas veces se
   * quiera sin que nunca desaparezca. Contarlos como "necesitan revisión
   * manual" dejaba el Monitor diciendo "DLQ 3" mientras la tabla de la DLQ
   * salía vacía y las métricas informaban un solo comprobante sin confirmar.
   */
  huerfanos: number;
}

/** Respuesta de `GET /api/v1/invoices/alertas`. */
export interface AlertasOperativas {
  certificado: AlertaCertificado;
  dlq: AlertaDlq;
  /** La gravedad más alta de las dos, para que el front pinte un solo aviso. */
  gravedadGlobal: GravedadAlerta;
  /** Instante en que se tomaron los datos. */
  consultadoEl: string;
}

/** Orden de gravedad, de menos a más, para calcular la global. */
const ORDEN_GRAVEDAD: readonly GravedadAlerta[] = [
  'OK',
  'SIN_DATOS',
  'AVISO',
  'CRITICO',
];

/**
 * La gravedad más alta de la lista.
 *
 * `SIN_DATOS` va por encima de `OK` a propósito: que no haya certificado
 * configurado no es lo mismo que tener uno en regla, y pintar un verde por "no
 * lo pude comprobar" es el tipo de falso positivo que hace desconfiar de la
 * pantalla entera.
 */
export const gravedadMaxima = (
  gravedades: readonly GravedadAlerta[],
): GravedadAlerta =>
  gravedades.reduce<GravedadAlerta>(
    (max, g) => (ORDEN_GRAVEDAD.indexOf(g) > ORDEN_GRAVEDAD.indexOf(max) ? g : max),
    'OK',
  );

/**
 * Deduce la gravedad de un certificado según los días que le quedan.
 *
 * Función pura para poder probar los bordes exactos (7, 8, 30, 31 días) sin
 * generar certificados de verdad.
 */
export const gravedadCertificado = (diasRestantes: number): GravedadAlerta => {
  if (diasRestantes <= 0) return 'CRITICO';
  if (diasRestantes <= UMBRAL_CERTIFICADO_CRITICO_DIAS) return 'CRITICO';
  if (diasRestantes <= UMBRAL_CERTIFICADO_DIAS) return 'AVISO';
  return 'OK';
};

/** Mensaje del certificado, ya con la cifra dentro. */
export const mensajeCertificado = (
  diasRestantes: number,
  venceEl: Date,
): string => {
  const fecha = venceEl.toISOString().slice(0, 10);
  if (diasRestantes <= 0) {
    return `El certificado digital venció el ${fecha}: no se puede firmar ningún comprobante.`;
  }
  if (diasRestantes <= UMBRAL_CERTIFICADO_CRITICO_DIAS) {
    return `El certificado digital vence en ${diasRestantes} día(s) (${fecha}). Renuévalo hoy: sin él se detiene la emisión.`;
  }
  if (diasRestantes <= UMBRAL_CERTIFICADO_DIAS) {
    return `El certificado digital vence en ${diasRestantes} día(s) (${fecha}). Conviene renovarlo esta semana.`;
  }
  return `El certificado digital es válido por ${diasRestantes} día(s) más (vence el ${fecha}).`;
};

/**
 * Mensaje de la DLQ.
 *
 * Una cola de muertos con elementos es siempre un problema: significa que hay
 * comprobantes que SUNAT nunca recibió y que ninguna tarea automática va a
 * reintentar.
 */
export const mensajeDlq = (pendientes: number, huerfanos = 0): string => {
  if (pendientes === 0) {
    return huerfanos > 0
      ? `La cola de muertos tiene ${huerfanos} trabajo(s) de comprobantes ya borrados; no hay comprobantes pendientes de revisión.`
      : 'Sin comprobantes en la cola de muertos.';
  }

  const base = `${pendientes} comprobante(s) agotaron los reintentos y necesitan revisión manual.`;
  // Los huérfanos no se suman: se mencionan aparte para que el número grande
  // siga siendo el trabajo real.
  return huerfanos > 0
    ? `${base} (${huerfanos} trabajo(s) más de la cola apunta(n) a comprobantes ya borrados.)`
    : base;
};

@Injectable()
export class InvoiceAlertService {
  private readonly logger = new Logger(InvoiceAlertService.name);

  constructor(
    private readonly certificado: CertificateService,
    private readonly cola: QueueService,
  ) {}

  /**
   * Estado del certificado de firma.
   *
   * No lanza: si el .p12 falta, está mal configurado o la contraseña es
   * incorrecta, se devuelve `evaluado: false` con el motivo, porque la pantalla
   * de métricas debe seguir funcionando.
   */
  public estadoCertificado(): AlertaCertificado {
    try {
      const cert = this.certificado.getCertificate();
      const gravedad = gravedadCertificado(cert.daysRemaining);

      return {
        evaluado: true,
        diasRestantes: cert.daysRemaining,
        venceEl: cert.validTo.toISOString(),
        gravedad,
        mensaje: mensajeCertificado(cert.daysRemaining, cert.validTo),
      };
    } catch (error: unknown) {
      // Se registra en debug y no en error: en desarrollo es lo esperado.
      this.logger.debug(
        `Certificado no evaluable: ${error instanceof Error ? error.message : 'motivo desconocido'}`,
      );

      return {
        evaluado: false,
        diasRestantes: null,
        venceEl: null,
        gravedad: 'SIN_DATOS',
        mensaje:
          'No hay certificado digital configurado o no se pudo leer, así que la fecha de vencimiento no se puede vigilar.',
      };
    }
  }

  /**
   * Comprobantes propios que quedaron en la DLQ.
   *
   * Los trabajos huérfanos —los que apuntan a un comprobante que ya no existe—
   * NO cuentan como pendientes. Antes sí contaban: el Monitor mostraba "DLQ 3"
   * porque tres jobs apuntaban a comprobantes borrados en un repoblado, mientras
   * la tabla de la DLQ salía vacía y las métricas informaban un solo
   * comprobante sin confirmar. Los tres números eran correctos y hablaban de
   * cosas distintas, que es peor que uno equivocado: nadie sabe en cuál creer.
   */
  public async estadoDlq(companyId: string): Promise<AlertaDlq> {    try {
      const trabajos = await this.cola.countDlq(companyId);
      const huerfanos = await this.cola.countDlqHuerfanos(companyId);
      // Lo que se informa como pendiente es lo que un operador puede resolver:
      // los trabajos cuyo comprobante aún existe. Un job huérfano no se arregla
      // reintentándolo.
      const pendientes = Math.max(0, trabajos - huerfanos);

      return {
        evaluado: true,
        pendientes,
        gravedad: pendientes > 0 ? 'CRITICO' : 'OK',
        mensaje: mensajeDlq(pendientes, huerfanos),
        huerfanos,
      };
    } catch (error: unknown) {
      this.logger.warn(
        `No se pudo leer la DLQ: ${error instanceof Error ? error.message : 'motivo desconocido'}`,
      );

      return {
        evaluado: false,
        pendientes: 0,
        gravedad: 'SIN_DATOS',
        mensaje:
          'No se pudo consultar la cola de muertos; el número de comprobantes trabados es desconocido.',
        huerfanos: 0,
      };
    }
  }

  /**
   * Las dos alertas juntas.
   *
   * Se ejecutan en paralelo y ninguna de las dos puede lanzar, así que el
   * endpoint responde siempre 200: una alerta ilegible se informa dentro del
   * cuerpo, no como un fallo de la petición.
   */
  public async estado(companyId: string): Promise<AlertasOperativas> {
    const [certificado, dlq] = await Promise.all([
      Promise.resolve(this.estadoCertificado()),
      this.estadoDlq(companyId),
    ]);

    return {
      certificado,
      dlq,
      gravedadGlobal: gravedadMaxima([certificado.gravedad, dlq.gravedad]),
      consultadoEl: new Date().toISOString(),
    };
  }
}
