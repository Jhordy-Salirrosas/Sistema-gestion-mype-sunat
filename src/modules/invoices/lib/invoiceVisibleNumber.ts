/** Solo formato visual; no modifica identidad, reserva, rutas ni documentos fiscales. */
export const numeroVisible = (serie: string, correlativo: number) => `${serie}-${String(correlativo).padStart(8, '0')}`;
