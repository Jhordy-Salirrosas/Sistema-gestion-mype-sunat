/**
 * Grilla de ítems del formulario de emisión (TA-64).
 *
 * Reemplaza el campo único "Descripción del ítem" y "Monto base imponible" por
 * una tabla editable: una factura real de ferretería lleva varias líneas con
 * afectaciones distintas, y antes no había forma de emitirla desde la pantalla.
 *
 * La lógica de cálculo y validación NO vive aquí: está en `../lib/invoiceItems`
 * para poder probarla sin montar React.
 */
import { Fragment, useState } from 'react';
import { Button, PageText } from '@/components/ui';
import { InventoryProductSearchSelect } from './InventoryProductSearchSelect';
import {
  UNIDADES_MEDIDA,
  calcularItem,
  esLineaBolsa,
  type ItemBorrador,
} from '../lib/invoiceItems';
import { CODIGOS_DETRACCION } from '../lib/invoiceDetraccion';
import { revisarGrilla } from '../lib/invoiceStockLinea';
import type { ProductoBuscado } from '../lib/invoiceSearch';
import { ICBPER_POR_UNIDAD, type AfectacionIgv } from '../lib/invoiceTaxes';

const OPCIONES_AFECTACION: readonly { value: AfectacionIgv; label: string }[] = [
  { value: 'GRAVADA', label: '10 - Gravada onerosa (tributo 1000 - IGV)'  },
  { value: 'EXONERADA', label: '20 - Exonerada (tributo 9997 - Exonerado)'  },
  { value: 'INAFECTA', label: '30 - Inafecta (tributo 9998 - Inafecto)'  },
  { value: 'GRATUITA', label: '11 - Retiro por premio (tributo 1000 - IGV)'  },
];

const CLASE_CELDA =
  'h-8 w-full rounded border bg-background px-2 text-xs text-foreground';

interface InvoiceItemsGridProps {
  items: readonly ItemBorrador[];
  onCambiar: (indice: number, parcial: Partial<ItemBorrador>) => void;
  onEliminar: (indice: number) => void;
  onAgregar: () => void;
  onAgregarBolsa: () => void;
  /**
   * TA-61: productos del almacén para el buscador.
   *
   * Si la lista viene vacía el buscador NO se pinta: un campo de búsqueda que
   * nunca encuentra nada es peor que no tenerlo, porque el usuario cree que el
   * catálogo está vacío cuando puede ser que no haya conexión con Inventarios.
   */
  productos?: readonly ProductoBuscado[];
  /** TA-61: agrega una línea nueva con los datos del producto elegido. */
  onAgregarConProducto?: (producto: ProductoBuscado) => void;
}

/** Tabla editable de líneas del comprobante. */
export const InvoiceItemsGrid = ({
  items,
  onCambiar,
  onEliminar,
  onAgregar,
  onAgregarBolsa,
  productos = [],
  onAgregarConProducto,
}: InvoiceItemsGridProps) => {
  const [avisoMinimo, setAvisoMinimo] = useState(false);
  /**
   * Revisión contra el stock del almacén.
   *
   * El docente lo pidió con estas palabras: "la cantidad tiene que ser validada
   * dependiendo de lo que tienes". Se calcula aquí y no en la página para que el
   * aviso aparezca junto a la línea que lo causa, no en un bloque al final de
   * una grilla de diez filas.
   */
  const revision = revisarGrilla(items, productos);

  return (
    <div className="min-w-0 space-y-2 sm:col-span-2">
      {avisoMinimo && items.length === 1 && <PageText role="alert" variant="error">Debe quedar al menos una línea</PageText>}
      <div className="flex items-center justify-between">
        <PageText variant="label">Detalle del comprobante</PageText>
        <PageText variant="caption">
          {items.length} {items.length === 1 ? 'línea' : 'líneas'}
        </PageText>
      </div>

      {/*
        TA-64 + TA-61: buscador de productos DENTRO de la grilla.

        Las dos tareas se hicieron en ramas distintas y el buscador quedó
        montado solo en el formulario de la emisión, mientras la grilla de
        múltiples líneas seguía obligando a teclear el SKU a mano. Aquí se
        conectan: al elegir un producto se arrastran su código, descripción,
        unidad y valor unitario a una línea nueva, que es justo lo que se
        digitaba mal.
      */}
      {productos.length > 0 && onAgregarConProducto ? (
        <InventoryProductSearchSelect
          productos={productos}
          onElegir={(producto) => {
            onAgregarConProducto(producto);
          }}
          placeholder="Buscar por SKU o descripción para agregar una línea"
        />
      ) : null}

      <div className="max-w-full overflow-x-auto rounded-lg border" role="region" aria-label="Líneas del comprobante" tabIndex={0}>
        {/* Una sola tabla mantiene cabecera y filas alineadas al desplazarse.
            Los anchos reservan espacio para los textos completos de los selects. */}
        <table className="w-full min-w-[1768px] table-fixed text-xs">
          <colgroup>
            {[120, 280, 80, 100, 120, 210, 150, 340, 110, 110, 48].map((ancho, indice) => (
              <col key={indice} style={{ width: ancho }} />
            ))}
          </colgroup>
          <thead className="bg-muted/60 text-[11px] uppercase">
            <tr>
              <th className="px-2 py-1 text-left">Código</th>
              <th className="px-2 py-1 text-left">Descripción</th>
              <th className="px-2 py-1 text-left">Und.</th>
              <th className="px-2 py-1 text-right">Cant.</th>
              <th className="px-2 py-1 text-right">V. unit.</th>
              <th className="px-2 py-1 text-left">Descuento (Cat. 53)</th>
              <th className="px-2 py-1 text-right">ICBPER</th>
              <th className="px-2 py-1 text-left">Afectación (Cat. 07) / tributo (Cat. 05)</th>
              <th className="px-2 py-1 text-left">Detrac.</th>
              <th className="px-2 py-1 text-right">Total</th>
              <th className="px-2 py-1" />
            </tr>
          </thead>
          <tbody>
            {items.map((item, i) => {
              const totales = calcularItem(item);
              const revisionLinea = revision.lineas[i];
              const conError = revisionLinea?.gravedad === 'error';
              return (
                <Fragment key={item.clave}>
                <tr
                  className={`border-t align-top ${
                    conError ? 'bg-destructive/5' : ''
                  }`}
                >
                  <td className="px-1 py-1">
                    <input
                      aria-label={`Código de la línea ${i + 1}`}
                      className={CLASE_CELDA}
                      value={item.codigo}
                      onChange={(e) => onCambiar(i, { codigo: e.target.value })}
                      placeholder="COD-001"
                    />
                  </td>
                  <td className="px-1 py-1">
                    <input
                      aria-label={`Descripción de la línea ${i + 1}`}
                      className={CLASE_CELDA}
                      value={item.descripcion}
                      onChange={(e) =>
                        onCambiar(i, { descripcion: e.target.value })
                      }
                      placeholder="Cemento Portland tipo I"
                    />
                    {/* El aviso va bajo la línea que lo provoca, no como una
                        lista al pie: en diez filas nadie sabe qué corregir. */}
                    {revisionLinea && revisionLinea.gravedad !== 'ok' && (
                      <p
                        className={`mt-1 text-[10px] leading-tight ${
                          conError
                            ? 'font-medium text-destructive'
                            : 'text-amber-600 dark:text-amber-400'
                        }`}
                      >
                        {revisionLinea.mensaje}
                      </p>
                    )}
                  </td>
                  <td className="px-1 py-1">
                    <select
                      aria-label={`Unidad de la línea ${i + 1}`}
                      className={CLASE_CELDA}
                      value={item.unidad}
                      onChange={(e) => onCambiar(i, { unidad: e.target.value })}
                    >
                      {UNIDADES_MEDIDA.map((u) => (
                        <option key={u.codigo} value={u.codigo}>
                          {u.codigo}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-1 py-1">
                    <input
                      aria-label={`Cantidad de la línea ${i + 1}`}
                      type="number"
                      min="0"
                      step="0.01"
                      className={`${CLASE_CELDA} text-right`}
                      value={item.cantidad}
                      onChange={(e) =>
                        onCambiar(i, { cantidad: Number(e.target.value) })
                      }
                    />
                  </td>
                  <td className="px-1 py-1">
                    <input
                      aria-label={`Valor unitario de la línea ${i + 1}`}
                      type="number"
                      min="0"
                      step="0.01"
                      className={`${CLASE_CELDA} text-right`}
                      value={item.valorUnitario}
                      onChange={(e) =>
                        onCambiar(i, { valorUnitario: Number(e.target.value) })
                      }
                    />
                  </td>
                  <td className="px-1 py-1">
                    <select aria-label={`Tipo de descuento de la línea ${i + 1}`} className={CLASE_CELDA}
                      value={item.descuento?.codigo ?? ''}
                      onChange={(e) => onCambiar(i, { descuento: e.target.value ? { codigo: e.target.value as '00' | '01', monto: item.descuento?.monto ?? 0 } : null })}>
                      <option value="">Sin descuento</option>
                      <option value="00">00 - Afecta base IGV</option>
                      <option value="01">01 - No afecta base IGV</option>
                    </select>
                    {item.descuento && <input aria-label={`Monto de descuento de la línea ${i + 1}`} type="number" min="0" step="0.01" className={`${CLASE_CELDA} text-right`} value={item.descuento.monto} onChange={(e) => onCambiar(i, { descuento: { ...item.descuento!, monto: Number(e.target.value) } })} />}
                    {item.descuento && item.descuento.monto > item.cantidad * item.valorUnitario && <p role="alert" className="text-xs text-destructive">El descuento no puede superar el valor de la línea.</p>}
                    {item.descuento?.codigo === '01' && <p className="text-xs text-amber-700">El asiento automático utiliza la cuenta 74. Podría quedar pendiente de revisión si la cuenta no está activa en el plan de la empresa o los importes no concuerdan.</p>}
                  </td>
                  <td className="px-1 py-1">
                    <input
                      aria-label={`ICBPER de la línea ${i + 1}`}
                      type="number"
                      min="0"
                      step={esLineaBolsa(item) ? '0.5' : '1'}
                      className={`${CLASE_CELDA} text-right`}
                      value={esLineaBolsa(item) ? item.icbper : item.icbper / ICBPER_POR_UNIDAD}
                      onChange={(e) =>
                        onCambiar(i, { icbper: esLineaBolsa(item) ? Number(e.target.value) : Math.max(0, Math.floor(Number(e.target.value))) * ICBPER_POR_UNIDAD })
                      }
                    />
                    {!esLineaBolsa(item) && <span className="text-[10px]">Cantidad de bolsas · S/ 0.50 c/u</span>}
                  </td>
                  <td className="px-1 py-1">
                    <select
                      aria-label={`Afectación de la línea ${i + 1}`}
                      className={CLASE_CELDA}
                      value={item.afectacion}
                      onChange={(e) =>
                        onCambiar(i, {
                          afectacion: e.target.value as AfectacionIgv,
                        })
                      }
                    >
                      {OPCIONES_AFECTACION.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-1 py-1">
                    <select
                      aria-label={`Detracción de la línea ${i + 1}`}
                      className={CLASE_CELDA}
                      value={item.codigoDetraccion ?? ''}
                      onChange={(e) =>
                        onCambiar(i, {
                          codigoDetraccion: e.target.value || undefined,
                        })
                      }
                    >
                      <option value="">No sujeta</option>
                      {CODIGOS_DETRACCION.map((d) => (
                        <option key={d.codigo} value={d.codigo}>
                          {d.codigo} - {d.porcentaje * 100}%
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-2 py-1 text-right tabular-nums">
                    {totales.total.toFixed(2)}
                  </td>
                  <td className="px-1 py-1 text-right">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      aria-label={`Eliminar la línea ${i + 1}`}
                      onClick={() => { if (items.length === 1) setAvisoMinimo(true); else { setAvisoMinimo(false); onEliminar(i); } }}
                    >
                      ✕
                    </Button>
                  </td>
                </tr>
                {item.valorUnitario === 0 && item.afectacion !== 'GRATUITA' && (
                  <tr className={conError ? 'bg-destructive/5' : ''}>
                    <td colSpan={11} className="px-2 pb-2">
                      <p className="text-xs text-amber-700">El valor unitario es cero; revise la afectación de la línea.</p>
                    </td>
                  </tr>
                )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="outline" size="sm" onClick={onAgregar}>
          + Añadir ítem
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={onAgregarBolsa}>
          + Bolsa plástica (ICBPER)
        </Button>
      </div>

      {/* Resumen de la validación contra el almacén: dice cuántas líneas se
          comprobaron de verdad, para no dar a entender que un producto que no
          está en el inventario también fue validado. */}
      {revision.errores > 0 && (
        <p className="text-[11px] font-medium text-destructive">
          {revision.errores === 1
            ? 'Hay 1 línea que supera el stock disponible.'
            : `Hay ${revision.errores} líneas que superan el stock disponible.`}{' '}
          No se puede emitir así: el almacén tiene que respaldar la cantidad.
        </p>
      )}
      {revision.errores === 0 && revision.validadas > 0 && (
        <p className="text-[11px] text-muted-foreground">
          Stock comprobado en {revision.validadas}{' '}
          {revision.validadas === 1 ? 'línea' : 'líneas'} del almacén.
        </p>
      )}
    </div>
  );
};
