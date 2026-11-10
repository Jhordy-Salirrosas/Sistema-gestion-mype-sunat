export function InvoiceNextNumber({ serie, actual }: { serie: string; actual?: number | null }) {
 const siguiente = typeof actual === 'number' && Number.isSafeInteger(actual) && actual >= 0 ? `${serie}-${String(actual + 1).padStart(8, '0')}` : null;
 return <p className="text-xs text-muted-foreground">Siguiente: {serie && siguiente ? siguiente : 'no disponible'} · Informativo; el número definitivo se asigna al emitir.</p>;
}
