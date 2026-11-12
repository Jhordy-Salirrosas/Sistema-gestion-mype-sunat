/**
 * Utilidades de redacción de datos sensibles.
 *
 * POR QUÉ EXISTEN
 *
 * El módulo SIRE maneja tres secretos que nunca deben aparecer en un log ni
 * en una respuesta: la clave SOL, el Client Secret de la aplicación y el
 * token de acceso de SUNAT. La redacción estaba duplicada en el cliente, en el
 * worker y en el controlador, con el riesgo de que una copia se quedara atrás
 * y dejara filtrar un secreto.
 *
 * Aquí vive UNA sola implementación. Es una regla pura: no conoce Nest, ni
 * Prisma, ni PgBoss ni SUNAT.
 */

/** Texto que sustituye a cualquier valor sensible. */
export const REDACTED_VALUE = '[REDACTED]';

/** `Authorization: Bearer <token>` en un cuerpo de error o en un log. */
const BEARER_PATTERN = /bearer\s+[^\s,;]+/gi;

/** `password=...`, `client_secret: ...`, `access_token=...`. */
const SECRET_FIELD_PATTERN =
  /\b(password|client_secret|access_token|authorization)\s*[:=]\s*([^\s,;&]+)/gi;

/** Credenciales embebidas en una URL: `postgres://user:clave@host`. */
const URL_CREDENTIALS_PATTERN =
  /([a-z][a-z0-9+.-]*:\/\/)([^\s/:@]+):([^\s/@]+)@/gi;

/** Claves de un objeto que nunca se devuelven tal cual. */
const SENSITIVE_KEY_PATTERN = /password|secret|token/i;

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/**
 * Sustituye los secretos conocidos y los patrones sensibles de un texto.
 *
 * @param text Texto a depurar (mensaje de error, diagnóstico, cuerpo).
 * @param secrets Valores literales que deben desaparecer.
 */
export function redactSensitiveText(
  text: string,
  secrets: readonly string[] = [],
): string {
  const withoutLiterals = secrets.reduce(
    (result, secret) =>
      secret ? result.split(secret).join(REDACTED_VALUE) : result,
    text,
  );

  return withoutLiterals
    .replace(URL_CREDENTIALS_PATTERN, `$1$2:${REDACTED_VALUE}@`)
    .replace(BEARER_PATTERN, `Bearer ${REDACTED_VALUE}`)
    .replace(SECRET_FIELD_PATTERN, `$1=${REDACTED_VALUE}`);
}

/**
 * Depura un valor arbitrario: texto, arreglo u objeto.
 *
 * Las claves cuyo nombre parece sensible se sustituyen completas; el resto
 * de valores se depuran de forma recursiva.
 */
export function redactSensitiveValue(
  value: unknown,
  secrets: readonly string[] = [],
): unknown {
  if (typeof value === 'string') {
    return redactSensitiveText(value, secrets);
  }
  if (Array.isArray(value)) {
    return value.map((item) => redactSensitiveValue(item, secrets));
  }
  if (!isRecord(value)) {
    return value;
  }

  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [
      key,
      SENSITIVE_KEY_PATTERN.test(key)
        ? REDACTED_VALUE
        : redactSensitiveValue(item, secrets),
    ]),
  );
}

/**
 * Resume una excepción en una línea apta para el log del servidor.
 *
 * Nunca devuelve la traza: solo nombre, código, estado y mensaje depurado.
 */
export function describeErrorSafely(
  error: unknown,
  secrets: readonly string[] = [],
  maxLength = 500,
): string {
  if (!(error instanceof Error)) {
    return 'Error desconocido';
  }

  const metadata = error as Error & { code?: unknown; status?: unknown };
  const code =
    typeof metadata.code === 'string' ? ` code=${metadata.code}` : '';
  const status =
    typeof metadata.status === 'number' ? ` status=${metadata.status}` : '';
  const message = redactSensitiveText(error.message, secrets).slice(
    0,
    maxLength,
  );

  return `${error.name}${status}${code}: ${message}`;
}
