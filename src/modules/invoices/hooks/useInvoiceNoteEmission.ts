import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { extractApiErrorMessage } from '@/lib/apiErrors';
import { invoicesApi } from '../services/invoicesApi';
import { aComprobanteDemo } from '../lib/invoiceApiMapper';
import { admiteNota, buscarAfectado, problemasDeNota } from '../lib/invoiceNotaOrigen';
import { esTipoNota, type BorradorEmision } from '../lib/invoiceEmitDraft';
import { limitesNota, precargarCantidadesNota } from '../lib/invoiceNoteQuantities';
import { lineasParaNota } from '../lib/invoiceLineasOrigen';
import { calcularFlujo } from '../lib/invoiceFlujoPago';
import type { ItemBorrador } from '../lib/invoiceItems';

/** Coordina las mismas lecturas, precarga y guardas del modo Nota anterior. */
export function useInvoiceNoteEmission(b: BorradorEmision, setItems: (items: readonly ItemBorrador[]) => void, preservarItems: boolean) {
  const nota = esTipoNota(b.tipo);
  const origenes = useQuery({ queryKey: ['invoice-note-origins'], enabled: nota, retry: false,
    queryFn: async () => {
      const primera = await invoicesApi.getInvoices(1, { page_size: 100 });
      const otras = await Promise.all(Array.from({ length: Math.max(0, primera.totalPages - 1) }, (_, i) => invoicesApi.getInvoices(i + 2, { page_size: 100 })));
      return [...primera.data, ...otras.flatMap(p => p.data)].map(aComprobanteDemo).filter(c => c.tipo === '01' || c.tipo === '03');
    },
  });
  const existentes = useMemo(() => origenes.data ?? [], [origenes.data]);
  const afectado = buscarAfectado(existentes.filter(admiteNota), b.documentoAfectado);
  const saldoNota = useQuery({ queryKey: ['invoice-saldo-nota', afectado?.id], enabled: nota && !!afectado,
    queryFn: () => invoicesApi.getSaldoNota(afectado!.id), staleTime: 0, retry: false });
  const [avisoLineas, setAvisoLineas] = useState('');
  const precargaNota = useRef<{ clave: string; iniciales: BorradorEmision['items']; aplicada: boolean } | null>(null);
  useEffect(() => {
    if (!nota || !afectado || preservarItems) { precargaNota.current = null; return; }
    const clave = `${b.tipo}:${afectado.id}`;
    if (precargaNota.current?.clave !== clave) precargaNota.current = { clave, iniciales: b.items, aplicada: false };
    const intentoPrecarga = precargaNota.current;
    if (intentoPrecarga.aplicada) return;
    if (b.items !== intentoPrecarga.iniciales) { intentoPrecarga.aplicada = true; return; }
    if (b.tipo === '07' && (!saldoNota.data || saldoNota.isFetching)) return;
    let vigente = true;
    void Promise.resolve().then(() => invoicesApi.getInvoiceById(afectado.id)).then(detalle => {
      if (!vigente) return;
      const originales = lineasParaNota(detalle.lineasOrigen ?? []);
      intentoPrecarga.aplicada = true;
      if (originales === null) { setAvisoLineas('Las líneas del origen contienen datos incompletos o no compatibles; ingréselas manualmente.'); return; }
      const lineas = b.tipo === '07' ? precargarCantidadesNota(originales, saldoNota.data!.cantidades_pendientes, b.motivoCodigo) : originales;
      setAvisoLineas(originales.length > 0 && lineas.length === 0 ? 'No quedan unidades pendientes del comprobante origen.' : '');
      if (originales.length) setItems(lineas);
    }).catch(() => { if (vigente) { intentoPrecarga.aplicada = true; setAvisoLineas('No se pudieron cargar las líneas del origen; ingréselas manualmente.'); } });
    return () => { vigente = false; };
  }, [nota, afectado, b.tipo, b.items, b.motivoCodigo, saldoNota.data, saldoNota.isFetching, preservarItems, setItems]);

  const pendientes = nota ? problemasDeNota(b, existentes, calcularFlujo(b).importeTotal).map(p => ({ selector: p.campo === 'documentoAfectado' ? '#doc-afectado' : p.campo === 'motivo' ? '#motivo' : '[aria-label="Líneas del comprobante"]', mensaje: p.mensaje })) : [];
  if (nota && origenes.isError) pendientes.push({ selector: '#doc-afectado', mensaje: 'No se pudieron consultar los comprobantes origen. Inténtelo de nuevo.' });
  if (nota && afectado) {
    if (!saldoNota.data || saldoNota.isFetching || saldoNota.isError) pendientes.push({ selector: '#doc-afectado', mensaje: saldoNota.isError ? extractApiErrorMessage(saldoNota.error, 'No se pudo consultar el saldo de la nota; inténtelo de nuevo.') : 'Consultando saldo del comprobante…' });
    else {
      if (Math.round(calcularFlujo(b).importeTotal * 100) > Math.round(saldoNota.data.disponible * 100)) pendientes.push({ selector: '[aria-label="Líneas del comprobante"]', mensaje: `La nota supera el saldo disponible informado por el servidor (S/ ${saldoNota.data.disponible.toFixed(2)}).` });
      if (b.tipo === '07') pendientes.push(...limitesNota(b.items, saldoNota.data.cantidades_pendientes, b.motivoCodigo, saldoNota.data.motivos_totales).errores.map(mensaje => ({ selector: '[aria-label="Líneas del comprobante"]', mensaje })));
    }
  }
  const comprobarSaldoActual = async () => {
    if (!nota || !afectado) return;
    const actual = await invoicesApi.getSaldoNota(afectado.id);
    const errorCantidad = b.tipo === '07' ? limitesNota(b.items, actual.cantidades_pendientes, b.motivoCodigo, actual.motivos_totales).errores[0] : undefined;
    if (errorCantidad) throw new Error(errorCantidad);
    if (Math.round(calcularFlujo(b).importeTotal * 100) > Math.round(actual.disponible * 100)) throw new Error('La nota supera el saldo actualizado del comprobante.');
  };
  return { existentes, afectado, saldoNota, avisoLineas, pendientes, comprobarSaldoActual };
}
