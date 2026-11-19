/** Traducciones de códigos ya descritos por las validaciones M1; nunca se infiere un código desconocido. */
export const ERRORES_M1: Readonly<Record<string, { mensaje: string; accion: string }>> = {
 '2108': { mensaje: 'La fecha está fuera del plazo de envío.', accion: 'Revise la fecha y el plazo del comprobante antes de corregirlo.' },
 '2957': { mensaje: 'El resumen quedó fuera del plazo permitido.', accion: 'Revise la fecha y las opciones disponibles para informar el documento.' },
 '3319': { mensaje: 'Las cuotas no coinciden con el importe pendiente.', accion: 'Revise el cronograma de cuotas antes de reenviar.' },
 '3267': { mensaje: 'Un vencimiento no es posterior a la emisión.', accion: 'Revise las fechas del cronograma antes de reenviar.' },
};
export function orientacionError(codigo?: string | null) {
 return ERRORES_M1[codigo ?? ''] ?? { mensaje: 'El comprobante requiere revisión.', accion: 'Abra el detalle, revise el motivo informado y corrija la información que corresponda antes de reintentar.' };
}
