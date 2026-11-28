import { useState } from 'react';
import { applyDebitAmount } from '../lib/invoiceDebitAmount';
import { MOTIVOS_NC, MOTIVOS_ND } from '../lib/invoiceEmitValidation';
import { vincularDocumentoAfectado } from '../lib/invoiceEmitDraft';
import { admiteNota, buscarAfectado } from '../lib/invoiceNotaOrigen';
import type { BorradorEmision } from '../lib/invoiceEmitDraft';
import type { ComprobanteDemo } from '../data/invoiceDemoTypes';
import type { SaldoNota } from '../services/invoicesApi';
import { CampoSelect } from './InvoiceEmitCamposBase';

/** Controles de Nota extraídos del formulario retirado; no mantiene estado fiscal propio. */
export function InvoiceNoteFields({ borrador: b, actualizar, existentes, saldoNota, total }: {
  borrador: BorradorEmision; actualizar: (parcial: Partial<BorradorEmision>) => void;
  existentes: readonly ComprobanteDemo[]; saldoNota?: SaldoNota; total: number;
}) {
  const [debitAmount, setDebitAmount] = useState('');
  const [debitError, setDebitError] = useState('');
  const motivos = b.tipo === '08' ? MOTIVOS_ND : MOTIVOS_NC;
  const elegibles = existentes.filter(admiteNota);
  const afectado = buscarAfectado(elegibles, b.documentoAfectado);
  return <section className="invoice-note-fields grid min-w-0 gap-3" aria-label="Datos de la nota">

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
                  Total S/ {saldoNota.total.toFixed(2)} · Aplicado en notas según servidor S/{' '}
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
              {b.tipo === '08' && saldoNota && <section className="space-y-2 rounded-md border p-3">
        <label htmlFor="importe-nd">Importe de la nota de débito</label>
        <input id="importe-nd" type="number" min="0.01" step="0.01" max={saldoNota.disponible} value={debitAmount} onChange={e => setDebitAmount(e.target.value)} className="ml-2 w-32 rounded border p-2" />
        <button type="button" className="ml-2 text-primary underline" onClick={() => { try { const next=applyDebitAmount(b, Number(debitAmount), saldoNota.disponible); actualizar({items:next.items,descuentoGlobal:next.descuentoGlobal}); setDebitError(''); } catch(error) {setDebitError(error instanceof Error ? error.message : 'Revise el importe.');} }}>Aplicar importe parcial</button>
        <button type="button" className="ml-2 text-primary underline" onClick={() => { try {const next=applyDebitAmount(b,saldoNota.disponible,saldoNota.disponible); actualizar({items:next.items,descuentoGlobal:next.descuentoGlobal});setDebitAmount(saldoNota.disponible.toFixed(2));setDebitError('');} catch(error) {setDebitError(error instanceof Error ? error.message : 'Revise el importe.');} }}>Aplicar saldo total</button>
        <p className="text-xs">Saldo del afectado: S/ {saldoNota.disponible.toFixed(2)} · Restante tras esta nota: S/ {Math.max(0,saldoNota.disponible-total).toFixed(2)}. El servidor valida nuevamente al emitir.</p>
        {debitError && <p role="alert">{debitError}</p>}
      </section>}

  </section>;
}
