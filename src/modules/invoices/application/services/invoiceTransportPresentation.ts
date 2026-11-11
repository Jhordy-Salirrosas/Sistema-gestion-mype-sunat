/** Evidencia positiva para la vista; no decide reintentos ni cambia marcadores. */
export interface EvidenciaTransporteVista {
 codigo_error: string | null;
 mensaje_error: string | null;
 tiempo_respuesta_ms?: number | null;
 http_status_code?: number | null;
}
export function transporteAcreditado(cdr: { codigo: string | null } | null, history: readonly EvidenciaTransporteVista[] = []): boolean {
 if (cdr?.codigo) return true;
 return history.some(e => {
  const mensaje = e.mensaje_error ?? '';
  if (e.codigo_error === 'M1_TRANSPORT_STARTED') return true;
  if (mensaje.includes('ISSUER_STATUS_UNCERTAIN') || e.codigo_error === 'ISSUER_STATUS_UNCERTAIN' || e.codigo_error === 'M1_TRANSPORT_UNCERTAIN' || /^(Rescate manual |Reintento manual |Bloqueado antes de enviar por la validación XSL:|Validación XSL local:)/.test(mensaje)) return false;
  return /^(TRANSPORT_ERROR|HTTP_\d+|CDR_DECODE_ERROR|CDR_REFERENCE_MISMATCH|SOAP_FAULT)$/.test(e.codigo_error ?? '') || e.http_status_code != null || e.tiempo_respuesta_ms != null || /^(SOAP Fault del billService|Timeout de .*billService|Error de red contra el billService)/.test(mensaje);
 });
}
