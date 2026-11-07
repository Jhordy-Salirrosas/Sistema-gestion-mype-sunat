import axios, { type AxiosError, type InternalAxiosRequestConfig } from 'axios';
import { API_BASE_URL } from '@/config/env.config';
import { useAuthStore } from '@/stores/authStore';

interface CustomAxiosRequestConfig extends InternalAxiosRequestConfig {
  _retry?: boolean;
}

/**
 * Instancia centralizada de Axios para la comunicación con la API del Backend.
 * Implementa cookies seguras (withCredentials: true) e interceptores
 * con cola de espera para renovación automática en segundo plano (Silent Refresh).
 */
export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
});

// Variables para gestionar la cola de peticiones durante el Silent Refresh
let isRefreshing = false;
let failedQueue: Array<{
  resolve: (token: string) => void;
  reject: (error: unknown) => void;
}> = [];

const processQueue = (error: unknown, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else if (token) {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

// Interceptor de Petición (Request Interceptor)
apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const { token, activeCompany } = useAuthStore.getState();

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    if (activeCompany?.tenantId) {
      config.headers['X-Tenant-Id'] = activeCompany.tenantId;
    }

    return config;
  },
  (error: AxiosError) => Promise.reject(error)
);

// Interceptor de Respuesta (Response Interceptor con Silent Refresh Queue)
apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as CustomAxiosRequestConfig;

    if (!originalRequest || !error.response) {
      return Promise.reject(error);
    }

    const isUnauthorized = error.response.status === 401;
    const requestUrl = originalRequest.url || '';
    const isAuthEndpoint =
      requestUrl.includes('/auth/login') ||
      requestUrl.includes('/auth/register') ||
      requestUrl.includes('/auth/refresh');

    // Si es 401 pero viene del login, registro o refresco, o ya fue reintentada, rechazar directamente
    if (!isUnauthorized || isAuthEndpoint || originalRequest._retry) {
      return Promise.reject(error);
    }

    // Si ya hay un refresco en proceso, encolar esta petición
    if (isRefreshing) {
      return new Promise<string>((resolve, reject) => {
        failedQueue.push({ resolve, reject });
      })
        .then((newToken) => {
          originalRequest.headers.Authorization = `Bearer ${newToken}`;
          return apiClient(originalRequest);
        })
        .catch((err) => Promise.reject(err));
    }

    originalRequest._retry = true;
    isRefreshing = true;

    try {
      // Petición directa a refresco para evitar ciclos de interceptor
      const refreshResponse = await axios.post<{ accessToken?: string; token?: string }>(
        `${API_BASE_URL}/auth/refresh`,
        {},
        { withCredentials: true }
      );

      const newToken = refreshResponse.data.accessToken || refreshResponse.data.token;

      if (!newToken) {
        throw new Error('No se recibió nuevo accessToken en refresh');
      }

      useAuthStore.getState().setToken(newToken);
      processQueue(null, newToken);

      originalRequest.headers.Authorization = `Bearer ${newToken}`;
      return apiClient(originalRequest);
    } catch (refreshError) {
      processQueue(refreshError, null);
      useAuthStore.getState().logout();

      const currentPath = window.location.pathname;
      if (!currentPath.includes('/login') && !currentPath.includes('/register')) {
        window.location.href = '/login';
      }

      return Promise.reject(refreshError);
    } finally {
      isRefreshing = false;
    }
  }
);
