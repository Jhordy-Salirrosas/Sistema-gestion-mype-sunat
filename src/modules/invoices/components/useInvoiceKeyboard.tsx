import { useState, type KeyboardEvent } from 'react';
import { Button, Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui';
export function useInvoiceKeyboard(add: () => void, emitir: () => void, busy: boolean) {
 const [review, setReview] = useState(false);
 const handler = (e: KeyboardEvent<HTMLElement>) => {
  if (busy || e.nativeEvent.isComposing || (e.target as HTMLElement).closest('[role="dialog"]') !== e.currentTarget.closest('[role="dialog"]')) return;
  if (e.altKey && ['c','p','l'].includes(e.key.toLowerCase())) { e.preventDefault();
   if (e.key.toLowerCase() === 'l') add(); else e.currentTarget.querySelector<HTMLInputElement>(e.key.toLowerCase() === 'c' ? '#doc-cliente' : '[aria-label="Buscar producto"]')?.focus();
  }
  if (e.ctrlKey && e.key === 'Enter') { e.preventDefault(); setReview(true); }
 };
 const ayuda = <><p className="text-xs">Atajos: Alt+C cliente · Alt+P producto · Alt+L nueva línea · Ctrl+Enter revisar emisión · Escape cerrar sugerencias. Flechas/Enter seleccionan; Tab navega.</p>
 <Dialog open={review} onOpenChange={setReview}><DialogContent><DialogTitle>Revisar emisión</DialogTitle><DialogDescription>Revise cliente, almacén, líneas y totales. Confirmar ejecuta las mismas validaciones del botón Emitir.</DialogDescription><Button type="button" disabled={busy} onClick={() => { setReview(false); emitir(); }}>Confirmar emisión revisada</Button><Button type="button" onClick={() => setReview(false)}>Volver a revisar</Button></DialogContent></Dialog></>;
 return { handler, ayuda };
}
