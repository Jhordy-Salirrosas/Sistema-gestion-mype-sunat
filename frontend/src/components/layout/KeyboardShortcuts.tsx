import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui';
import { useServerPermissions } from '@/modules/auth/hooks/useServerPermissions';

const ATAJOS = [
  { tecla: 'g v', accion: 'Ventas', path: '/sales'},
  { tecla: 'g p', accion: 'Punto de venta', path: '/sales/pos'},
  { tecla: 'g h', accion: 'Historial de ventas', path: '/sales/historial'},
  { tecla: 'g b', accion: 'CxC y cobros', path: '/sales/cobranzas'},
  { tecla: 'g c', accion: 'Compras', path: '/purchases'},
  { tecla: 'g g', accion: 'Gastos', path: '/purchases/expenses'},
  { tecla: 'g f', accion: 'Facturación', path: '/invoices'},
  { tecla: 'g i', accion: 'Inventario', path: '/inventory'},
  { tecla: 'g a', accion: 'Contabilidad', path: '/accounting'},
  { tecla: '?', accion: 'Ver estos atajos', path: ''},
] as const;

export function KeyboardShortcuts() {
  const navigate = useNavigate();
  const permissions=useServerPermissions();
  const [ayuda, setAyuda] = useState(false);
  const [prefijo, setPrefijo] = useState(false);
  const timer = useRef<number | null>(null);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const editable = target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA' || target?.tagName === 'SELECT' || target?.isContentEditable;
      if (editable || event.ctrlKey || event.metaKey || event.altKey) return;
      // Firefox/teclado español puede reportar '?' o Shift+Slash.
      if (event.key === '?' || (event.code === 'Slash' && event.shiftKey)) {
        event.preventDefault();
        setAyuda(true);
        return;
      }
      if (document.querySelector('[role="dialog"]')) return;
      if (event.key === 'Escape') { setPrefijo(false); setAyuda(false); return; }
      if (event.key.toLowerCase() === 'g') {
        setPrefijo(true);
        if (timer.current) window.clearTimeout(timer.current);
        timer.current = window.setTimeout(() => setPrefijo(false), 1500);
        return;
      }
      if (!prefijo) return;
      const atajo = ATAJOS.find((a) => a.tecla === `g ${event.key.toLowerCase()}`);
      if (atajo && (!atajo.path || permissions.canNavigate(atajo.path))) {
        event.preventDefault();
        navigate(atajo.path);
      }
      setPrefijo(false);
      if (timer.current) window.clearTimeout(timer.current);
    };
    window.addEventListener('keydown', onKey, true);
    return () => { window.removeEventListener('keydown', onKey, true); if (timer.current) window.clearTimeout(timer.current); };
  }, [prefijo, permissions.canNavigate, navigate]);

  return (
    <>
      {prefijo ? <div role="status" className="fixed bottom-4 left-4 z-50 rounded-md border bg-background px-3 py-2 text-xs shadow-lg">g… <span className="text-muted-foreground">pulsa v, c, f, i, a, h o b</span></div> : null}
      <Dialog open={ayuda} onOpenChange={setAyuda}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Atajos de teclado</DialogTitle><DialogDescription>Navega sin usar el mouse. Los atajos no funcionan mientras escribes.</DialogDescription></DialogHeader>
          <div className="space-y-1 text-xs">
            <div className="flex justify-between rounded bg-muted/50 px-2 py-1.5"><span>Buscar módulo o acción</span><kbd className="rounded border px-1.5">Ctrl/⌘ K</kbd></div>
            {ATAJOS.filter((a) => (!a.path || permissions.canNavigate(a.path))).map((a) => <div key={a.tecla} className="flex justify-between rounded px-2 py-1.5"><span>{a.accion}</span><kbd className="rounded border px-1.5">{a.tecla}</kbd></div>)}
            <div className="flex justify-between rounded px-2 py-1.5"><span>Cerrar</span><kbd className="rounded border px-1.5">Esc</kbd></div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
