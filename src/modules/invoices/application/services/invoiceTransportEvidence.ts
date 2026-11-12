/** Evidencia de transporte del historial COMPLETO, sin inferir envío por estado/intento. */
export interface EventoTransporte {
  created_at: Date;
  codigo_error: string | null;
  mensaje_error: string | null;
  estado_nuevo: string;
  tiempo_respuesta_ms: number | null;
  http_status_code: number | null;
}
export type ClaseTransporte = 'BLOQUEO_PREVIO_PROBADO' | 'ENVIO_INCIERTO' | 'EVIDENCIA_INSUFICIENTE';
export const INICIO_TRANSPORTE = 'M1_TRANSPORT_STARTED';
export const CONSULTA_INCIERTA = 'M1_TRANSPORT_UNCERTAIN';
const esBloqueo = (e: EventoTransporte) => /^(Bloqueado antes de enviar por la validación XSL:|Validación XSL local:)/.test(e.mensaje_error ?? '');
function esTransporte(e: EventoTransporte): boolean {
  if (esBloqueo(e) || e.codigo_error === CONSULTA_INCIERTA || /^(Rescate manual |Reintento manual )/.test(e.mensaje_error ?? '')) return false;
  return e.codigo_error === INICIO_TRANSPORTE || /^(TRANSPORT_ERROR|HTTP_\d+|CDR_DECODE_ERROR|CDR_REFERENCE_MISMATCH|SOAP_FAULT)$/.test(e.codigo_error ?? '') ||
    e.http_status_code != null || e.tiempo_respuesta_ms != null ||
    /^(SOAP Fault del billService|Timeout de .*billService|Error de red contra el billService)/.test(e.mensaje_error ?? '');
}
/** La evidencia de envío es histórica; solo una resolución concluyente cierra la incertidumbre. */
export function resumirTransporte(history: readonly EventoTransporte[]) {
  const transportes = history.filter(esTransporte);
  const actividad = history.filter(e => esTransporte(e) || e.codigo_error === CONSULTA_INCIERTA);
  const ultimaActividad = Math.max(...actividad.map(e => e.created_at.getTime()));
  const resuelto = history.some(e => ['ACEPTADO', 'OBSERVADO', 'RECHAZADO', 'ANULADO'].includes(e.estado_nuevo) &&
    esTransporte(e) && e.codigo_error !== INICIO_TRANSPORTE && e.created_at.getTime() >= ultimaActividad);
  return { envioAcreditado: transportes.length > 0, incertidumbrePendiente: actividad.length > 0 && !resuelto,
    bloqueoPrevioProbado: history.some(esBloqueo) && actividad.length === 0 };
}
export function clasificarTransporte(history: readonly EventoTransporte[]): ClaseTransporte {
  const evidencia = resumirTransporte(history);
  if (evidencia.incertidumbrePendiente) return 'ENVIO_INCIERTO';
  return evidencia.bloqueoPrevioProbado ? 'BLOQUEO_PREVIO_PROBADO' : 'EVIDENCIA_INSUFICIENTE';
}
