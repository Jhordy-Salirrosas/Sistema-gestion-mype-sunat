/** Marca de la última lectura completada correctamente, en hora de Lima. */
export function InvoiceLastUpdated({ fecha, seccion }: { fecha: Date | null; seccion: string }) {
  if (!fecha) return null;
  return <p className="text-xs text-muted-foreground" aria-live="polite">
    Última actualización: <time aria-label={`Última actualización de ${seccion}`} dateTime={fecha.toISOString()}>
      {fecha.toLocaleTimeString('es-PE', { timeZone: 'America/Lima', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}
    </time> (Lima)
  </p>;
}
