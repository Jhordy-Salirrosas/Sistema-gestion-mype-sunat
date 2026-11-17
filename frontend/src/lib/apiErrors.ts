/**
 * Utilidad robusta para extracción y formateo de mensajes de error de la API.
 * Garantiza que NUNCA se retorne un objeto a React (evitando 'Objects are not valid as a React child').
 */
export const RATE_LIMIT_MESSAGE = 'Demasiados intentos, espera un momento e inténtalo de nuevo';

export function getApiErrorStatus(error: unknown): number | undefined {
  const status = (error as { response?: { status?: unknown } } | null)?.response?.status;
  return typeof status === 'number' ? status : undefined;
}

/** Retry-After admite segundos o una fecha HTTP; sin valor válido se esperan 60 s. */
export function getApiRetryAfterMs(error: unknown, now = Date.now()): number {
  const headers = (error as { response?: { headers?: Record<string, unknown> & { get?: (name: string) => unknown } } } | null)?.response?.headers;
  const value = headers?.get?.('retry-after') ?? Object.entries(headers ?? {}).find(([key]) => key.toLowerCase() === 'retry-after')?.[1];
  if (typeof value !== 'string' && typeof value !== 'number') return 60_000;
  const text = String(value).trim();
  if (/^\d+(?:\.\d+)?$/.test(text)) {
    const delay = Number(text) * 1000;
    return Number.isFinite(delay) ? Math.max(1000, delay) : 60_000;
  }
  const date = /^[A-Za-z]{3},/.test(text) ? Date.parse(text) : NaN;
  return Number.isFinite(date) ? Math.max(1000, date - now) : 60_000;
}

export interface ApiValidationErrorItem {
  field?: string;
  rule?: string;
  message?: string;
}

export const extractApiErrorMessage = (
  error: unknown,
  fallback = 'Ha ocurrido un error inesperado al procesar la solicitud.'
): string => {
  if (getApiErrorStatus(error) === 429) return RATE_LIMIT_MESSAGE;
  if (!error) return fallback;

  if (typeof error === 'string') return error;

  const err = error as {
    response?: {
      data?: {
        message?: unknown;
        detail?: unknown;
        invalidParams?: unknown;
        title?: unknown;
      };
    };
    message?: unknown;
  };

  const data = err.response?.data;

  // 1. Array de validación del backend: [{ field, rule, message }]
  if (Array.isArray(data?.message)) {
    const messages = data.message
      .map((item) => {
        if (typeof item === 'object' && item !== null) {
          const v = item as ApiValidationErrorItem;
          return v.message || (v.field ? `${v.field}: ${v.rule || 'inválido'}` : '');
        }
        return typeof item === 'string' ? item : '';
      })
      .filter(Boolean);

    if (messages.length > 0) {
      return messages.join(' • ');
    }
  }

  // 2. Objeto único de validación: { field, rule, message }
  if (data?.message && typeof data.message === 'object') {
    const v = data.message as ApiValidationErrorItem;
    if (v.message) return v.message;
    if (v.field) return `${v.field}: ${v.rule || 'inválido'}`;
  }

  // 3. Cadena en response.data.message
  if (typeof data?.message === 'string' && data.message.trim().length > 0) {
    return data.message;
  }

  // 4. RFC 7807 Problem Details (detail)
  if (typeof data?.detail === 'string' && data.detail.trim().length > 0) {
    return data.detail;
  }

  // 5. RFC 7807 invalidParams
  if (Array.isArray(data?.invalidParams)) {
    const messages = data.invalidParams
      .map((item) => {
        if (typeof item === 'object' && item !== null) {
          const v = item as { field?: string; message?: string };
          return v.message || v.field || '';
        }
        return String(item);
      })
      .filter(Boolean);

    if (messages.length > 0) {
      return messages.join(' • ');
    }
  }

  // 6. Mensaje en error JS nativo
  if (typeof err.message === 'string' && err.message.trim().length > 0 && !/^Request failed with status code \d+$/i.test(err.message)) {
    return err.message;
  }

  return fallback;
};
