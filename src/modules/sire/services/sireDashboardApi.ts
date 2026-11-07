import { API_BASE_URL } from '@/config/env.config';
import { useAuthStore } from '@/stores/authStore';
import { SireApiError } from './sireApi';
import type {
  SireDashboardHistoryPoint,
  SireDashboardHistoryRequest,
  SireDashboardHistoryResponse,
  SireDashboardMetrics,
} from '../types/sire.types';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const isNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

const isNullableNumber = (value: unknown): value is number | null => value === null || isNumber(value);

const apiUrl = API_BASE_URL;

const isHistoryPoint = (value: unknown): value is SireDashboardHistoryPoint =>
  isRecord(value) &&
  typeof value.timestamp === 'string' &&
  isNumber(value.retries) &&
  isNullableNumber(value.availabilityPercent) &&
  isNumber(value.observedCalls) &&
  isNumber(value.successfulCalls) &&
  isNumber(value.failedCalls);

const validateMetrics = (value: unknown): SireDashboardMetrics => {
  if (
    !isRecord(value) ||
    (value.state !== 'CLOSED' && value.state !== 'OPEN' && value.state !== 'HALF_OPEN') ||
    !isNumber(value.recentFailedCalls) ||
    !isNumber(value.failureRate) ||
    !isNumber(value.slowCallRate) ||
    !isNumber(value.bufferedInvoicesCount) ||
    !isNumber(value.totalCalls) ||
    !isNumber(value.successfulCalls) ||
    !isNumber(value.failedCalls) ||
    !isNumber(value.totalRetries) ||
    typeof value.lastStateChange !== 'string' ||
    typeof value.circuitBreakerScope !== 'string' ||
    typeof value.activityScope !== 'string' ||
    !isNullableNumber(value.mttdSeconds) ||
    !isNullableNumber(value.mttrSeconds) ||
    !isNullableNumber(value.mtbfSeconds)
  ) {
    throw new SireApiError('El servidor devolvió métricas SIRE con un formato inválido.', null);
  }

  const mttd =
    isNullableNumber(value.mttd) ? value.mttd : isNullableNumber(value.mttdSeconds) ? value.mttdSeconds : null;
  const mttr =
    isNullableNumber(value.mttr) ? value.mttr : isNullableNumber(value.mttrSeconds) ? value.mttrSeconds : null;
  const mtbf =
    isNullableNumber(value.mtbf) ? value.mtbf : isNullableNumber(value.mtbfSeconds) ? value.mtbfSeconds : null;

  return {
    state: value.state,
    recentFailedCalls: value.recentFailedCalls,
    failureRate: value.failureRate,
    slowCallRate: value.slowCallRate,
    bufferedInvoicesCount: value.bufferedInvoicesCount,
    totalCalls: value.totalCalls,
    successfulCalls: value.successfulCalls,
    failedCalls: value.failedCalls,
    totalRetries: value.totalRetries,
    lastStateChange: value.lastStateChange,
    circuitBreakerScope: value.circuitBreakerScope,
    activityScope: value.activityScope,
    mttdSeconds: value.mttdSeconds,
    mttrSeconds: value.mttrSeconds,
    mtbfSeconds: value.mtbfSeconds,
    mttd,
    mttr,
    mtbf,
  };
};

const validateHistory = (value: unknown): SireDashboardHistoryResponse => {
  if (!isRecord(value)) {
    throw new SireApiError('El servidor devolvió un historial SIRE con un formato inválido.', null);
  }

  const rawPoints = Array.isArray(value.data) ? value.data : Array.isArray(value.points) ? value.points : [];
  const pagination = isRecord(value.pagination) ? value.pagination : isRecord(value) ? value : null;
  const points = rawPoints.filter(isHistoryPoint);

  if (
    (!Array.isArray(value.data) && !Array.isArray(value.points)) ||
    points.length !== rawPoints.length ||
    !pagination ||
    !isNumber(pagination.limit) ||
    !isNumber(pagination.offset) ||
    typeof pagination.hasMore !== 'boolean'
  ) {
    throw new SireApiError('El servidor devolvió un historial SIRE con un formato inválido.', null);
  }

  return {
    points,
    limit: pagination.limit,
    offset: pagination.offset,
    hasMore: pagination.hasMore,
  };
};

const request = async (path: string): Promise<unknown> => {
  const token = useAuthStore.getState().token;
  if (!token) {
    throw new SireApiError('Tu sesión venció o no es válida. Inicia sesión nuevamente.', 401);
  }

  let response: Response;
  try {
    response = await fetch(`${apiUrl}${path}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
      },
    });
  } catch (error) {
    if (error instanceof TypeError) {
      throw new SireApiError('No fue posible conectar con el servidor. Verifica tu conexión e inténtalo nuevamente.', null);
    }
    throw error;
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch (error) {
    if (!(error instanceof SyntaxError)) throw error;
    if (response.ok) {
      throw new SireApiError('El servidor devolvió una respuesta con formato inválido.', response.status);
    }
  }

  if (!response.ok) {
    if (response.status === 401) {
      useAuthStore.getState().logout();
      if (typeof window !== 'undefined') {
        window.history.pushState({}, '', '/login?reason=session-expired');
        window.dispatchEvent(new PopStateEvent('popstate'));
      }
    }
    if (response.status === 404 && import.meta.env.DEV) {
      console.warn(`[SIRE dashboard] Endpoint no disponible: ${apiUrl}${path}`);
    }
    const rootMessage =
      typeof body === 'object' && body !== null && 'message' in body && typeof body.message === 'string'
        ? body.message
        : null;
    const nestedMessage =
      typeof body === 'object' &&
      body !== null &&
      'error' in body &&
      typeof body.error === 'object' &&
      body.error !== null &&
      'message' in body.error &&
      typeof body.error.message === 'string'
        ? body.error.message
        : null;
    const detail = rootMessage ?? nestedMessage;
    throw new SireApiError(`No se pudo consultar el dashboard SIRE (HTTP ${response.status}).${detail ? ` ${detail}` : ''}`, response.status);
  }

  return body;
};

export const sireDashboardApi = {
  async getMetrics(): Promise<SireDashboardMetrics> {
    return validateMetrics(await request('/sire/dashboard/metrics'));
  },

  async getHistory(params: SireDashboardHistoryRequest): Promise<SireDashboardHistoryResponse> {
    const query = new URLSearchParams({
      start: params.start,
      end: params.end,
      granularity: params.granularity,
      limit: String(params.limit),
      offset: String(params.offset),
    });
    return validateHistory(await request(`/sire/dashboard/history?${query.toString()}`));
  },
};