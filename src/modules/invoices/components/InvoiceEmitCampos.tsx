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
  SERIES_POR_TIPO,
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
import { CampoFecha, CampoSelect, CampoTexto } from './InvoiceEmitCamposBase';
import { CustomerLookupField } from './CustomerLookupField';
import { InvoiceEmitCamposTributarios } from './InvoiceEmitCamposTributarios';
import { InvoiceItemsGrid } from './InvoiceItemsGrid';
import { InvoiceDescuentoGlobal } from './InvoiceDescuentoGlobal';
import type { SaldoNota } from '../services/invoicesApi';

interface InvoiceEmitCamposProps {
  borrador: BorradorEmision;
  actualizar: (parcial: Partial<BorradorEmision>) => void;
  /** Comprobantes ya emitidos: se usan para vincular las notas. */
  existentes: readonly ComprobanteDemo[];
  /** Total del comprobante calculado, para estimar la detracción. */
  total: number;
  saldoNota?: SaldoNota;
  onItemCambiado: (indice: number, parcial: Partial<BorradorEmision['items'][number]>) => void;
  onItemEliminado: (indice: number) => void;
  onItemAgregado: () => void;
  onBolsaAgregada: () => void;
  /** TA-61: productos del almacén para el buscador de la grilla. */
  productos?: readonly ProductoBuscado[];
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
  borrador: b,
  actualizar,
  existentes,
  total,
  saldoNota,
  onItemCambiado,
  onItemEliminado,
  onItemAgregado,
  onBolsaAgregada,
  productos,
  onItemDesdeProducto,
}: InvoiceEmitCamposProps) => {
  const esNota = esTipoNota(b.tipo);
  const motivos = b.tipo === '08' ? MOTIVOS_ND : MOTIVOS_NC;
  // Se busca por NÚMERO FISCAL, no por `id`: `id` es el UUID de la base y el
  // usuario teclea "F001-00000045". Comparar contra el UUID hacía que el campo
  // marcara error y que la serie no se vinculara nunca.
  const elegibles = existentes.filter(admiteNota);
  const afectado = buscarAfectado(elegibles, b.documentoAfectado);

  /**
   * ¿Una nota vinculada hereda la fecha del documento que modifica?
   *
   * Sí para la nota al CRÉDITO con motivo 13 (ajustes de operaciones
   * intragrupo / diferencia de cambio), que por la RS 193-2020/SUNAT debe llevar
   * la misma fecha que el comprobante original. En ese caso el campo no impone
   * los topes de «no futuro» ni del plazo del resumen: la fecha no la elige el
   * usuario, la hereda de un documento que ya existe.
   */
  const afectaFechaHeredada = esNota && Boolean(afectado) && b.motivoCodigo === '13';

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
        opciones={(SERIES_POR_TIPO[b.tipo] ?? ['F001']).map((s) => ({
          value: s,
          label: s,
        }))}
        // La serie F/B de una Nota debe coincidir con el documento que afecta.
        disabled={esNota && Boolean(b.documentoAfectado.trim())}
      />

      {/*
        D9 · Fecha de emisión.

        Nace precargada con HOY en Lima y es editable, porque fechar un
        comprobante es una decisión del negocio: la venta del viernes que se
        registra el lunes lleva la fecha del viernes. Antes era un `useState`
        congelado que el usuario no podía tocar.

        El tope superior es hoy (no se emite a futuro) y el inferior, el plazo
        del resumen diario (regla 2957). Si la nota está vinculada a un
        documento afectado, la fecha la manda él: el motivo 13 (RS 193-2020)
        exige la fecha del comprobante original, así que el campo se muestra
        pero se explica por qué no es libre.
      */}
      <CampoFecha
        id="fecha-emision"
        label="Fecha de emisión"
        value={b.fecha}
        onChange={(v) => actualizar(cambiarFechaEmision(b, v))}
        min={afectaFechaHeredada ? undefined : minimoDeFechaEmision()}
        max={afectaFechaHeredada ? undefined : topeDeFechaEmision()}
        ayuda={
          afectaFechaHeredada
            ? 'Es la fecha del comprobante afectado: la nota al crédito la hereda (motivo 13).'
            : b.formaPago === 'Credito' && b.cuotas.length > 0
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
        onDocumentoChange={(clienteDoc) => actualizar({ clienteDoc, clienteRazonSocial: '', clienteId: undefined, clienteTipoDocumento: undefined, clienteDireccion: undefined })}
        onRazonSocialChange={(clienteRazonSocial) => actualizar({ clienteRazonSocial, clienteId: undefined })}
        onElegir={(cliente) =>
          actualizar({
            clienteId: cliente.id,
            clienteTipoDocumento: cliente.tipoDocumento,
            clienteDireccion: cliente.direccion,
            clienteDoc: cliente.numeroDocumento,
            clienteRazonSocial: cliente.razonSocial,
          })
        }
      />


      <InvoiceItemsGrid
        items={b.items}
        onCambiar={onItemCambiado}
        onEliminar={onItemEliminado}
        onAgregar={onItemAgregado}
        onAgregarBolsa={onBolsaAgregada}
        productos={productos}
        onAgregarConProducto={onItemDesdeProducto}
      />

      <InvoiceDescuentoGlobal valor={b.descuentoGlobal} onChange={(descuentoGlobal) => actualizar({ descuentoGlobal })} />

      <InvoiceEmitCamposTributarios
        borrador={b}
        actualizar={actualizar}
        total={total}
      />

      {esNota && (
        <>
          <div className="sm:col-span-2">
            <CampoTexto
              id="doc-afectado"
              list="documentos-aceptados"
              label="Documento afectado"
              value={b.documentoAfectado}
              onChange={(v) =>
                actualizar(
                  vincularDocumentoAfectado(
                    { ...b, documentoAfectado: v },
                    existentes,
                  ).borrador,
                )
              }
              placeholder="F001-0042"
              error={
                b.documentoAfectado.trim() && !afectado
                  ? 'Seleccione una factura o boleta ACEPTADA por SUNAT.'
                  : undefined
              }
            />
          </div>
          <datalist id="documentos-aceptados">
            {elegibles.map((c) => <option key={c.id} value={`${c.serie}-${String(c.correlativo).padStart(8, '0')}`}>{c.clienteRazonSocial}</option>)}
          </datalist>
          {afectado && (
            <div className="sm:col-span-2 rounded-lg border bg-muted/40 p-2">
              <p className="text-[11px] text-muted-foreground">
                {/* El número fiscal, no `id`: en los comprobantes reales `id` es
                    el UUID del backend y ver un GUID crudo en pantalla se lee
                    como un error del sistema. `numero` ya trae los ceros de
                    relleno (F001-00000047); se reconstruye solo si faltara. */}
                Se vincula con{' '}
                {afectado.numero ||
                  `${afectado.serie}-${String(afectado.correlativo).padStart(8, '0')}`}{' '}
                · {afectado.clienteRazonSocial} · base S/{' '}
                {afectado.baseImponible.toFixed(2)} + IGV de{' '}
                {afectado.igv.toFixed(2)}
              </p>
              {saldoNota && <p className="text-xs">Total S/ {saldoNota.total.toFixed(2)} · Acreditado según servidor S/ {saldoNota.devuelto.toFixed(2)} · Disponible según servidor S/ {saldoNota.disponible.toFixed(2)}. Las notas antiguas sin vínculo por ID pueden no estar incluidas.</p>}
              {b.tipo === '07' && saldoNota && Math.round(saldoNota.devuelto * 100) > Math.round(saldoNota.total * 100) && <p role="alert" className="text-xs text-destructive">El acreditado según el servidor supera el total del comprobante. Revise el sobre-crédito antes de continuar.</p>}
            </div>
          )}
          <CampoSelect
            id="motivo"
            label="Motivo de la nota"
            value={b.motivoCodigo}
            onChange={(v) => {
              const elegido = motivos.find((m) => m.codigo === v);
              actualizar({
                motivoCodigo: v,
                motivoDescripcion: elegido?.descripcion ?? '',
              });
            }}
            opciones={motivos.map((m) => ({
              value: m.codigo,
              label: `${m.codigo} - ${m.descripcion}`,
            }))}
          />
        </>
      )}
    </div>
  );
};
