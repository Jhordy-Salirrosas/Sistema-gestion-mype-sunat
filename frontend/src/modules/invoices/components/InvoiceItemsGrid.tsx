import { erroresCamposLinea } from '../lib/invoiceLineFields';
import { cantidadBolsasDe, errorBolsas, bolsasBloqueadasEnBoleta, BOLETA_GRATUITA_BOLSAS } from '../lib/invoiceBags';
import { NOMBRES_AFECTACION } from '../lib/invoiceTributosXml';
import { normalizarAfectacionProducto } from '../lib/invoiceItems';
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
import { useInvoiceDuplicate } from './useInvoiceDuplicate';
import { InvoiceIntegerInput } from './InvoiceIntegerInput';
import { InvoiceMoneyInput } from './InvoiceMoneyInput';
import { Fragment, useRef, useState } from 'react';
import { Button, PageText } from '@/components/ui';
import { InventoryProductSearchSelect } from './InventoryProductSearchSelect';
import {
  calcularItem,
  cantidadValidaParaUnidad,
  unidadDiscreta,
  type ItemBorrador,
} from '../lib/invoiceItems';
import { CODIGOS_DETRACCION } from '../lib/invoiceDetraccion';
import { revisarGrilla } from '../lib/invoiceStockLinea';
import type { ProductoBuscado } from '../lib/invoiceSearch';

const OPCIONES_GRATUITAS = Object.entries(NOMBRES_AFECTACION).filter(([codigo]) => { try { return normalizarAfectacionProducto(codigo) === 'GRATUITA'; } catch { return false; } });

const CLASE_CELDA =
  'h-8 min-w-0 w-full rounded border bg-background px-2 text-xs text-foreground';

interface InvoiceItemsGridProps {
  codigoSoloCatalogo?: boolean;
  mostrarErrores?: boolean;
  tipo?: string;
  cantidadesMaximas?: readonly number[];
  items: readonly ItemBorrador[];
  onCambiar: (indice: number, parcial: Partial<ItemBorrador>) => void;
  onEliminar: (indice: number) => void;
  onAgregar?: () => void;
  onAgregarBolsa?: (indice: number) => void;
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
  /** Si el cliente admite descuentos según el maestro de terceros (true por defecto en uso aislado). */
  admiteDescuento?: boolean;
  esNota?: boolean;
  catalogoEstado?: 'listo' | 'cargando' | 'error';
}

/** Tabla editable de líneas del comprobante. */
export const InvoiceItemsGrid = ({
  items,
  tipo = '01',
  mostrarErrores = false,
  onCambiar,
  onEliminar,
  productos = [],
  onAgregarConProducto,
  admiteDescuento = true,
  cantidadesMaximas,
  esNota = false, catalogoEstado = 'listo',
}: InvoiceItemsGridProps) => {
  const grillaRef = useRef<HTMLDivElement>(null);
  const [editados, setEditados] = useState<ReadonlySet<string>>(new Set());
  const marcarCampo = (clave: string, target: EventTarget) => {
    const campo = (target as HTMLElement).dataset.lineField;
    if (campo) setEditados(previo => new Set(previo).add(`${clave}:${campo}`));
  };
  const bolsasBloqueadas = bolsasBloqueadasEnBoleta(tipo, items);
  const [productoBolsas, setProductoBolsas] = useState('');
  const destinoBolsas = items.findIndex(item => item.clave === productoBolsas && item.codigo.trim());
  const indiceBolsas = destinoBolsas >= 0 ? destinoBolsas : items.findIndex(item => item.codigo.trim());
  /**
   * Revisión contra el stock del almacén.
   *
   * El docente lo pidió con estas palabras: "la cantidad tiene que ser validada
   * dependiendo de lo que tienes". Se calcula aquí y no en la página para que el
   * aviso aparezca junto a la línea que lo causa, no en un bloque al final de
   * una grilla de diez filas.
   */
  const duplicado = useInvoiceDuplicate(items, onCambiar, onEliminar, onAgregarConProducto, esNota);
  const revision = revisarGrilla(items, productos, { nota: esNota, estado: catalogoEstado });

  return (
    <div ref={grillaRef} className="min-w-0 space-y-2 sm:col-span-2">
      {duplicado.dialogo}
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
            duplicado.elegir(producto);
          }}
          placeholder="Buscar por SKU o descripción para agregar una línea"
        />
      ) : onAgregarConProducto ? (
        <p data-invoice-product-status role="status" tabIndex={-1} className="rounded border p-2 text-sm">
          {catalogoEstado === 'cargando' ? 'Cargando productos del almacén. Espere para buscar y seleccionar.'
            : catalogoEstado === 'error' ? 'No se pudo cargar el catálogo del almacén. Vuelva a intentar antes de seleccionar un producto.'
            : 'No hay productos disponibles en el almacén para seleccionar.'}
        </p>
      ) : null}

      <div className="max-w-full rounded-lg" role="region" aria-label="Líneas del comprobante" tabIndex={0}>
        <table className="block w-full text-xs">
          <thead className="sr-only">
            <tr>
              <th className="px-2 py-1 text-left">Código</th>
              <th className="px-2 py-1 text-left">Descripción</th>
              <th className="px-2 py-1 text-left">Und.</th>
              <th className="px-2 py-1 text-right">Cant.</th>
              <th className="px-2 py-1 text-right">Valor unitario (sin IGV)</th>
              <th className="px-2 py-1 text-left">Descuento (Cat. 53)</th>
              <th className="px-2 py-1 text-right">ICBPER</th>
              <th className="px-2 py-1 text-left">Afectación (Cat. 07) / tributo (Cat. 05)</th>
              <th className="px-2 py-1 text-left">Detrac.</th>
              <th className="px-2 py-1 text-right">Total</th>
              <th className="px-2 py-1" />
            </tr>
          </thead>
          <tbody className="block space-y-3">
            {items.map((item, i) => {
              const errores = erroresCamposLinea(item, esNota);
              const codigoAfectacion = item.codigoAfectacion || ({ GRAVADA: '10', EXONERADA: '20', INAFECTA: '30' } as Record<string, string>)[item.afectacion];
              const tributo = codigoAfectacion === '40' ? '9995 - Exportación' : item.afectacion === 'GRAVADA' ? '1000 - IGV' : item.afectacion === 'EXONERADA' ? '9997 - Exonerado' : '9998 - Inafecto';
              const visible = (campo: keyof typeof errores) => Boolean(errores[campo]) && (mostrarErrores || editados.has(`${item.clave}:${campo}`));
              const totales = calcularItem(item);
              const revisionLinea = revision.lineas[i];
              const conError = revisionLinea?.gravedad === 'error';
              return (
                <Fragment key={item.clave}>
                <tr
                  onChangeCapture={e => marcarCampo(item.clave, e.target)} onBlurCapture={e => marcarCampo(item.clave, e.target)}
                  className={`grid grid-cols-[repeat(auto-fit,minmax(min(100%,220px),1fr))] gap-2 rounded-lg border p-3 ${
                    conError ? 'bg-destructive/5' : ''
                  }`}
                >
                  <td className="block min-w-0 space-y-1 break-words"><span className="block font-medium text-muted-foreground">Código</span>
                    <textarea rows={1}
                      aria-label={`Código de la línea ${i + 1}`}
                      className={`${CLASE_CELDA} h-auto min-h-8 resize-none [field-sizing:content]`}
                      readOnly
                      title="Para cambiar el SKU, quite la línea o elija otro producto del catálogo."
                      value={item.codigo}
                      placeholder="COD-001"
                    />
                  </td>
                  <td className="block min-w-0 space-y-1 break-words"><span className="block font-medium text-muted-foreground">Descripción</span>
                    <textarea rows={1}
                      aria-label={`Descripción de la línea ${i + 1}`} aria-invalid={visible('descripcion')} data-line-field="descripcion" data-line-invalid={Boolean(errores.descripcion)} aria-describedby={visible('descripcion') ? `${item.clave}-descripcion-error` : undefined}
                      className={`${CLASE_CELDA} h-auto min-h-8 resize-none [field-sizing:content]`}
                      maxLength={500}
                      value={item.descripcion}
                      readOnly
                      placeholder="Cemento Portland tipo I"
                    />
                    {visible('descripcion') && <p id={`${item.clave}-descripcion-error`} role="alert" className="text-xs text-destructive">{errores.descripcion}</p>}
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
                  <td className="block min-w-0 space-y-1 break-words"><span className="block font-medium text-muted-foreground">Unidad</span>
                    <input aria-label={`Unidad de la línea ${i + 1}`} className={CLASE_CELDA}
                      value={item.unidad} readOnly title="Unidad registrada del producto" />
                  </td>
                  <td className="block min-w-0 space-y-1 break-words"><span className="block font-medium text-muted-foreground">Cantidad</span>
                    {!esNota && unidadDiscreta(item.unidad) ? <InvoiceIntegerInput
                      aria-label={`Cantidad de la línea ${i + 1}`} data-line-field="cantidad" data-line-invalid={Boolean(errores.cantidad)}
                      aria-describedby={visible('cantidad') ? `${item.clave}-cantidad-error` : undefined}
                      aria-invalid={Boolean(errores.cantidad) || (cantidadesMaximas !== undefined && item.cantidad > cantidadesMaximas[i])}
                      className={`${CLASE_CELDA} text-right`} value={item.cantidad}
                      onValue={cantidad => onCambiar(i, { cantidad })} /> : (
                    <input
                      aria-label={`Cantidad de la línea ${i + 1}`} data-line-field="cantidad" data-line-invalid={Boolean(errores.cantidad)} aria-describedby={visible('cantidad') ? `${item.clave}-cantidad-error` : undefined}
                      max={cantidadesMaximas?.[i]}
                      aria-invalid={!cantidadValidaParaUnidad(item.cantidad, item.unidad, esNota) || (cantidadesMaximas !== undefined && item.cantidad > cantidadesMaximas[i])}
                      type="number"
                      min="0.001"
                      step="0.001"
                      className={`${CLASE_CELDA} text-right`}
                      value={item.cantidad}
                      onChange={(e) =>
                        onCambiar(i, { cantidad: Number(e.target.value) })
                      }
                    />
                    )}
                    {visible('cantidad') && <p id={`${item.clave}-cantidad-error`} role="alert" className="text-xs text-destructive">{errores.cantidad}</p>}
                    {cantidadesMaximas !== undefined && item.cantidad > cantidadesMaximas[i] && <p role="alert" className="text-xs text-destructive">Supera las unidades disponibles del origen (máximo {cantidadesMaximas[i]}).</p>}
                  </td>
                  <td className="block min-w-0 space-y-1 break-words"><span className="block font-medium text-muted-foreground">Valor unitario (sin IGV)</span>
                    <input type="text" aria-label={`Valor unitario de la línea ${i + 1}`} aria-invalid={visible('valorUnitario')} data-line-field="valorUnitario" data-line-invalid={Boolean(errores.valorUnitario)} aria-describedby={visible('valorUnitario') ? `${item.clave}-valorUnitario-error` : undefined} title={item.afectacion === 'GRATUITA' ? 'Valor referencial' : 'Valor unitario sin IGV'}
                      className={`${CLASE_CELDA} text-right`} value={item.valorUnitario.toFixed(2)}
                      readOnly />
                    {visible('valorUnitario') && <p id={`${item.clave}-valorUnitario-error`} role="alert" className="text-xs text-destructive">{errores.valorUnitario}</p>}
                    <span className="block text-right text-[10px] text-muted-foreground">
                      {item.afectacion === 'GRATUITA' ? 'Valor referencial · precio cobrado S/ 0.00' : 'Valor unitario sin IGV'}
                    </span>
                  </td>
                  <td className="block min-w-0 space-y-1 break-words"><span className="block font-medium text-muted-foreground">Descuento (Cat. 53)</span>
                    <select aria-label={`Tipo de descuento de la línea ${i + 1}`} className={CLASE_CELDA}
                      disabled={!admiteDescuento}
                      value={item.descuento?.codigo ?? ''}
                      onChange={(e) => onCambiar(i, { descuento: e.target.value ? { codigo: e.target.value as '00' | '01', monto: item.descuento?.monto ?? 0 } : null })}>
                      <option value="">Sin descuento</option>
                      <option value="00">00 - Afecta base IGV</option>
                      <option value="01">01 - No afecta base IGV</option>
                    </select>
                    {item.descuento && <InvoiceMoneyInput aria-label={`Monto de descuento de la línea ${i + 1}`} disabled={!admiteDescuento} className={`${CLASE_CELDA} text-right`} value={item.descuento.monto} onValue={monto => onCambiar(i, { descuento: { ...item.descuento!, monto } })} />}
                    {item.descuento && item.descuento.monto > item.cantidad * item.valorUnitario && <p role="alert" className="text-xs text-destructive">El descuento no puede superar el valor de la línea.</p>}
                    {item.descuento?.codigo === '01' && <p className="text-xs text-amber-700">El asiento automático utiliza la cuenta 74. Podría quedar pendiente de revisión si la cuenta no está activa en el plan de la empresa o los importes no concuerdan.</p>}
                  </td>
                  <td className="block min-w-0 space-y-1 break-words"><span className="block font-medium text-muted-foreground">ICBPER</span>
                    <InvoiceIntegerInput
                      disabled={bolsasBloqueadas}
                      data-invoice-bags aria-label={`ICBPER de la línea ${i + 1}`}
                      aria-invalid={Boolean(errorBolsas(item))}
                      className={`${CLASE_CELDA} text-right`}
                      value={cantidadBolsasDe(item)}
                      onValue={cantidadBolsas => onCambiar(i, { cantidadBolsas })}
                    />
                    <span className="text-[10px]">Cantidad de bolsas · S/ 0.50 c/u</span>
                    {errorBolsas(item) && <p role="alert" className="text-xs text-destructive">{errorBolsas(item)}</p>}
                  </td>
                  <td className="block min-w-0 space-y-1 break-words"><span className="block font-medium text-muted-foreground">Afectación (Cat. 07) / tributo (Cat. 05)</span>
                    {!esNota && <label className="block"><input type="checkbox" aria-label={`Gratuita de la línea ${i + 1}`} checked={item.afectacion === 'GRATUITA'} disabled={item.afectacion === 'GRATUITA' && !item.origenOneroso} onChange={e => {
                      if (e.target.checked) onCambiar(i, { origenOneroso: { afectacion: item.afectacion, codigoAfectacion: item.codigoAfectacion, precioUnitario: item.precioUnitario, valorUnitario: item.valorUnitario }, afectacion: 'GRATUITA', codigoAfectacion: '', precioUnitario: 0, valorUnitario: item.valorUnitario, descuento: null });
                      else if (item.origenOneroso) onCambiar(i, { ...item.origenOneroso, origenOneroso: undefined });
                    }} /> Gratuita</label>}
                    {item.afectacion === 'GRATUITA' ? <select aria-label={`Motivo de gratuidad de la línea ${i + 1}`} className={CLASE_CELDA} value={item.codigoAfectacion ?? ''} disabled={esNota} onChange={e => onCambiar(i, { codigoAfectacion: e.target.value })}>
                      <option value="">Seleccione el motivo</option>
                      {OPCIONES_GRATUITAS.map(([codigo, nombre]) => <option key={codigo} value={codigo}>{codigo} - {nombre}</option>)}
                    </select> : <p aria-label={`Afectación de la línea ${i + 1}`} className="rounded border bg-muted/30 px-2 py-1 text-xs break-words">
                      {codigoAfectacion} - {NOMBRES_AFECTACION[codigoAfectacion] ?? item.afectacion}
                      {' · Tributo '}{tributo}
                    </p>}

                  </td>
                  <td className="block min-w-0 space-y-1 break-words"><span className="block font-medium text-muted-foreground">Detracción</span>
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
                      {CODIGOS_DETRACCION.filter(d => d.codigo === '009').map((d) => (
                        <option key={d.codigo} value={d.codigo}>
                          {d.codigo} - {d.porcentaje * 100}%
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="block min-w-0 space-y-1 break-words"><span className="block font-medium text-muted-foreground">Total</span>
                    {totales.total.toFixed(2)}
                  </td>
                  <td className="block min-w-0 space-y-1 break-words"><span className="block font-medium text-muted-foreground">Acciones</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      aria-label={`Eliminar la línea ${i + 1}`}
                      onClick={() => onEliminar(i)}
                    >
                      ✕
                    </Button>
                  </td>
                </tr>
                {item.valorUnitario === 0 && !esNota && item.afectacion !== 'GRATUITA' && !visible('valorUnitario') && (
                  <tr className={conError ? 'bg-destructive/5' : ''}>
                    <td colSpan={11} className="block px-2 pb-2">
                      <p className="text-xs text-amber-700">El valor unitario de una línea onerosa debe ser mayor que cero.</p>
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
        <label className="min-w-0 max-w-full text-xs">Producto para bolsas<select className="max-w-full" aria-label="Producto para bolsas" value={items[indiceBolsas]?.clave ?? ''} onChange={e => {
          setProductoBolsas(e.target.value);
          const indice = items.findIndex(item => item.clave === e.target.value);
          const campo = grillaRef.current?.querySelectorAll<HTMLInputElement>('[data-invoice-bags]')[indice];
          campo?.focus(); campo?.scrollIntoView?.({ block: 'nearest' });
        }}>
          {indiceBolsas < 0 && <option value="">Seleccione un producto en la grilla</option>}
          {items.filter(item => item.codigo.trim()).map(item => <option key={item.clave} value={item.clave}>{item.codigo} · {item.descripcion}</option>)}
        </select></label>

      </div>

      {bolsasBloqueadas && <div><p role="alert" className="text-xs text-destructive">{BOLETA_GRATUITA_BOLSAS}</p><Button type="button" variant="outline" size="sm" onClick={() => items.forEach((_, i) => onCambiar(i, { cantidadBolsas: 0, icbper: 0 }))}>Retirar bolsas de la boleta</Button></div>}

      {/* Resumen de la validación contra el almacén: dice cuántas líneas se
          comprobaron de verdad, para no dar a entender que un producto que no
          está en el inventario también fue validado. */}
      {revision.errores > 0 && (
        <p className="text-[11px] font-medium text-destructive">
          {revision.errores === 1
            ? 'Hay 1 línea que supera el stock disponible.'
            : `Hay ${revision.errores} líneas que superan el stock disponible.`}{' '}
          La emisión requiere existencias suficientes para las cantidades indicadas.
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
