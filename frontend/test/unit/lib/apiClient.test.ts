import { afterEach, expect, it, vi } from 'vitest';
import type { InternalAxiosRequestConfig } from 'axios';

// Ejercita permisos y cliente reales; solo se sustituye el transporte HTTP.
vi.unmock('@/modules/auth/services/permissionsApi');
afterEach(() => {
  vi.unstubAllEnvs();
  localStorage.clear();
  vi.resetModules();
});

async function productionClient() {
  vi.resetModules();
  vi.stubEnv('PROD', true);
  vi.stubEnv('VITE_API_URL', undefined);
  const { apiClient } = await import('@/lib/axios');
  return apiClient;
}

it('en producción usa Render directo con el prefijo /api/v1', async () => {
  const client = await productionClient();
  const { ENV } = await import('@/config/env.config');
  expect(ENV.VITE_API_URL).toBe('https://sistema-mype-sunat-back.onrender.com/api/v1');
  expect(client.defaults.baseURL).toBe('https://sistema-mype-sunat-back.onrender.com/api/v1');
  expect(client.getUri({ url: '/auth/login' })).toBe('https://sistema-mype-sunat-back.onrender.com/api/v1/auth/login');
});

it('conserva el proxy local fuera de producción', async () => {
  vi.resetModules();
  vi.stubEnv('PROD', false);
  vi.stubEnv('VITE_API_URL', undefined);
  const { API_BASE_URL } = await import('@/config/env.config');
  expect(API_BASE_URL).toBe('/api/v1');
});

it.each([
  ['/api/v1', '/api/v1'],
  ['https://sistema-mype-sunat-back.onrender.com/', 'https://sistema-mype-sunat-back.onrender.com/api/v1'],
  ['https://sistema-mype-sunat-back.onrender.com/api/v1/', 'https://sistema-mype-sunat-back.onrender.com/api/v1'],
])('respeta VITE_API_URL=%s sin duplicar el prefijo', async (value, expected) => {
  vi.resetModules();
  vi.stubEnv('PROD', true);
  vi.stubEnv('VITE_API_URL', value);
  const { API_BASE_URL } = await import('@/config/env.config');
  expect(API_BASE_URL).toBe(expected);
});

it('login y permisos usan el cliente centralizado con credenciales, token y empresa', async () => {
  const client = await productionClient();
  const { useAuthStore } = await import('@/stores/authStore');
  const { authApi } = await import('@/modules/auth/services/authApi');
  const { permissionsApi } = await import('@/modules/auth/services/permissionsApi');
  const { serverSnapshot } = await import('../../fixtures/permissionsServer');
  const snapshot = serverSnapshot();
  const loginResponse = { accessToken: 'token-de-prueba', user: { id: 'user', role: 'ADMIN' } };
  const requests: InternalAxiosRequestConfig[] = [];
  client.defaults.adapter = async config => {
    requests.push(config);
    return { config, status: 200, statusText: 'OK', headers: {}, data: config.url === '/auth/login' ? loginResponse : snapshot };
  };
  useAuthStore.setState({ token: null, user: null, activeCompany: null });
  expect(await authApi.login({ email: 'actor@example.invalid', password: 'Password123!#' })).toEqual(loginResponse);
  useAuthStore.setState({ token: loginResponse.accessToken, activeCompany: { tenantId: 'company', ruc: '20100070970', razonSocial: 'Empresa' } });
  expect(await permissionsApi.mine()).toEqual(snapshot);
  expect(requests.map(config => client.getUri(config))).toEqual([
    'https://sistema-mype-sunat-back.onrender.com/api/v1/auth/login',
    'https://sistema-mype-sunat-back.onrender.com/api/v1/auth/permissions/me',
  ]);
  expect(requests.map(config => config.method)).toEqual(['post', 'get']);
  expect(requests.every(config => config.withCredentials === true)).toBe(true);
  expect(requests[1].headers.Authorization).toBe('Bearer token-de-prueba');
  expect(requests[1].headers['X-Tenant-Id']).toBe('company');
  useAuthStore.getState().logout();
});

it('un 429 de login o permisos conserva su estado y el aviso honesto, sin reintentos', async () => {
  const client = await productionClient();
  const { AxiosError } = await import('axios');
  const { authApi } = await import('@/modules/auth/services/authApi');
  const { permissionsApi } = await import('@/modules/auth/services/permissionsApi');
  const { extractApiErrorMessage, getApiErrorStatus, RATE_LIMIT_MESSAGE, LOGIN_RATE_LIMIT_MESSAGE } = await import('@/lib/apiErrors');
  const adapter = vi.fn(async (config: InternalAxiosRequestConfig) => {
    throw new AxiosError('Limited', 'ERR_BAD_REQUEST', config, undefined, {
      config, status: 429, statusText: 'Too Many Requests', headers: { 'retry-after': '60' },
      data: { message: 'Credenciales de acceso incorrectas' },
    });
  });
  client.defaults.adapter = adapter;
  for (const request of [() => authApi.login({ email: 'actor@example.invalid', password: 'Password123!#' }), () => permissionsApi.mine()]) {
    const error = await request().catch(error => error);
    expect(getApiErrorStatus(error)).toBe(429);
    expect(extractApiErrorMessage(error)).toBe('Demasiados intentos, espera un momento e inténtalo de nuevo');
  }
  expect(adapter).toHaveBeenCalledTimes(2);
  expect(RATE_LIMIT_MESSAGE).toBe('Demasiados intentos, espera un momento e inténtalo de nuevo');
  expect(LOGIN_RATE_LIMIT_MESSAGE).toBe('Has intentado iniciar sesión demasiadas veces. Por favor, espera unos minutos e intenta de nuevo.');
});
