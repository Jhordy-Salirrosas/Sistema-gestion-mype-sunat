/** Solo nombre/mensaje sanitizados; nunca stack, sobres SOAP ni objetos de credenciales. */
export function detalleErrorConsulta(error: unknown, secrets: string[] = []): { nombre: string; mensaje: string } {
  const nombre = error instanceof Error ? error.name.replace(/[^A-Za-z0-9_.-]/g, '').slice(0, 80) : 'ErrorDesconocido';
  let mensaje = error instanceof Error ? error.message : 'Error desconocido';
  const environmentSecrets = Object.entries(process.env)
    .filter(([key]) => /PASSWORD|PASS_ENCRYPTED|SECRET|TOKEN|ENCRYPTION_KEY|CERT_BASE64|SOL_USER|DATABASE_URL|DIRECT_URL/.test(key))
    .map(([, value]) => value).filter((value): value is string => Boolean(value));
  for (const secret of [...secrets, ...environmentSecrets].filter(Boolean).sort((a, b) => b.length - a.length)) {
    mensaje = mensaje.split(secret).join('[REDACTADO]');
  }
  mensaje = mensaje.replace(/<[^>]+>[\s\S]*<\/[^>]+>/g, '[XML OMITIDO]')
    .replace(/(?:https?|postgres(?:ql)?):\/\/[^\s]+/gi, '[URL OMITIDA]')
    .replace(/((?:password|passwd|sol_pass_encrypted|cert_pass_encrypted|token|secret)\s*[=:]\s*)(?:"[^"]*"|'[^']*'|[^\s,;]+)/gi, '$1[REDACTADO]')
    .replace(/\p{Cc}/gu, ' ').slice(0, 500);
  return { nombre: nombre || 'Error', mensaje };
}
