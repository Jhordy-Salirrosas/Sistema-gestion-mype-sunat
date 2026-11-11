import { extractApiErrorMessage } from '@/lib/apiErrors';

/** Una instancia por formulario: el mismo cuerpo conserva la clave hasta el éxito. */
export function crearIntentoEmision() {
  let pendiente: { cuerpo: string; clave: string } | undefined;
  return {
    clavePara(payload: unknown): string {
      const cuerpo = JSON.stringify(payload);
      if (!pendiente || pendiente.cuerpo !== cuerpo) {
        pendiente = { cuerpo, clave: crypto.randomUUID() };
      }
      return pendiente.clave;
    },
    completar() { pendiente = undefined; },
  };
}

export function mensajeErrorEmision(error: unknown): string {
  const respuesta = (error as { response?: { status?: number; data?: { code?: unknown } } })?.response;
  const fallback = respuesta?.status === 409
    ? 'Conflicto de emisión (409). Revisa el estado del comprobante y los datos del formulario.'
    : 'No se pudo completar la solicitud de emisión.';
  const mensaje = extractApiErrorMessage(error, fallback);
  const codigo = 'IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_BODY';
  if (respuesta?.status === 409 && (respuesta.data?.code === codigo || mensaje === codigo)) {
    return 'Conflicto de emisión (409): la clave de este intento ya se usó con otros datos. Tus datos se conservan. Verifica si el comprobante ya fue creado antes de iniciar uno nuevo.';
  }
  return mensaje;
}
