/** Día civil fiscal; los días ya persistidos no son instantes que deban convertirse. */
const formatoFiscal = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Lima', year: 'numeric', month: '2-digit', day: '2-digit',
});

export function fechaFiscalLima(instante: Date = new Date(Date.now())): string {
  return formatoFiscal.format(instante);
}

/** Conserva la fecha explícita y fija el día fiscal solo cuando se omite. */
export function resolverFechaEmision(fecha?: string | null): string {
  return fecha ?? fechaFiscalLima();
}
