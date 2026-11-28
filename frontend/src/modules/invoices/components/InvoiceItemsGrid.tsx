import './invoiceIntegratedFields.css';
import { InlineInvoiceError } from './InvoiceFormFeedback';
import { ChevronDown, CircleAlert } from 'lucide-react';
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
  type ItemBorrador,
} from '../lib/invoiceItems';
import { CODIGOS_DETRACCION } from '../lib/invoiceDetraccion';
import { revisarGrilla } from '../lib/invoiceStockLinea';
import type { ProductoBuscado } from '../lib/invoiceSearch';

const OPCIONES_GRATUITAS = Object.entries(NOMBRES_AFECTACION).filter(([codigo]) => { try { return normalizarAfectacionProducto(codigo) === 'GRATUITA'; } catch { return false; } });

const CLASE_FILA = 'grid grid-cols-16 items-start gap-x-2 gap-y-3 @min-[1000px]/items:grid-cols-[minmax(9rem,1.5fr)_3.5rem_3.5rem_6.5rem_3rem_minmax(14rem,2fr)_5.5rem_4.5rem_2rem]';

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
  const [enEdicion,setEnEdicion]=useState('');
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
    <div ref={grillaRef} className="invoice-items-integrated @container/items min-w-0 space-y-2 sm:col-span-2">
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

      <div className="max-w-full overflow-x-hidden rounded-lg" role="region" aria-label="Líneas del comprobante" tabIndex={0}>
        <table className="block w-full text-xs">
          <thead className="hidden border-b @min-[1000px]/items:block bg-muted/40 text-[11px] text-muted-foreground">
            <tr className={CLASE_FILA}>
              <th scope="col" className="col-span-3 min-w-0 px-1 py-2 text-left font-medium [overflow-wrap:anywhere] @min-[1000px]/items:col-span-1">Producto</th>
              <th scope="col" className="col-span-2 min-w-0 px-1 py-2 text-right font-medium [overflow-wrap:anywhere] @min-[1000px]/items:col-span-1">Cant.</th>
              <th scope="col" className="col-span-2 min-w-0 px-1 py-2 text-right font-medium [overflow-wrap:anywhere] @min-[1000px]/items:col-span-1" aria-label="Valor unitario (sin IGV)" title="Valor unitario sin IGV">V.U.</th>
              <th scope="col" className="col-span-3 min-w-0 px-1 py-2 text-left font-medium [overflow-wrap:anywhere] @min-[1000px]/items:col-span-1">Desc. Cat. 53</th>
              <th scope="col" className="col-span-2 min-w-0 px-1 py-2 text-right font-medium [overflow-wrap:anywhere] @min-[1000px]/items:col-span-1" title="Cantidad de bolsas · S/ 0.50 c/u">Bolsas</th>
              <th scope="col" className="col-span-5 min-w-0 px-1 py-2 text-left font-medium [overflow-wrap:anywhere] @min-[1000px]/items:col-span-1">Afectación</th>
              <th scope="col" className="col-span-3 min-w-0 px-1 py-2 text-left font-medium [overflow-wrap:anywhere] @min-[1000px]/items:col-span-1">Detracción</th>
              <th scope="col" className="col-span-2 min-w-0 px-1 py-2 text-right font-medium [overflow-wrap:anywhere] @min-[1000px]/items:col-span-1">Total</th>
              <th scope="col" className="col-span-2 min-w-0 px-0 py-2 text-right font-medium @min-[1000px]/items:col-span-1" aria-label="Acciones"></th>
            </tr>
          </thead>
          <tbody className="block space-y-3 @min-[1000px]/items:space-y-0 @min-[1000px]/items:divide-y">
            {items.map((item, i) => {
              const errores = erroresCamposLinea(item, esNota);
              const codigoAfectacion = item.codigoAfectacion || ({ GRAVADA: '10', EXONERADA: '20', INAFECTA: '30' } as Record<string, string>)[item.afectacion];
              const tributo = codigoAfectacion === '40' ? '9995 - Exportación' : item.afectacion === 'GRAVADA' ? '1000 - IGV' : item.afectacion === 'EXONERADA' ? '9997 - Exonerado' : '9998 - Inafecto';
              const visible = (campo: keyof typeof errores) => Boolean(errores[campo]) && enEdicion!==`${item.clave}:${campo}` && (mostrarErrores || editados.has(`${item.clave}:${campo}`));
              const totales = calcularItem(item);
              const revisionLinea = revision.lineas[i];
              const conError = revisionLinea?.gravedad === 'error';
              const mostrarBolsas = i === indiceBolsas || cantidadBolsasDe(item) !== 0 || Boolean(errorBolsas(item));
              return (
                <Fragment key={item.clave}>
                <tr
                  onFocusCapture={e=>{const campo=(e.target as HTMLElement).dataset.lineField;setEnEdicion(`${item.clave}:${campo}`);if(campo)setEditados(v=>new Set([...v].filter(k=>k!==`${item.clave}:${campo}`)));}} onBlurCapture={e => {setEnEdicion('');marcarCampo(item.clave, e.target);}}
                  className={`${CLASE_FILA} rounded-lg border p-3 @min-[1000px]/items:rounded-none @min-[1000px]/items:border-0 @min-[1000px]/items:p-0 ${
                    conError && (mostrarErrores || editados.has(`${item.clave}:cantidad`)) ? 'bg-destructive/5' : ''
                  }`}
                >
                  <td className="col-span-11 col-start-1 row-start-1 min-w-0 px-0 py-0 align-top @min-[1000px]/items:col-span-1 @min-[1000px]/items:col-start-auto @min-[1000px]/items:row-start-auto @min-[1000px]/items:px-1 @min-[1000px]/items:py-2">
                    <div data-invoice-item-identity className="flex h-8 min-w-0 items-center gap-x-1 @min-[1000px]/items:block @min-[1000px]/items:h-auto" title={`${item.codigo || '—'} · ${item.descripcion || '—'} · ${item.unidad}`}>
                    <span
                      aria-label={`Código de la línea ${i + 1}`}
                      title="Para cambiar el SKU, quite la línea o elija otro producto del catálogo."
                      className="max-w-[45%] shrink-0 truncate font-mono font-semibold text-foreground @min-[1000px]/items:block @min-[1000px]/items:max-w-none @min-[1000px]/items:whitespace-normal @min-[1000px]/items:break-all @min-[1000px]/items:overflow-visible"
                    >
                      {item.codigo || '—'}
                    </span>
                      <span aria-hidden="true" className="shrink-0 text-muted-foreground @min-[1000px]/items:hidden">·</span>
                    <span
                      aria-label={`Descripción de la línea ${i + 1}`}
                      aria-invalid={visible('descripcion')}
                      data-line-field="descripcion"
                      data-line-invalid={Boolean(errores.descripcion)}
                      title={item.descripcion}
                      className="min-w-0 flex-1 truncate text-foreground @min-[1000px]/items:block @min-[1000px]/items:whitespace-normal @min-[1000px]/items:break-words @min-[1000px]/items:overflow-visible"
                    >
                      {item.descripcion || '—'}
                    </span>
                      <span aria-hidden="true" className="shrink-0 text-muted-foreground @min-[1000px]/items:hidden">·</span>
                      <div className="shrink-0 whitespace-nowrap text-[11px] text-muted-foreground @min-[1000px]/items:flex @min-[1000px]/items:flex-wrap @min-[1000px]/items:items-baseline @min-[1000px]/items:gap-x-1.5">
                    <span aria-label={`Unidad de la línea ${i + 1}`} title="Unidad registrada del producto" className="text-muted-foreground">
                      {item.unidad}
                    </span>
                  <span aria-hidden="true" className="hidden @min-[1000px]/items:inline">· V.U. {item.valorUnitario.toFixed(2)}</span></div>
                    </div>
                    {visible('descripcion') && <p id={`${item.clave}-descripcion-error`} role="alert" className="text-[11px] text-destructive"><CircleAlert aria-hidden="true" className="mr-1 inline h-3 w-3" />{errores.descripcion}</p>}
                    {revisionLinea && revisionLinea.gravedad === 'aviso' && (
                      <p className={`mt-0.5 text-[10px] leading-tight ${conError ? 'font-medium text-destructive' : 'text-amber-600 dark:text-amber-400'}`} title={revisionLinea.mensaje}>
                        {revisionLinea.mensaje}
                      </p>
                    )}
                  </td>

                  <td className="invoice-line-field col-span-4 col-start-1 row-start-2 min-w-0 px-0 py-0 align-top text-right @min-[1000px]/items:col-span-1 @min-[1000px]/items:col-start-auto @min-[1000px]/items:row-start-auto @min-[1000px]/items:px-1 @min-[1000px]/items:py-2">
                    <span aria-hidden="true" className="mb-1 block text-left text-[10px] font-medium text-muted-foreground @min-[1000px]/items:hidden">Cant.</span>
                    <InvoiceIntegerInput
                      aria-label={`Cantidad de la línea ${i + 1}`} data-line-field="cantidad" data-line-invalid={Boolean(errores.cantidad)}
                      min={1} max={cantidadesMaximas?.[i]}
                      aria-describedby={visible('cantidad') ? `${item.clave}-cantidad-error` : undefined}
                      aria-invalid={visible('cantidad') || (cantidadesMaximas !== undefined && item.cantidad > cantidadesMaximas[i])}
                      className={`${CLASE_CELDA} text-right`} value={item.cantidad}
                      onValue={cantidad => {
                        const descMonto = item.descuentoHeredado && item.descuentoPorcentaje
                          ? Number(((cantidad * item.valorUnitario * item.descuentoPorcentaje) / 100).toFixed(2))
                          : item.descuento?.monto;
                        onCambiar(i, {
                          cantidad,
                          ...(item.descuentoHeredado && item.descuento ? { descuento: { ...item.descuento, monto: descMonto ?? 0 } } : {}),
                        });
                      }} />
                    {revisionLinea?.gravedad==='error' && enEdicion!==`${item.clave}:cantidad` && (mostrarErrores||editados.has(`${item.clave}:cantidad`)) && <InlineInvoiceError mensaje={revisionLinea.mensaje}/>}
                    {visible('cantidad') && <p id={`${item.clave}-cantidad-error`} role="alert" className="text-[11px] text-destructive"><CircleAlert aria-hidden="true" className="mr-1 inline h-3 w-3" />{errores.cantidad}</p>}
                    {cantidadesMaximas !== undefined && item.cantidad > cantidadesMaximas[i] && <p role="alert" className="text-[11px] text-destructive">Supera las unidades disponibles del origen (máximo {cantidadesMaximas[i]}).</p>}
                  </td>

                  <td className="invoice-line-field col-span-4 col-start-5 row-start-2 min-w-0 px-0 py-0 align-top text-right @min-[1000px]/items:col-span-1 @min-[1000px]/items:col-start-auto @min-[1000px]/items:row-start-auto @min-[1000px]/items:px-1 @min-[1000px]/items:py-2">
                    <span aria-hidden="true" className="mb-1 block text-left text-[10px] font-medium text-muted-foreground @min-[1000px]/items:hidden">V.U.</span>
                    <span
                      aria-label={`Valor unitario de la línea ${i + 1}`}
                      aria-invalid={visible('valorUnitario')}
                      data-line-field="valorUnitario"
                      data-line-invalid={Boolean(errores.valorUnitario)}
                      title={item.afectacion === 'GRATUITA' ? 'Valor referencial · precio cobrado S/ 0.00' : 'Valor unitario sin IGV'}
                      className="block break-all py-2 tabular-nums text-foreground"
                    >
                      {item.valorUnitario.toFixed(2)}
                    </span>
                    {visible('valorUnitario') && <p id={`${item.clave}-valorUnitario-error`} role="alert" className="text-[11px] text-destructive"><CircleAlert aria-hidden="true" className="mr-1 inline h-3 w-3" />{errores.valorUnitario}</p>}
                  </td>

                  <td className="invoice-line-field col-span-4 col-start-9 row-start-2 min-w-0 px-0 py-0 align-top @min-[1000px]/items:col-span-1 @min-[1000px]/items:col-start-auto @min-[1000px]/items:row-start-auto @min-[1000px]/items:px-1 @min-[1000px]/items:py-2">
                    <span aria-hidden="true" className="mb-1 block text-left text-[10px] font-medium text-muted-foreground @min-[1000px]/items:hidden">Desc. Cat. 53</span>
                    <select aria-label={`Tipo de descuento de la línea ${i + 1}`} className={CLASE_CELDA}
                      disabled={!admiteDescuento || Boolean(item.descuentoHeredado)}
                      value={item.descuento?.codigo ?? ''}
                      onChange={(e) => onCambiar(i, { descuento: e.target.value ? { codigo: e.target.value as '00' | '01', monto: item.descuento?.monto ?? 0 } : null })}>
                      <option value="">Sin desc.</option>
                      <option value="00">00 - Base IGV</option>
                      <option value="01">01 - No base IGV</option>
                    </select>
                    {item.descuento && <InvoiceMoneyInput aria-label={`Monto de descuento de la línea ${i + 1}`} disabled={!admiteDescuento || Boolean(item.descuentoHeredado)} className={`${CLASE_CELDA} text-right`} value={item.descuento.monto} onValue={monto => onCambiar(i, { descuento: { ...item.descuento!, monto } })} />}
                    {item.descuentoHeredado && (
                      <span className="block text-[10px] font-medium text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 rounded px-1 py-0.5 mt-0.5 border border-emerald-200">
                        {item.descuentoPorcentaje}% fijado en catálogo
                      </span>
                    )}
                    {item.descuento && item.descuento.monto > item.cantidad * item.valorUnitario && <p role="alert" className="text-[11px] text-destructive">El descuento no puede superar el valor de la línea.</p>}
                    {item.descuento?.codigo === '01' && <p className="text-[10px] leading-tight text-amber-700">El asiento automático utiliza la cuenta 74. Podría quedar pendiente de revisión si la cuenta no está activa en el plan de la empresa o los importes no concuerdan.</p>}
                  </td>

                  <td data-bags-visible={mostrarBolsas} className="invoice-line-field group/bags col-span-4 col-start-13 row-start-2 min-w-0 px-0 py-0 align-top text-right @min-[1000px]/items:col-span-1 @min-[1000px]/items:col-start-auto @min-[1000px]/items:row-start-auto @min-[1000px]/items:px-1 @min-[1000px]/items:py-2">
                    <span aria-hidden="true" className="mb-1 block text-left text-[10px] font-medium text-muted-foreground @min-[1000px]/items:hidden">Bolsas</span>
                    {!mostrarBolsas && <span aria-hidden="true" className="block py-2 text-muted-foreground group-focus-within/bags:hidden">—</span>}
                    <div className={mostrarBolsas ? undefined : 'sr-only focus-within:not-sr-only'}>
                    <InvoiceIntegerInput
                      disabled={bolsasBloqueadas}
                      data-invoice-bags aria-label={`ICBPER de la línea ${i + 1}`}
                      aria-invalid={Boolean(errorBolsas(item))}
                      title="Cantidad de bolsas · S/ 0.50 c/u"
                      className={`${CLASE_CELDA} text-right`}
                      value={cantidadBolsasDe(item)}
                      onValue={cantidadBolsas => onCambiar(i, { cantidadBolsas })}
                    />
                    </div>
                    {errorBolsas(item) && <p role="alert" className="text-[11px] text-destructive">{errorBolsas(item)}</p>}
                  </td>

                  <td className="invoice-line-field col-span-12 col-start-1 row-start-3 min-w-0 px-0 py-0 align-top @min-[1000px]/items:col-span-1 @min-[1000px]/items:col-start-auto @min-[1000px]/items:row-start-auto @min-[1000px]/items:px-1 @min-[1000px]/items:py-2">
                    <span aria-hidden="true" className="mb-1 block text-left text-[10px] font-medium text-muted-foreground @min-[1000px]/items:hidden">Afectación</span>
                    <div className="flex min-w-0 items-start gap-1.5">
                      {!esNota && <label className="inline-flex shrink-0 items-center gap-1 py-1.5 text-[10px] @min-[500px]/items:text-[11px]"><input type="checkbox" aria-label={`Gratuita de la línea ${i + 1}`} checked={item.afectacion === 'GRATUITA'} disabled={item.afectacion === 'GRATUITA' && !item.origenOneroso} onChange={e => {
                        if (e.target.checked) onCambiar(i, { origenOneroso: { afectacion: item.afectacion, codigoAfectacion: item.codigoAfectacion, precioUnitario: item.precioUnitario, valorUnitario: item.valorUnitario }, afectacion: 'GRATUITA', codigoAfectacion: '', precioUnitario: 0, valorUnitario: item.valorUnitario, descuento: null });
                        else if (item.origenOneroso) onCambiar(i, { ...item.origenOneroso, origenOneroso: undefined });
                      }} /> Gratuita</label>}
                      {item.afectacion === 'GRATUITA' ? <div className="relative min-w-0 flex-1 rounded border bg-background px-1 py-1.5 @min-[500px]/items:px-2 focus-within:ring-2 focus-within:ring-ring"><span aria-hidden="true" className="block whitespace-normal break-words text-[11px] @min-[500px]/items:pr-3 leading-relaxed">{item.codigoAfectacion ? `${item.codigoAfectacion} - ${NOMBRES_AFECTACION[item.codigoAfectacion] ?? item.afectacion}` : 'Motivo'}</span><ChevronDown aria-hidden="true" className="pointer-events-none absolute right-1 top-2 hidden h-3 w-3 @min-[500px]/items:block"/><select aria-label={`Motivo de gratuidad de la línea ${i + 1}`} className="absolute inset-0 h-full w-full cursor-pointer opacity-0 disabled:cursor-not-allowed" value={item.codigoAfectacion ?? ''} disabled={esNota} onChange={e => onCambiar(i, { codigoAfectacion: e.target.value })}>
                        <option value="">Motivo</option>
                        {OPCIONES_GRATUITAS.map(([codigo, nombre]) => <option key={codigo} value={codigo}>{codigo} - {nombre}</option>)}
                      </select></div> : <span aria-label={`Afectación de la línea ${i + 1}`} className="block min-w-0 flex-1 whitespace-normal break-words py-1.5 text-[11px] leading-relaxed text-muted-foreground" title={`${codigoAfectacion} - ${NOMBRES_AFECTACION[codigoAfectacion] ?? item.afectacion} · Tributo ${tributo}`}>
                        {codigoAfectacion} · {NOMBRES_AFECTACION[codigoAfectacion] ?? item.afectacion} · Tributo {tributo}
                      </span>}
                    </div>
                  </td>

                  <td className="invoice-line-field col-span-4 col-start-13 row-start-3 min-w-0 px-0 py-0 align-top @min-[1000px]/items:col-span-1 @min-[1000px]/items:col-start-auto @min-[1000px]/items:row-start-auto @min-[1000px]/items:px-1 @min-[1000px]/items:py-2">
                    <span aria-hidden="true" className="mb-1 block text-left text-[10px] font-medium text-muted-foreground @min-[1000px]/items:hidden">Detracción</span>
                    <select
                      aria-label={`Detracción de la línea ${i + 1}`}
                      className={CLASE_CELDA}
                      disabled={Boolean(item.detraccionHeredada)}
                      value={item.codigoDetraccion ?? ''}
                      onChange={(e) =>
                        onCambiar(i, {
                          codigoDetraccion: e.target.value || undefined,
                        })
                      }
                    >
                      <option value="">Sin detrac.</option>
                      {CODIGOS_DETRACCION.map((d) => (
                        <option key={d.codigo} value={d.codigo}>
                          {d.codigo} - {d.porcentaje * 100}%
                        </option>
                      ))}
                    </select>
                    {item.detraccionHeredada && (
                      <span className="block text-[10px] font-medium text-blue-600 bg-blue-50 dark:bg-blue-950/40 rounded px-1 py-0.5 mt-0.5 border border-blue-200">
                        SPOT {item.codigoDetraccion} catálogo
                      </span>
                    )}
                  </td>

                  <td className="col-span-3 col-start-12 row-start-1 min-w-0 px-0 py-0 align-top text-right @min-[1000px]/items:col-span-1 @min-[1000px]/items:col-start-auto @min-[1000px]/items:row-start-auto @min-[1000px]/items:px-1 @min-[1000px]/items:py-2">

                    <span className="block break-all py-2 font-semibold tabular-nums text-foreground">{totales.total.toFixed(2)}</span>
                  </td>

                  <td className="col-span-2 col-start-15 row-start-1 min-w-0 px-0 py-0 align-top text-right @min-[1000px]/items:col-span-1 @min-[1000px]/items:col-start-auto @min-[1000px]/items:row-start-auto @min-[1000px]/items:px-0 @min-[1000px]/items:py-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      aria-label={`Eliminar la línea ${i + 1}`}
                      className="h-8 w-8 px-0"
                      onClick={() => onEliminar(i)}
                    >
                      ✕
                    </Button>
                  </td>
                </tr>
                {item.valorUnitario === 0 && !esNota && item.afectacion !== 'GRATUITA' && !visible('valorUnitario') && (
                  <tr className={`grid grid-cols-1 ${conError && (mostrarErrores || editados.has(`${item.clave}:cantidad`)) ? 'bg-destructive/5' : ''}`}>
                    <td colSpan={9} className="block px-2 pb-1.5">
                      <p className="text-[11px] text-amber-700">El valor unitario de una línea onerosa debe ser mayor que cero.</p>
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
      {revision.errores > 0 && !enEdicion && (mostrarErrores||editados.size>0) && (
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
