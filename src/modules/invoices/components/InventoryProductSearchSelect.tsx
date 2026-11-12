/**
 * Buscador reactivo de productos (TA-61).
 *
 * El SKU tiene prioridad sobre la descripción: en una ferretería se busca "CEM"
 * más a menudo que "cemento". Al elegir un producto se arrastran su descripción,
 * su unidad del Catálogo 03 y su valor unitario, que es justo lo que se
 * digitaba mal.
 *
 * Se muestra el stock disponible porque vender lo que no hay produce un
 * comprobante válido y un almacén que no cuadra.
 */
import { useId, useMemo, useState } from 'react';
import { PageText } from '@/components/ui';
import {
  MINIMO_CARACTERES,
  filtrarProductos,
  type ProductoBuscado,
} from '../lib/invoiceSearch';

interface InventoryProductSearchSelectProps {
  productos: readonly ProductoBuscado[];
  onElegir: (producto: ProductoBuscado) => void;
  placeholder?: string;
}

/** Formatea un importe con dos decimales. */
const soles = (valor: number): string =>
  `S/ ${valor.toLocaleString('es-PE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

/** Campo de búsqueda de productos con lista de resultados. */
export const InventoryProductSearchSelect = ({
  productos,
  onElegir,
  placeholder = 'SKU o descripción del producto',
}: InventoryProductSearchSelectProps) => {
  const [texto, setTexto] = useState('');
  const [activo, setActivo] = useState(-1); const listaId = useId();

  const resultados = useMemo(
    () => filtrarProductos(productos.filter(p => p.vendible !== false), texto),
    [productos, texto],
  );

  return (
    <div className="relative space-y-1">
      <input
        data-invoice-product-search aria-label="Buscar producto" role="combobox" aria-expanded={resultados.length > 0} aria-controls={listaId} aria-activedescendant={activo >= 0 ? `${listaId}-${activo}` : undefined}
        className="h-9 w-full rounded-md border bg-background px-3 text-sm"
        value={texto}
        placeholder={placeholder}
        onChange={(e) => { setTexto(e.target.value); setActivo(-1); }}
        onKeyDown={e => { if (e.nativeEvent.isComposing) return;
          if (e.key === 'Escape') { e.preventDefault(); setTexto(''); setActivo(-1); }
          if (['ArrowDown','ArrowUp'].includes(e.key) && resultados.length) { e.preventDefault(); setActivo(prev => (prev + (e.key === 'ArrowDown' ? 1 : resultados.length - 1) + resultados.length) % resultados.length); }
          if (e.key === 'Enter' && activo >= 0 && resultados[activo]) { e.preventDefault(); onElegir(resultados[activo]); setTexto(''); setActivo(-1); }
        }}
      />

      {resultados.length > 0 && (
        <ul id={listaId} role="listbox" className="absolute z-20 mt-1 max-h-56 w-full overflow-y-auto rounded-md border bg-background shadow">
          {resultados.map((producto, indice) => (
            <li key={producto.sku} id={`${listaId}-${indice}`} role="option" aria-selected={activo === indice}>
              <button
                type="button"
                className="w-full px-3 py-2 text-left text-xs hover:bg-muted"
                onClick={() => {
                  onElegir(producto);
                  setTexto('');
                }}
              >
                <span className="block font-medium">
                  {producto.sku} · {producto.descripcion}
                </span>
                <span className="block text-muted-foreground">
                  {producto.unidad} · {soles(producto.precioUnitario ?? producto.valorUnitario)} (precio final)
                  {producto.stock !== undefined
                    ? ` · stock ${producto.stock}`
                    : ''}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {texto.trim().length >= MINIMO_CARACTERES && resultados.length === 0 && (
        <PageText variant="caption">
          Ningún producto coincide. Puede escribirlo a mano en la línea.
        </PageText>
      )}
    </div>
  );
};
