/**
 * Detracción por PRODUCTO, no por comprobante.
 *
 * LO QUE DIJO EL DOCENTE (transcripción del 31-10, parte 1)
 *
 *   "Pero eso lo manda el producto, no lo manda la factura, porque los productos
 *    son con detracción, no la factura."
 *
 *   "En el caso del agente de retención y de detracción, ese pertenece al
 *    cliente, no al comprobante."
 *
 * De ahí salen dos conceptos que el formulario trataba como uno solo:
 *
 *  - **Detracción (SPOT):** la lleva el PRODUCTO o SERVICIO. Un flete de carga
 *    está sujeto; un kilo de cemento no. Si una factura mezcla un flete con
 *    cemento, solo la línea del flete genera detracción.
 *  - **Retención del IGV (3%):** la lleva el CLIENTE. Si el adquirente está
 *    designado Agente de Retención, retiene sobre el total.
 *
 * POR QUÉ ESTABA MAL
 *
 * `liquidarComprobante` recibía `detraccionPorcentaje` como opción de TODA la
 * factura. Con eso, o se detraía todo o no se detraía nada: una factura de
 * ferretería con un flete dentro detraía el 4 % del cemento, que es una
 * detención que el cliente no debe hacer y que descuadra su Registro de Compras.
 *
 * Aquí el código del Catálogo 54 vive en la LÍNEA y la liquidación suma solo
 * las líneas sujetas.
 */
import { round2 } from './invoiceTaxes';
import { buscarDetraccion, UMBRAL_DETRACCION } from './invoiceDetraccion';

/** Línea mínima que necesita el cálculo: su base y su código de detracción. */
export interface LineaSujeta {
  base: number;
  /** Código del Catálogo 54; vacío u omitido = no sujeta. */
  codigoDetraccion?: string;
}

/** Resultado del cálculo de detracción de un comprobante. */
export interface DetraccionPorLineas {
  /** `true` si alguna línea está sujeta y se superó el umbral. */
  aplica: boolean;
  /** Base sujeta: suma del valor de venta de las líneas sujetas. */
  baseSujeta: number;
  /** Importe de detracción con dos decimales. */
  monto: number;
  /** Códigos del Catálogo 54 detectados. */
  codigos: readonly string[];
  /** Por qué no aplica, cuando no aplica. Cadena vacía si aplica. */
  motivoNoAplica: string;
}

/** Devuelve el resultado "no aplica" con su motivo. */
const sinAplica = (
  motivo: string,
  codigos: readonly string[] = [],
): DetraccionPorLineas => ({
  aplica: false,
  baseSujeta: 0,
  monto: 0,
  codigos,
  motivoNoAplica: motivo,
});

/**
 * Calcula la detracción de un comprobante a partir de sus LÍNEAS.
 *
 * Función pura: recibe las líneas ya armadas y el importe total, para poder
 * probar los bordes (S/ 700.00 exacto, S/ 700.01, comprobante mixto) sin React.
 *
 * @param lineas Líneas del comprobante, cada una con su posible código.
 * @param importeTotal Importe total del comprobante, para evaluar el umbral.
 * @param tipoCambio SBS venta cuando el comprobante no está en soles.
 */
export const calcularDetraccionPorLineas = (
  lineas: readonly LineaSujeta[],
  importeTotal: number,
  tipoCambio = 1,
): DetraccionPorLineas => {
  const sujetas = lineas.filter(
    (l) => (l.codigoDetraccion ?? '').trim() !== '',
  );
  if (sujetas.length === 0) {
    return sinAplica('Ninguna línea del comprobante está sujeta a detracción.');
  }

  const codigos = [...new Set(sujetas.map((l) => l.codigoDetraccion!.trim()))];

  // Todas las líneas sujetas deben compartir el mismo código: el XML de SUNAT
  // admite una sola operación sujeta por comprobante.
  if (codigos.length > 1) {
    return sinAplica(
      `El comprobante mezcla tipos de servicio distintos (${codigos.join(', ')}). ` +
        'Emite una factura por cada tipo de detracción.',
      codigos,
    );
  }

  const tipo = buscarDetraccion(codigos[0]);
  if (!tipo) {
    return sinAplica(
      `El código ${codigos[0]} no figura en el Catálogo 54 de SUNAT.`,
      codigos,
    );
  }

  // El umbral es del COMPROBANTE, no de la línea: un flete de S/ 500 dentro de
  // una factura de S/ 2 000 sí se detrae.
  const totalEnSoles = round2(importeTotal * tipoCambio);
  if (totalEnSoles <= UMBRAL_DETRACCION) {
    return sinAplica(
      `El importe total (S/ ${totalEnSoles.toFixed(2)}) no supera el umbral de ` +
        `S/ ${UMBRAL_DETRACCION.toFixed(2)}.`,
      codigos,
    );
  }

  // La base comprende el importe de las líneas sujetas, con sus tributos.
  const baseSujeta = round2(
    sujetas.reduce((acc, l) => acc + (Number.isFinite(l.base) ? l.base : 0), 0),
  );
  if (baseSujeta <= 0) {
    return sinAplica('La base sujeta es cero.', codigos);
  }

  return {
    aplica: true,
    baseSujeta,
    monto: round2(baseSujeta * tipo.porcentaje),
    codigos,
    motivoNoAplica: '',
  };
};

/**
 * Reparto del importe entre las vías de pago.
 *
 * POR QUÉ NO ES UN "NETO"
 *
 * `netoPendientePago` se calculaba como `importeTotal - detraccion - retencion`,
 * lo que sugiere que el comprobante vale menos. No es así: el comprobante vale
 * el importe total; lo que cambia es cuánto va por cada vía. Dejarlo explícito
 * evita que la pantalla muestre un "total" que el contador no reconoce.
 */
export interface RepartoPago {
  importeTotal: number;
  /** Lo que se deposita en el Banco de la Nación. */
  depositoDetraccion: number;
  /** Lo que el cliente retiene y paga al fisco. */
  retenidoIgv: number;
  /** Lo que el cliente paga directamente al proveedor. */
  pagoDirecto: number;
}

/** Reparte el importe total entre pago directo, detracción y retención. */
export const repartirPago = (
  importeTotal: number,
  depositoDetraccion: number,
  retenidoIgv: number,
): RepartoPago => {
  const total = round2(importeTotal);
  const deposito = round2(depositoDetraccion);
  const retenido = round2(retenidoIgv);

  return {
    importeTotal: total,
    depositoDetraccion: deposito,
    retenidoIgv: retenido,
    pagoDirecto: round2(total - deposito - retenido),
  };
};
