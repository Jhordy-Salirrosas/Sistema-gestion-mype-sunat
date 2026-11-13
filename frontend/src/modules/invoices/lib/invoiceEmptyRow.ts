import type { ItemBorrador } from './invoiceItems';
/** Añadir desde el modal reutiliza la primera fila sin producto ni descripción. */
export function agregarFilaModal(items: readonly ItemBorrador[], crear: () => ItemBorrador): readonly ItemBorrador[] {
  const primera = items[0];
  if (primera && !primera.codigo.trim() && !primera.descripcion.trim()) return items;
  return [...items, crear()];
}
