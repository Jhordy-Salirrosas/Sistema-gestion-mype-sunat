import type { ItemBorrador } from './invoiceItems';

/** Primera fila sin producto ni descripción; conserva su identidad al reutilizarla. */
const indiceVacio = (items: readonly ItemBorrador[]) =>
  items.findIndex(item => !item.codigo.trim() && !item.descripcion.trim());

export function agregarFilaModal(items: readonly ItemBorrador[], crear: () => ItemBorrador): readonly ItemBorrador[] {
  if (indiceVacio(items) >= 0) return items;
  return [...items, crear()];
}

export function colocarProductoEnFilaVacia(items: readonly ItemBorrador[], producto: ItemBorrador): readonly ItemBorrador[] {
  const vacia = indiceVacio(items);
  return vacia < 0 ? [...items, producto] : items.map((item, i) =>
    i === vacia ? { ...item, ...producto, clave: item.clave } : item);
}

/** Acción común de página y modal: reutilizar antes de añadir y dirigir el teclado. */
export function agregarItemConBusqueda(
  actualizar: (transformar: (items: readonly ItemBorrador[]) => readonly ItemBorrador[]) => void,
  crear: () => ItemBorrador,
  formulario: HTMLElement | null,
): void {
  actualizar(items => agregarFilaModal(items, crear));
  const destino = formulario?.querySelector<HTMLElement>('[data-invoice-product-search], [data-invoice-product-status]');
  destino?.focus();
  destino?.scrollIntoView?.({ block: 'center' });
}

/** Atajo de emisión: dirige al catálogo sin crear líneas libres. */
export function enfocarBusquedaProducto(formulario: HTMLElement | null): void {
  const destino = formulario?.querySelector<HTMLElement>('[data-invoice-product-search], [data-invoice-product-status]');
  destino?.focus();
  destino?.scrollIntoView?.({ block: 'center' });
}
