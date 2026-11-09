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
  if ((error as { response?: { status?: number } })?.response?.status === 409) {
    return 'Conflicto de emisión (409): la clave de este intento ya se usó con otros datos. Tus datos se conservan. Verifica si el comprobante ya fue creado antes de iniciar uno nuevo.';
  }
  return error instanceof Error ? error.message : 'Error desconocido';
}
