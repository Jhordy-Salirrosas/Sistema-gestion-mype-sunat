import { redondearMoneda as centimos } from '../../money';
/**
 * Forma de pago, cronograma de cuotas y detracción SPOT (TA-63, HU-10).
 *
 * Este archivo es el VALIDADOR: comprueba que el cronograma cuadre antes de
 * generar el XML. Los bloques XML viven en `xmlNodesHelper`.
 *
 * Reglas de SUNAT que se aplican, verificadas en la hoja oficial
 * `ValidaExprRegFactura-2.0.1.xsl` del juego `assets/sunat-sfs/`:
 *
 *  - **3267**: cada cuota debe tener `PaymentDueDate` POSTERIOR a la fecha de
 *    emisión. Una cuota con vencimiento el mismo día o anterior es rechazada.
 *  - **3319**: la suma de las cuotas debe igualar EXACTAMENTE el monto neto
 *    pendiente de pago. La hoja oficial calcula los dos lados con
 *    `round(... * 100000) div 100000` y los compara con `!=`: no hay tolerancia
 *    ni de un céntimo.
 *  - **3247**: no puede haber a la vez un bloque `Contado` y uno `Credito`.
 *  - **3127 / 3034**: si el tipo de operación es 100x (detracción), deben
 *    existir `PaymentTerms/ID = 'Detraccion'` y `PaymentMeans/ID = 'Detraccion'`.
 *  - **4265**: con tipo de operación 100x es obligatoria la Leyenda 2006.
 *  - **3208**: el monto de la detracción se expresa en PEN, redondeado a
 *    entero, aunque el comprobante esté en otra moneda.
 *
 * Se valida ANTES de generar el XML y se lanza `BadRequestException`: emitir
 * un comprobante con cuotas descuadradas y descubrirlo por el CDR de SUNAT
 * cuesta un envío y un rechazo, y el error que devuelve SUNAT no dice cuál de
 * las cuotas está mal.
 */
import { BadRequestException } from '@nestjs/common';
import {
  CATALOGO_54_DETRACCION,
  UMBRAL_DETRACCION_SOLES,
} from '../../sunatCatalogs';
import { esCodigoDetraccionVigente } from '../../sunatCatalogsQuery';

/** Forma de pago declarada por el usuario. */
export type FormaDePago = 'Contado' | 'Credito';

/** Una cuota del cronograma. */
export interface Cuota {
  /** Identificador que se escribe en el XML: Cuota001, Cuota002... */
  numero: string;
  monto: number;
  /** Fecha de vencimiento en formato YYYY-MM-DD. */
  vencimiento: string;
}

/** Datos de la operación necesarios para validar el pago. */
export interface DatosPago {
  formaPago?: FormaDePago;
  /** Importe total con impuestos (TaxInclusiveAmount). */
  montoTotal: number;
  fechaEmision: string;
  cuotas?: Cuota[];
  /** Monto que se descuenta por detracción, si la hay. */
  detraccion?: number;
  /** Retención del cliente, informada en el comprobante. */
  retencion?: number;
  /** Tipo de operación del Catálogo 51: 0101, 1001... */
  tipoOperacion?: string;
}

/** Redondeo a céntimos, sin arrastrar error de coma flotante. */

/**
 * ¿El tipo de operación es de los que llevan detracción?
 *
 * El Catálogo 51 dedica la serie 1001-1004 a las operaciones sujetas a
 * detracción (venta interna, exportación de servicios, etc.). La hoja oficial
 * usa exactamente este conjunto para exigir la Leyenda 2006 y los bloques
 * `Detraccion`; replicarlo aquí evita descubrirlo en el rechazo.
 */
export function esOperacionConDetraccion(tipoOperacion?: string): boolean {
  const tipo = (tipoOperacion ?? '').trim();
  return ['1001', '1002', '1003', '1004'].includes(tipo);
}

/**
 * Monto neto pendiente de pago al crédito.
 *
 * Es el total menos lo ya cubierto: la detracción la deposita el cliente en el
 * Banco de la Nación, así que NO forma parte del saldo que se paga con cuotas.
 * Descontarla del neto es lo que pide el criterio ("se descuenta del monto
 * neto pendiente al crédito"); sumarla produciría un cronograma que no cuadra
 * contra la hoja oficial.
 */
export function montoNetoPendiente(datos: {
  montoTotal: number;
  detraccion?: number;
  retencion?: number;
}): number {
  const total = datos.montoTotal ?? 0;
  const detraccion = datos.detraccion ?? 0;
  const neto = centimos(total - detraccion - (datos.retencion ?? 0));
  // Una detracción mayor que el total no puede dejar un neto negativo: sería
  // un error de captura, y el cronograma no podría cuadrar nunca.
  return neto > 0 ? neto : 0;
}

/** Convierte un índice (1-based) a `Cuota001`. */
export function numeroDeCuota(indice: number): string {
  return `Cuota${String(indice).padStart(3, '0')}`;
}

/**
 * Valida el cronograma completo antes de emitir.
 *
 * @throws BadRequestException con el detalle exacto del problema.
 */
export function validarPago(datos: DatosPago): void {
  const forma = datos.formaPago ?? 'Contado';
  const cuotas = datos.cuotas ?? [];

  if (forma === 'Contado') {
    // Regla 3247: un comprobante al contado no lleva cronograma. Enviarlo
    // igual no es inocuo: SUNAT lo rechaza por incoherencia entre forma de
    // pago y cuotas.
    if (cuotas.length > 0) {
      throw new BadRequestException(
        'Una venta al contado no puede tener cronograma de cuotas: ' +
          'cambie la forma de pago a Crédito o elimine las cuotas.',
      );
    }
    return;
  }

  // ---- Crédito ----
  if (cuotas.length === 0) {
    throw new BadRequestException(
      'Una venta al crédito debe indicar al menos una cuota.',
    );
  }

  const fechaEmision = fechaIso(datos.fechaEmision, 'la emisión');

  // Regla 3267: vencimiento posterior a la emisión.
  for (const cuota of cuotas) {
    if (!cuota.vencimiento) {
      throw new BadRequestException(
        `La cuota ${cuota.numero} no tiene fecha de vencimiento.`,
      );
    }
    const vence = fechaIso(cuota.vencimiento, `la cuota ${cuota.numero}`);
    if (vence <= fechaEmision) {
      throw new BadRequestException(
        `La cuota ${cuota.numero} vence el ${cuota.vencimiento}, que no es ` +
          `posterior a la fecha de emisión (${datos.fechaEmision}). ` +
          'SUNAT exige que el vencimiento de cada cuota sea posterior (regla 3267).',
      );
    }
  }

  // Los montos deben ser positivos: una cuota de 0.00 es un error de captura.
  for (const cuota of cuotas) {
    if (!Number.isFinite(cuota.monto) || cuota.monto <= 0) {
      throw new BadRequestException(
        `La cuota ${cuota.numero} tiene un monto inválido (${cuota.monto}).`,
      );
    }
    if (Math.abs(cuota.monto * 100 - Math.round(cuota.monto * 100)) > 1e-7) {
      throw new BadRequestException(`La cuota ${cuota.numero} no puede tener fracciones de céntimo.`);
    }
  }

  // Regla 3319: suma exacta, sin tolerancia. Se compara en céntimos enteros
  // porque 0.1 + 0.2 !== 0.3 en coma flotante.
  const neto = montoNetoPendiente(datos);
  const suma = centimos(cuotas.reduce((total, c) => total + c.monto, 0));

  if (Math.round(suma * 100) !== Math.round(neto * 100)) {
    throw new BadRequestException(
      `El cronograma no cuadra: las cuotas suman ${suma.toFixed(2)} y el monto ` +
        `neto pendiente es ${neto.toFixed(2)}. La diferencia de ` +
        `${centimos(neto - suma).toFixed(2)} no se admite, ni un céntimo (regla 3319).`,
    );
  }
}

/**
 * Valida la detracción de una operación.
 *
 * @throws BadRequestException si el código no existe, está dado de baja o si
 *   se intenta declarar detracción en un comprobante que no la admite.
 */
export function validarDetraccion(params: {
  codigoDetraccion?: string;
  moneda?: string;
  montoTotal: number;
  tipoComprobante?: string;
}): void {
  const codigo = params.codigoDetraccion?.trim();
  if (!codigo) return;

  // Solo las Facturas (01) admiten detracción; las Boleta no.
  const tipo = params.tipoComprobante ?? '01';
  if (tipo !== '01') {
    throw new BadRequestException(
      'La detracción SPOT solo se aplica a Facturas (01); una Boleta no la admite.',
    );
  }

  // Regla del backlog: los códigos dados de baja por SUNAT se rechazan antes
  // de enviar, porque el rechazo llegaría recién con el CDR. Se comprueba
  // ANTES de buscar en el catálogo: los códigos retirados (006, 018, 029, 033)
  // ya no figuran en `CATALOGO_54_DETRACCION`, así que sin esta comprobación
  // previa el usuario leería "no existe" en lugar de "fue dado de baja", que es
  // la información que necesita para elegir otro.
  if (!esCodigoDetraccionVigente(codigo)) {
    throw new BadRequestException(
      `El código de detracción ${codigo} fue dado de baja por SUNAT. ` +
        'Elija uno vigente del Catálogo 54.',
    );
  }

  const entrada = (
    CATALOGO_54_DETRACCION as Record<string, { porcentaje: number }>
  )[codigo];

  if (!entrada) {
    throw new BadRequestException(
      `El código de detracción ${codigo} no existe en el Catálogo 54.`,
    );
  }

  // El umbral (S/ 700) se mide en soles sobre el importe de la operación.
  if (!(params.montoTotal > UMBRAL_DETRACCION_SOLES)) {
    throw new BadRequestException(
      `El monto (${params.montoTotal.toFixed(2)}) no supera el umbral de ` +
        `S/ ${UMBRAL_DETRACCION_SOLES}.00: esta operación no está sujeta a detracción.`,
    );
  }
}

/**
 * Importe de la detracción, siempre en PEN y redondeado a entero (regla 3208).
 *
 * SUNAT informa el monto de detracción en soles enteros aunque el comprobante
 * esté en dólares, porque el depósito se hace en el Banco de la Nación en
 * moneda nacional. Se redondea al entero más cercano, que es lo que la
 * liquidación del SPOT refleja.
 */
export function montoDetraccion(
  baseImponible: number,
  codigo: string,
): number {
  const entrada = (
    CATALOGO_54_DETRACCION as Record<string, { porcentaje: number }>
  )[codigo];

  if (!entrada || baseImponible <= 0) return 0;
  return Math.round(baseImponible * entrada.porcentaje);
}

/** Convierte una fecha a un número comparable; lanza si no es válida. */
function fechaIso(valor: string, contexto: string): number {
  const fecha = new Date(`${valor}T00:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(valor) || Number.isNaN(fecha.getTime()) || fecha.toISOString().slice(0, 10) !== valor) {
    throw new BadRequestException(
      `La fecha de ${contexto} no es válida: "${valor}". Use el formato AAAA-MM-DD.`,
    );
  }
  return fecha.getTime();
}
