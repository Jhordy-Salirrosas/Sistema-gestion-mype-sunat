/** Exportación completa sanitizada por Emma de transaction_history, Supabase, 10 nov 2026.
 * No se inventan IDs de historial ni company_id no proporcionados. No hay evento XSL.
 */
export const factura57 = {
  id: 'e0796a65-3fca-40a1-8028-7dd59c378f36', serie: 'F001', correlativo: 57,
  estado: 'ERROR_RED', transport_uncertain: true, sunat_response_code: null,
  created_at: new Date('2026-11-06T03:40:39.682Z'), updated_at: new Date('2026-11-10T17:27:26.372Z'),
};
export const historialReal57 = [
  { created_at: new Date('2026-11-06T15:38:26.753Z'), intento: 1, estado_anterior: 'PENDIENTE', estado_nuevo: 'PENDIENTE', codigo_error: null,
    mensaje_error: 'Rescate manual F001-00000057: EN_DLQ. El comprobante está en la cola de muertos y requiere revisión ', tiempo_respuesta_ms: null, circuit_breaker_state: 'CLOSED', http_status_code: null },
  { created_at: new Date('2026-11-10T17:27:18.430Z'), intento: 1, estado_anterior: 'PENDIENTE', estado_nuevo: 'PENDIENTE', codigo_error: null,
    mensaje_error: 'Rescate manual F001-00000057: ENCOLADO. Comprobante reencolado manualmente.', tiempo_respuesta_ms: null, circuit_breaker_state: 'CLOSED', http_status_code: null },
  { created_at: new Date('2026-11-10T17:27:26.405Z'), intento: 1, estado_anterior: 'PENDIENTE', estado_nuevo: 'ERROR_RED', codigo_error: 'MAX_REINTENTOS',
    mensaje_error: 'Reintentos agotados tras 1 intentos: ISSUER_STATUS_UNCERTAIN', tiempo_respuesta_ms: null, circuit_breaker_state: 'CLOSED', http_status_code: null },
];
