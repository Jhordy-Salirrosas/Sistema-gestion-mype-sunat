import { useEffect, useState } from 'react';
import { invoicesApi } from '../services/invoicesApi';
import { INVOICE_QUEUED } from '../lib/invoiceQueueEvents';
import type { Invoice } from '../types/invoice.types';
/** Una lectura al abrir; tras una acción, hasta 12 lecturas durante unos 18 segundos. */
export function useInvoiceDetailRefresh(id: string | null) {
  const [pulse, setPulse] = useState<{ id: string; version: number } | null>(null);
  const [result, setResult] = useState<{ id: string; detail?: Invoice; error?: boolean }>();
  useEffect(() => {
    const queued = (event: Event) => { if ((event as CustomEvent<string>).detail === id) setPulse(p => ({ id: id!, version: (p?.version ?? 0) + 1 })); };
    window.addEventListener(INVOICE_QUEUED, queued);
    return () => window.removeEventListener(INVOICE_QUEUED, queued);
  }, [id]);
  useEffect(() => {
    if (!id) return;
    let active = true, reads = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const deadline = pulse?.id === id ? setTimeout(() => { active = false; clearTimeout(timer); }, 20000) : undefined;
    const read = async () => {
      reads += 1;
      let terminal = false;
      try {
        const detail = await invoicesApi.getInvoiceById(id, true);
        if (!active) return;
        setResult({ id, detail });
        terminal = ['ACEPTADO', 'OBSERVADO', 'RECHAZADO', 'ANULADO'].includes(detail.estadoBackend ?? '');
      } catch { if (active) setResult(previous => previous?.id === id && previous.detail ? previous : { id, error: true }); }
      if (active && pulse?.id === id && !terminal && reads < 12) timer = setTimeout(() => void read(), 1500);
    };
    void read();
    return () => { active = false; clearTimeout(timer); clearTimeout(deadline); };
  }, [id, pulse]);
  return result?.id === id ? result : undefined;
}
