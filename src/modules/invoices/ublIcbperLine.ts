import { BadRequestException } from '@nestjs/common';
import { multiplicarMoneda } from './money';
/**
 * ICBPER como línea independiente del detalle (TA-62, regla XSL 3306).
 *
 * El impuesto a las bolsas plásticas no es un producto que se venda: es un
 * tributo que se cobra POR bolsa entregada. SUNAT lo exige de dos maneras a la
 * vez, y por eso el generador declara ambas:
 *
 *  1. Un `cac:TaxTotal` con `TaxScheme/ID = 7152` a nivel de comprobante
 *     (ya existía en `ublTaxBlocks`).
 *  2. Una LÍNEA propia del detalle, con unidad NIU, afectación gravada y el
 *     tributo 7152. Esa línea es la que hace que el importe figure en el
 *     `TaxInclusiveAmount` y en el total a pagar.
 *
 * Regla 3306: el monto de la línea debe ser EXACTAMENTE cantidad x 0.50, sin
 * tolerancia. Un céntimo de diferencia y la hoja oficial devuelve error, porque
 * SUNAT cruza ese importe contra el número de bolsas declarado.
 *
 * Antes de TA-62 solo existía la constante y el `TaxTotal`: el tributo se
 * calculaba en el total pero no aparecía en el detalle, así que la
 * representación impresa y la hoja oficial no cuadraban.
 */
import { MONTO_ICBPER_POR_BOLSA } from './sunatCatalogs';
import type { LineaDetalle } from './xmlNodesHelper';

/** Descripción que SUNAT espera para la bolsa plástica. */
export const DESCRIPCION_BOLSA_ICBPER = 'BOLSA PLASTICA';

/** Ítem del payload que representa bolsas plásticas. */
export interface BolsaIcBper {
  /** Cantidad de bolsas entregadas. */
  cantidad: number;
  /** Precio de venta de la bolsa en sí; normalmente 0. */
  valorUnitario?: number;
  descripcion?: string;
}

/**
 * Importe total del ICBPER para N bolsas.
 *
 * Se calcula en céntimos enteros y se divide al final: multiplicar en coma
 * flotante (`0.1 + 0.2 !== 0.3`) produce importes como 1.4000000000000001 que,
 * al formatearlos con dos decimales, dan un céntimo de más en facturas grandes.
 */
export const calcularIcbper = (cantidadBolsas: number): number => {
  if (!Number.isFinite(cantidadBolsas) || cantidadBolsas <= 0) return 0;
  if (!Number.isSafeInteger(cantidadBolsas)) throw new BadRequestException('ICBPER requiere cantidad entera de bolsas');
  return multiplicarMoneda(cantidadBolsas, MONTO_ICBPER_POR_BOLSA);
};

/**
 * Construye la línea independiente del ICBPER.
 *
 * @param id Número de línea que le toca (va al final del detalle).
 * @param bolsa Cantidad de bolsas y, opcionalmente, su precio propio.
 * @returns La línea lista para el XML, o `null` si no hay bolsas.
 *
 * El `totalLinea` que se devuelve ya incluye el ICBPER en el `taxableAmount`
 * de la línea, porque el tributo 7152 es parte de lo que paga el cliente.
 */
export const lineaBolsaIcBper = (
  id: number,
  bolsa: BolsaIcBper,
): LineaDetalle | null => {
  const cantidad = bolsa.cantidad;
  if (cantidad <= 0) return null;

  const impuesto = calcularIcbper(cantidad);
  // El valor de venta de la bolsa es cero por defecto: la bolsa se entrega con
  // la mercadería, no se vende como producto. El único importe que paga el
  // cliente por ella es el tributo.
  const valorUnitario = bolsa.valorUnitario ?? 0;
  const valorVenta = valorUnitario * cantidad;

  return {
    id,
    descripcion: bolsa.descripcion ?? DESCRIPCION_BOLSA_ICBPER,
    unidad: 'NIU',
    cantidad,
    valorUnitario,
    // Precio unitario sin IGV: el ICBPER no lleva IGV.
    precioUnitario: valorUnitario,
    afectacion: '10',
    // El total de la línea es el valor de venta; el tributo va aparte en
    // `icbperLinea` y el generador lo suma al TaxTotal de la línea.
    totalLinea: valorVenta,
    igvLinea: 0,
    icbperLinea: impuesto,
    cantidadBolsas: cantidad,
  };
};
