/** Catálogo M1: sale_price es precio final PEN. Nunca se utiliza el costo. */
import { apiClient } from '@/lib/axios';
import type { ProductoBuscado } from '../lib/invoiceSearch';
export interface ProductoPrecio {
  sku: string;
  description: string;
  sunatUnitCode?: string;
  taxAffectation?: string | null;
  currentStock?: number | string;
  salePrice?: number | string | null;
  vendible?: boolean;
  motivo?: string | null;
}
interface RespuestaStocks {
  balances?: ProductoPrecio[];
}
export const productosDesdeStocks = (
  respuesta: RespuestaStocks | null | undefined,
): ProductoBuscado[] =>
  (respuesta?.balances ?? [])
    .filter(
      (b) =>
        b.sku?.trim() &&
        Number.isFinite(Number(b.salePrice)) &&
        Number(b.salePrice) > 0 &&
        b.vendible !== false,
    )
    .map((b) => {
      const precio = Number(b.salePrice);
      const gravada = ['10', 'GRAVADA'].includes(
        b.taxAffectation?.trim().toUpperCase() ?? '',
      );
      return {
        sku: b.sku.trim(),
        descripcion: b.description?.trim() ?? '',
        unidad: b.sunatUnitCode?.trim().toUpperCase() ?? '',
        valorUnitario: gravada ? Number((precio / 1.18).toFixed(10)) : precio,
        precioUnitario: precio,
        stock: Number(b.currentStock) || 0,
        ...(b.taxAffectation ? { afectacion: b.taxAffectation.trim() } : {}),
      };
    });
export async function listarPrecios(): Promise<ProductoPrecio[]> {
  return (
    (await apiClient.get<RespuestaStocks>('/invoices/products')).data
      .balances ?? []
  );
}
export async function guardarPrecio(
  sku: string,
  sale_price: number,
): Promise<void> {
  await apiClient.patch(
    `/inventory/stocks/products/${encodeURIComponent(sku)}`,
    { sale_price },
  );
}
export async function cargarProductosAlmacen(
  almacen = 'ALM-01',
): Promise<ProductoBuscado[]> {
  try {
    return productosDesdeStocks(
      (
        await apiClient.get<RespuestaStocks>('/invoices/products', {
          params: { almacen },
        })
      ).data,
    );
  } catch {
    return [];
  }
}
