import { editarIdentidadCliente } from '../lib/invoiceCustomerIdentity';
import { limitesNota } from '../lib/invoiceNoteQuantities';
import { InvoiceNextNumber } from './InvoiceNextNumber';
/**
 * Campos del formulario de emisión de comprobantes (M1).
 *
 * Se extraen de `InvoiceEmitModal.tsx` para mantener ambos archivos por debajo
 * del límite de líneas. Los primitivos de campo viven en
 * `InvoiceEmitCamposBase`, los tributarios en `InvoiceEmitCamposTributarios` y
 * la grilla de detalle en `InvoiceItemsGrid` (TA-64).
 *
 * TA-64 quita los campos únicos «Descripción del ítem» y «Monto base
 * imponible»: el detalle ahora es una grilla de varias líneas.
 */
import {
  MOTIVOS_NC,
  MOTIVOS_ND,
  documentoValidoParaTipo,
  mensajeErrorDocumento,
} from '../lib/invoiceEmitValidation';
import {
  cambiarFechaEmision,
  cambiarTipo,
  esTipoNota,
  vincularDocumentoAfectado,
} from '../lib/invoiceEmitDraft';
import type { BorradorEmision } from '../lib/invoiceEmitDraft';
import { minimoDeFechaEmision, topeDeFechaEmision } from '../lib/invoiceEmitFecha';
import { admiteNota, buscarAfectado } from '../lib/invoiceNotaOrigen';
import type { ComprobanteDemo } from '../data/invoiceDemoTypes';
import type { ProductoBuscado } from '../lib/invoiceSearch';
import { CampoFecha, CampoSelect } from './InvoiceEmitCamposBase';
import { CustomerLookupField } from './CustomerLookupField';
import { InvoiceEmitCamposTributarios } from './InvoiceEmitCamposTributarios';
import { InvoiceItemsGrid } from './InvoiceItemsGrid';
import { InvoiceDescuentoGlobal } from './InvoiceDescuentoGlobal';
import type { SaldoNota } from '../services/invoicesApi';

interface InvoiceEmitCamposProps {
  mostrarErrores?: boolean;
  borrador: BorradorEmision;
  series?: readonly string[];
  correlativoActual?: number;
  configuracionCargando?: boolean;
  configuracionError?: boolean;
  actualizar: (parcial: Partial<BorradorEmision>) => void;
  /** Comprobantes ya emitidos: se usan para vincular las notas. */
  existentes: readonly ComprobanteDemo[];
  /** Total del comprobante calculado, para estimar la detracción. */
  total: number;
  saldoNota?: SaldoNota;
  onItemCambiado: (indice: number, parcial: Partial<BorradorEmision['items'][number]>) => void;
  onItemEliminado: (indice: number) => void;
  onItemAgregado: () => void;
  onBolsaAgregada: (indice: number) => void;
  /** TA-61: productos del almacén para el buscador de la grilla. */
  productos?: readonly ProductoBuscado[];
  catalogoEstado?: 'listo' | 'cargando' | 'error';
  /** TA-61: agrega una línea con los datos del producto elegido. */
  onItemDesdeProducto?: (producto: ProductoBuscado) => void;
}

const OPCIONES_TIPO = [
  { value: '01' as const, label: '01 - Factura' },
  { value: '03' as const, label: '03 - Boleta' },
  { value: '07' as const, label: '07 - Nota de Crédito' },
  { value: '08' as const, label: '08 - Nota de Débito' },
];

/** Campos de identificación del comprobante, del cliente y del detalle. */
export const InvoiceEmitCampos = ({
  borrador: b, mostrarErrores,
  series = [],
  correlativoActual,
  configuracionCargando = false,
  configuracionError = false,
  actualizar,
  existentes,
  total,
  saldoNota,
  onItemCambiado,
  onItemEliminado,
  onItemAgregado,
  onBolsaAgregada,
  productos, catalogoEstado,
  onItemDesdeProducto,
}: InvoiceEmitCamposProps) => {
  const esNota = esTipoNota(b.tipo);
  const motivos = b.tipo === '08' ? MOTIVOS_ND : MOTIVOS_NC;
  // Se busca por NÚMERO FISCAL, no por `id`: `id` es el UUID de la base y el
  // usuario teclea "F001-00000045". Comparar contra el UUID hacía que el campo
  // marcara error y que la serie no se vinculara nunca.
  const elegibles = existentes.filter(admiteNota);
  const afectado = buscarAfectado(elegibles, b.documentoAfectado);

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <CampoSelect
        id="tipo-cpe"
        label="Tipo de comprobante"
        value={b.tipo}
        onChange={(v) => actualizar(cambiarTipo(b, v as BorradorEmision['tipo']))}
        opciones={OPCIONES_TIPO}
      />

      <CampoSelect
        id="serie-cpe"
        label="Serie"
        value={b.serie}
        onChange={(v) => actualizar({ serie: v })}
        opciones={series.map((s) => ({
          value: s,
          label: s,
        }))}
        // La serie F/B de una Nota debe coincidir con el documento que afecta.
        disabled={esNota && Boolean(b.documentoAfectado.trim())}
      />

      <InvoiceNextNumber cargando={configuracionCargando} error={configuracionError} serie={b.serie} actual={correlativoActual} />

      {esNota && (
        <>
          <div className="sm:col-span-2" data-testid="paso-origen-nota">
            <label htmlFor="doc-afectado">Documento afectado *</label>
            <select id="doc-afectado" aria-label="Documento afectado" aria-required="true" aria-invalid={!afectado} aria-describedby={!afectado ? 'doc-afectado-error' : undefined}
              className="h-9 w-full rounded border bg-background px-3" value={b.documentoAfectado}
              onChange={e => actualizar(vincularDocumentoAfectado({ ...b, documentoAfectado: e.target.value }, existentes).borrador)}>
              <option value="">Seleccione el comprobante origen</option>
              {elegibles.map(c => <option key={c.id} value={`${c.serie}-${String(c.correlativo).padStart(8, '0')}`}>{c.serie}-{String(c.correlativo).padStart(8, '0')} · {c.clienteRazonSocial}</option>)}
            </select>
            {!afectado && <p id="doc-afectado-error" className="text-xs text-destructive">Seleccione una factura o boleta ACEPTADA u OBSERVADA por SUNAT.</p>}
          </div>
          {afectado ? (
            <div
              className="sm:col-span-2 rounded-lg border bg-muted/40 p-2.5 space-y-1"
              data-testid="resumen-comprobante-origen"
            >
              <p className="text-xs font-medium">
                Comprobante origen:{' '}
                {afectado.tipo === '03' ? 'Boleta (03)' : 'Factura (01)'} ·{' '}
                {afectado.numero ||
                  `${afectado.serie}-${String(afectado.correlativo).padStart(8, '0')}`}
              </p>
              <p className="text-[11px] text-muted-foreground">
                Cliente: {afectado.clienteRazonSocial} ({afectado.clienteRuc}) · Importe total S/{' '}
                {afectado.totalNeto.toFixed(2)} · Se vincula con{' '}
                {afectado.numero ||
                  `${afectado.serie}-${String(afectado.correlativo).padStart(8, '0')}`}{' '}
                · {afectado.clienteRazonSocial} · base S/{' '}
                {afectado.baseImponible.toFixed(2)} + IGV de{' '}
                {afectado.igv.toFixed(2)}
              </p>
              {saldoNota && (
                <p className="text-xs">
                  Total S/ {saldoNota.total.toFixed(2)} · Acreditado según servidor S/{' '}
                  {saldoNota.devuelto.toFixed(2)} · Disponible según servidor S/{' '}
                  {saldoNota.disponible.toFixed(2)}. Las notas antiguas sin vínculo por ID pueden no estar incluidas.
                </p>
              )}
              {b.tipo === '07' &&
                saldoNota &&
                Math.round(saldoNota.devuelto * 100) > Math.round(saldoNota.total * 100) && (
                  <p role="alert" className="text-xs text-destructive">
                    El acreditado según el servidor supera el total del comprobante. Revise el sobre-crédito antes de continuar.
                  </p>
                )}
            </div>
          ) : (
            <div
              className="sm:col-span-2 rounded-lg border border-dashed bg-muted/20 p-2 text-[11px] text-muted-foreground"
              data-testid="aviso-comprobante-origen"
            >
              Paso 1: elija el comprobante origen (Factura o Boleta aceptada u observada) para cargar serie, cliente e importe.
            </div>
          )}
          <div className="sm:col-span-2">
            <CampoSelect
              id="motivo"
              label="Motivo de la nota"
              value={b.motivoCodigo}
              onChange={(v) => {
                const elegido = motivos.find((m) => m.codigo === v);
                actualizar(vincularDocumentoAfectado({ ...b, motivoCodigo: v, motivoDescripcion: b.tipo === '07' && v === '10' ? '' : elegido?.descripcion ?? '' }, existentes).borrador);
              }}
              opciones={motivos.map((m) => ({
                value: m.codigo,
                label: `${m.codigo} - ${m.descripcion}`,
              }))}
            />
          </div>
          {b.tipo === '07' && b.motivoCodigo === '10' && <label className="block text-sm sm:col-span-2">Sustento de Otros conceptos
            <input aria-label="Sustento de Otros conceptos" className="w-full rounded border p-2" value={b.motivoDescripcion} onChange={e => actualizar({ motivoDescripcion: e.target.value })} maxLength={500} aria-required="true" />
            <span className="block text-xs text-muted-foreground">Solo ajustes monetarios sobre líneas del comprobante original. Este motivo no corrige únicamente el IGV.</span>
          </label>}
        </>
      )}

      {/*
        D9 · Fecha de emisión.

        Nace precargada con HOY en Lima y es editable, porque fechar un
        comprobante es una decisión del negocio: la venta del viernes que se
        registra el lunes lleva la fecha del viernes. Antes era un `useState`
        congelado que el usuario no podía tocar.

        El tope superior es hoy y el inferior corresponde al plazo de emisión.
        Las notas conservan su propia fecha, incluido el motivo 13.
      */}
      <CampoFecha
        id="fecha-emision"
        label="Fecha de emisión"
        value={b.fecha}
        onChange={(v) => actualizar(cambiarFechaEmision(b, v))}
        min={minimoDeFechaEmision(undefined, b.tipo)}
        max={topeDeFechaEmision()}
        ayuda={
          b.formaPago === 'Credito' && b.cuotas.length > 0
              ? 'Al cambiarla, los vencimientos conservan su plazo respecto de la nueva fecha.'
              : undefined
        }
      />

      <CustomerLookupField
        disabled={esNota && Boolean(afectado)}
        documento={b.clienteDoc}
        razonSocial={b.clienteRazonSocial}
        labelDocumento={
          b.tipo === '03' ? 'DNI del cliente' : 'RUC / DNI del cliente'
        }
        placeholderDocumento={b.tipo === '03' ? '45678912' : '20100070970'}
        errorDocumento={
          b.clienteDoc.length > 0 &&
          !documentoValidoParaTipo(b.tipo, b.clienteDoc)
            ? mensajeErrorDocumento(b.tipo)
            : undefined
        }
        onDocumentoChange={(texto) => {
          const identidad = editarIdentidadCliente({ documento: b.clienteDoc, razonSocial: b.clienteRazonSocial, confirmado: Boolean(b.clienteId) }, 'documento', texto);
          actualizar({
            clienteDoc: identidad.documento,
            clienteRazonSocial: identidad.razonSocial,
            clienteId: undefined,
            clienteTipoDocumento: undefined,
            clienteDireccion: undefined,
            clienteTieneCredito: false,
            clienteAdmiteDescuento: false,
            formaPago: 'Contado',
            cuotas: [],
            descuentoGlobal: null,
            items: b.items.map((item) => ({ ...item, descuento: null })),
          });
        }}
        onRazonSocialChange={(texto) => {
          const identidad = editarIdentidadCliente({ documento: b.clienteDoc, razonSocial: b.clienteRazonSocial, confirmado: Boolean(b.clienteId) }, 'nombre', texto);
          actualizar({
            clienteRazonSocial: identidad.razonSocial,
            clienteDoc: identidad.documento,
            clienteId: undefined,
            clienteTipoDocumento: undefined,
            clienteDireccion: undefined,
            clienteTieneCredito: false,
            clienteAdmiteDescuento: false,
            formaPago: 'Contado',
            cuotas: [],
            descuentoGlobal: null,
            items: b.items.map((item) => ({ ...item, descuento: null })),
          });
        }}
        onElegir={(cliente) =>
          actualizar({
            clienteId: cliente.id,
            clienteTipoDocumento: cliente.tipoDocumento,
            clienteDireccion: cliente.direccion,
            clienteTieneCredito: cliente.tieneCredito === true,
            clienteAdmiteDescuento: cliente.admiteDescuento === true,
            clienteDoc: cliente.numeroDocumento,
            clienteRazonSocial: cliente.razonSocial,
            ...(cliente.tieneCredito === true
              ? {}
              : { formaPago: 'Contado', cuotas: [] }),
            ...(cliente.admiteDescuento === true
              ? {}
              : {
                  descuentoGlobal: null,
                  items: b.items.map((item) => ({ ...item, descuento: null })),
                }),
          })
        }
      />


      <InvoiceItemsGrid mostrarErrores={mostrarErrores} tipo={b.tipo} esNota={esNota} catalogoEstado={catalogoEstado}
        cantidadesMaximas={b.tipo === '07' ? limitesNota(b.items, saldoNota?.cantidades_pendientes, b.motivoCodigo, saldoNota?.motivos_totales).maximos : undefined}
        items={b.items}
        onCambiar={onItemCambiado}
        onEliminar={onItemEliminado}
        onAgregar={onItemAgregado}
        onAgregarBolsa={onBolsaAgregada}
        productos={productos}
        onAgregarConProducto={onItemDesdeProducto}
        admiteDescuento={b.clienteAdmiteDescuento === true}
      />

      <InvoiceDescuentoGlobal
        valor={b.descuentoGlobal}
        disabled={b.clienteAdmiteDescuento !== true}
        onChange={(descuentoGlobal) => actualizar({ descuentoGlobal })}
      />

      <InvoiceEmitCamposTributarios
        borrador={b}
        actualizar={actualizar}
        total={total}
      />


    </div>
  );
};
