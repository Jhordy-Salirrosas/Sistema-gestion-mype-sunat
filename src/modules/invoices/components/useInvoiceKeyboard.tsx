import { useEffect, useState, type KeyboardEvent, type RefObject } from 'react';
import { Button, Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui';

type Tecla = Pick<globalThis.KeyboardEvent, 'key' | 'code' | 'altKey' | 'ctrlKey' | 'isComposing' | 'defaultPrevented' | 'preventDefault'>;
export function useInvoiceKeyboard(add: () => void, emitir: () => void, busy: boolean, pageScope?: RefObject<HTMLElement | null>) {
 const [review, setReview] = useState(false);
 const ejecutar = (e: Tecla, scope: HTMLElement) => {
  if (busy || e.isComposing || e.defaultPrevented) return;
  const key = ({KeyC:'c',KeyP:'p',KeyL:'l'} as Record<string,string>)[e.code] ?? e.key.toLowerCase();
  if (e.altKey && ['c','p','l'].includes(key)) {
   e.preventDefault();
   if (key === 'l') add();
   else scope.querySelector<HTMLInputElement>(key === 'c' ? '#doc-cliente' : '[data-invoice-product-search], [aria-label="Buscar producto"]')?.focus();
  }
  if (e.ctrlKey && (e.key === 'Enter' || e.code === 'Enter' || e.code === 'NumpadEnter')) { e.preventDefault(); setReview(true); }
 };
 useEffect(() => {
  if (!pageScope) return;
  const listener = (e: globalThis.KeyboardEvent) => {
   if (!pageScope.current || document.querySelector('[role="dialog"], [role="alertdialog"]')) return;
   ejecutar(e, pageScope.current);
  };
  window.addEventListener('keydown', listener);
  return () => window.removeEventListener('keydown', listener);
 });
 const handler = (e: KeyboardEvent<HTMLElement>) => {
  if (pageScope || (e.target as HTMLElement).closest('[role="dialog"], [role="alertdialog"]') !== e.currentTarget.closest('[role="dialog"], [role="alertdialog"]')) return;
  ejecutar(e.nativeEvent, e.currentTarget);
 };
 const ayuda = <><p className="text-xs">Atajos: Alt+C cliente · Alt+P producto · Alt+L nueva línea · Ctrl+Enter revisar emisión · Escape cerrar sugerencias. Flechas/Enter seleccionan; Tab navega.</p>
 <Dialog open={review} onOpenChange={setReview}><DialogContent><DialogTitle>Revisar emisión</DialogTitle><DialogDescription>Revise cliente, almacén, líneas y totales. Confirmar ejecuta las mismas validaciones del botón Emitir.</DialogDescription><Button type="button" disabled={busy} onClick={() => { setReview(false); emitir(); }}>Confirmar emisión revisada</Button><Button type="button" onClick={() => setReview(false)}>Volver a revisar</Button></DialogContent></Dialog></>;
 return { handler, ayuda };
}
