import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, CornerDownLeft } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui';
import { useServerPermissions } from '@/modules/auth/hooks/useServerPermissions';
import { NAV_ITEMS } from './Sidebar';

interface Comando { title: string; section: string; path: string }

export function CommandPalette() {
  const [abierto, setAbierto] = useState(false);
  const [busqueda, setBusqueda] = useState('');
  const [indice, setIndice] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listaRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const permissions=useServerPermissions();

  const comandos = useMemo<Comando[]>(() => {
    return NAV_ITEMS
      .filter((item) => permissions.canNavigate(item.path))
      .flatMap((item) => {
        if (!item.subItems?.length) return [{ title: item.title, section: item.title, path: item.path }];
        return item.subItems
          .filter((sub) => permissions.canNavigate(sub.path))
          .map((sub) => ({ title: sub.title, section: item.title, path: sub.path }));
      });
  }, [permissions.canNavigate]);

  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return comandos;
    return comandos.filter((c) => `${c.title} ${c.section} ${c.path}`.toLowerCase().includes(q));
  }, [comandos, busqueda]);

  useEffect(() => {
    const abrir = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setAbierto((prev) => !prev);
      }
      if (event.key === 'Escape') setAbierto(false);
    };
    const abrirEvento = () => setAbierto(true);
    window.addEventListener('keydown', abrir);
    window.addEventListener('open-command-palette', abrirEvento);
    return () => {
      window.removeEventListener('keydown', abrir);
      window.removeEventListener('open-command-palette', abrirEvento);
    };
  }, []);

  useEffect(() => {
    listaRef.current?.querySelector<HTMLElement>('[data-active="true"]')?.scrollIntoView?.({ block: 'nearest' });
  }, [indice, filtrados]);

  useEffect(() => {
    if (abierto) {
      setBusqueda(''); setIndice(0);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [abierto]);

  const ejecutar = (comando: Comando) => {
    navigate(comando.path);
    setAbierto(false);
  };

  return (
    <Dialog open={abierto} onOpenChange={setAbierto}>
      <DialogContent className="max-w-xl gap-0 overflow-hidden p-0" showCloseButton={false}>
        <DialogTitle className="sr-only">Buscar módulo o acción</DialogTitle>
        <div className="flex items-center gap-2 border-b px-3 py-2">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input
            ref={inputRef}
            aria-label="Buscar módulo o acción"
            placeholder="Buscar módulo o acción…"
            className="h-9 flex-1 bg-transparent text-sm outline-none"
            value={busqueda}
            onChange={(e) => { setBusqueda(e.target.value); setIndice(0); }}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') { e.preventDefault(); setIndice((i) => Math.min(i + 1, filtrados.length - 1)); }
              if (e.key === 'ArrowUp') { e.preventDefault(); setIndice((i) => Math.max(i - 1, 0)); }
              if (e.key === 'Enter' && filtrados[indice]) { e.preventDefault(); ejecutar(filtrados[indice]); }
            }}
          />
          <kbd className="rounded border px-1.5 py-0.5 text-[10px] text-muted-foreground">Esc</kbd>
        </div>
        <div ref={listaRef} className="max-h-80 overflow-y-auto p-1">
          {filtrados.map((c, i) => (
            <button
              key={`${c.section}-${c.path}`}
              type="button"
              onMouseEnter={() => setIndice(i)}
              onClick={() => ejecutar(c)}
              data-active={i === indice}
              className={`flex w-full items-center justify-between rounded-md px-2 py-2 text-left text-xs ${i === indice ? 'bg-muted text-foreground' : 'text-muted-foreground hover:bg-muted/60'}`}
            >
              <span><span className="block font-medium">{c.title}</span><span className="text-[10px] opacity-70">{c.section}</span></span>
              {i === indice ? <CornerDownLeft className="h-3.5 w-3.5" /> : null}
            </button>
          ))}
          {filtrados.length === 0 ? <p className="p-3 text-center text-xs text-muted-foreground">Sin coincidencias.</p> : null}
        </div>
        <div className="flex items-center gap-3 border-t px-3 py-1.5 text-[10px] text-muted-foreground"><span>↑↓ navegar</span><span>Enter abrir</span><span>Ctrl/⌘ K buscar</span><span>? atajos</span></div>
      </DialogContent>
    </Dialog>
  );
}
