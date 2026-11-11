export function InvoiceNextNumber({ serie, actual, cargando = false, error = false }: { serie: string; actual?: number | null; cargando?: boolean; error?: boolean }) {
 const siguiente = typeof actual === 'number' && Number.isSafeInteger(actual) && actual >= 0 ? `${serie}-${String(actual + 1).padStart(8, '0')}` : null;
 if (cargando) return <p role="status" className="text-xs">Cargando configuración de serie y numeración…</p>;
 if (error) return <p role="alert" className="text-xs">No se pudo cargar la numeración de la serie.</p>;
 return <p className="text-xs text-muted-foreground">Siguiente: {serie && siguiente ? siguiente : 'no disponible'} · Informativo; el número definitivo se asigna al emitir.</p>;
}
