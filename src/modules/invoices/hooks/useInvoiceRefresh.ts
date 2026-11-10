import { useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { invoicesApi } from '../services/invoicesApi';
/** Clic explícito: red real, nunca una copia offline presentada como nueva. */
export function useInvoiceRefresh() {
 const client = useQueryClient();
 const lock = useRef(false);
 const [actualizando, setActualizando] = useState(false);
 const [resultado, setResultado] = useState<{ ok: boolean; mensaje: string } | null>(null);
 const actualizar = async () => {
  if (lock.current) return;
  lock.current = true; setActualizando(true); setResultado(null);
  try {
   await client.cancelQueries({ queryKey: ['invoices', 1], exact: true });
   await client.invalidateQueries({ queryKey: ['invoices', 1], exact: true, refetchType: 'none' });
   const primera = await invoicesApi.getInvoices(1, { page_size: 100 }, true);
   const resto = await Promise.all(Array.from({ length: Math.max(0, primera.totalPages - 1) }, (_, i) => invoicesApi.getInvoices(i + 2, { page_size: 100 }, true)));
   client.setQueryData(['invoices', 1], { ...primera, data: [...primera.data, ...resto.flatMap(p => p.data)] });
   await Promise.all([
    client.invalidateQueries({ queryKey: ['invoices-dashboard-metrics'] }),
    client.invalidateQueries({ queryKey: ['invoices', 'metrics'] }),
   ]);
   setResultado({ ok: true, mensaje: 'Lista y contadores actualizados desde el servidor.' });
  } catch { setResultado({ ok: false, mensaje: 'No se pudo actualizar desde el servidor. Los datos anteriores no confirman el estado actual.' }); }
  finally { lock.current = false; setActualizando(false); }
 };
 return { actualizar, actualizando, resultado };
}
