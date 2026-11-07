/**
 * Productos del almacén para el buscador de la grilla de emisión.
 *
 * LO QUE PIDIÓ EL DOCENTE (31-10, parte 2)
 *
 *   "No lo describas, supone que lo tienes en tu inventario. ¿Por qué tendría
 *    que escribirlos? Eso de ahí tendría que buscarlo."
 *
 *   "Y ahora la cantidad tiene que ser validada dependiendo de lo que tienes."
 *
 * O sea: el producto se ELIGE del inventario, no se teclea. Y la cantidad no
 * puede superar el stock disponible.
 *
 * QUÉ SE CONSUME
 *
 * `GET /api/v1/inventory/stocks` devuelve la valorización por almacén. Cada
 * entrada de `balances` trae `sku`, `description`, `currentStock` y
 * `averageUnitCost`, que es justo lo que la línea necesita. NO se usa
 * `/inventory/movements` ni el kardex: el precio de venta parte del costo
 * promedio y el usuario lo ajusta en la grilla.
 */
import { apiClient } from '@/lib/axios';
import type { ProductoBuscado } from '../lib/invoiceSearch';

/** Respuesta cruda de `/inventory/stocks`. */
interface RespuestaStocks {
  balances?: Array<{
    sku?: string;
    description?: string;
    currentStock?: number | string;
    averageUnitCost?: number | string;
  }>;
}

/** Redondeo a céntimos para el valor unitario sugerido. */
const r2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;

/**
 * Convierte la respuesta de stock a los productos que espera el buscador.
 *
 * Función pura y exportada para poder probarla sin red: lo que se rompe aquí
 * son las conversiones (un `currentStock` que llega como "12.000" del Decimal
 * de Prisma, un costo nulo), no la llamada HTTP.
 */
export const productosDesdeStocks = (
  respuesta: RespuestaStocks | null | undefined,
): ProductoBuscado[] => {
  const balances = respuesta?.balances ?? [];

  return balances
    .map((b) => {
      const sku = (b.sku ?? '').trim();
      const stock = Number(b.currentStock ?? 0);
      const costo = Number(b.averageUnitCost ?? 0);

      return {
        sku,
        descripcion: (b.description ?? '').trim(),
        // La unidad del producto no viene en la valorización; se usa NIU, que
        // es la del Catálogo 03 válida para bienes, y el usuario la cambia si
        // el producto se vende por docena o por ciento.
        unidad: 'NIU',
        valorUnitario: Number.isFinite(costo) ? r2(costo) : 0,
        stock: Number.isFinite(stock) ? stock : 0,
      };
    })
    // Un producto sin SKU no se puede rastrear en el Kardex: no se ofrece.
    .filter((p) => p.sku !== '');
};

/**
 * Trae los productos con stock de la empresa.
 *
 * Si el endpoint falla se devuelve una lista vacía y la pantalla sigue
 * funcionando con la grilla manual: bloquear la emisión porque el almacén no
 * responde sería peor que el problema que el buscador resuelve.
 */
export const cargarProductosAlmacen = async (): Promise<ProductoBuscado[]> => {
  try {
    const response = await apiClient.get<RespuestaStocks>(
      '/inventory/stocks',
    );
    return productosDesdeStocks(response.data);
  } catch {
    return [];
  }
};
