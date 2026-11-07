import { apiClient } from '@/lib/axios';
import {
  type ApiActionResponse,
  type AuthResponse,
  type ChangePasswordPayload,
  type CompanyTenant,
  type LoginPayload,
  type RegisterPayload,
  type UpdateProfilePayload,
  type UserProfileResponse,
} from '../types/auth.types';

/**
 * Servicio API para el módulo de Autenticación y Perfil (Fase 6).
 * Conecta con los endpoints REST bajo /auth/*.
 */
export const authApi = {
  /**
   * Inicia sesión con correo y contraseña.
   * El backend responde con accessToken y setea la cookie HttpOnly de refreshToken.
   */
  login: async (credentials: LoginPayload): Promise<AuthResponse> => {
    const response = await apiClient.post<AuthResponse>('/auth/login', credentials);
    return response.data;
  },

  /**
   * Registra atómicamente una nueva MYPE cliente y a su usuario Administrador.
   */
  register: async (payload: RegisterPayload): Promise<AuthResponse> => {
    const response = await apiClient.post<AuthResponse>('/auth/register', payload);
    return response.data;
  },

  /**
   * Cierra la sesión activa revocando el Refresh Token en BD y limpiando la cookie.
   */
  logout: async (): Promise<ApiActionResponse> => {
    const response = await apiClient.post<ApiActionResponse>('/auth/logout');
    return response.data;
  },

  /**
   * Renueva el Access Token mediante la cookie segura HttpOnly enviada automáticamente.
   */
  refreshToken: async (): Promise<AuthResponse> => {
    const response = await apiClient.post<AuthResponse>('/auth/refresh');
    return response.data;
  },

  /**
   * Consulta los datos del usuario en sesión y los metadatos de su empresa MYPE.
   */
  getProfile: async (): Promise<UserProfileResponse> => {
    const response = await apiClient.get<UserProfileResponse>('/auth/profile');
    return response.data;
  },

  /**
   * Actualiza los datos editables del usuario (ej. nombre completo).
   */
  updateProfile: async (payload: UpdateProfilePayload): Promise<ApiActionResponse> => {
    const response = await apiClient.put<ApiActionResponse>('/auth/profile', payload);
    return response.data;
  },

  /**
   * Modifica la contraseña del usuario y revoca sesiones concurrentes.
   */
  changePassword: async (payload: ChangePasswordPayload): Promise<ApiActionResponse> => {
    const response = await apiClient.post<ApiActionResponse>('/auth/change-password', payload);
    return response.data;
  },

  /**
   * Consulta el listado de empresas asociadas al usuario (soporte multi-empresa).
   */
  getCompanies: async (): Promise<CompanyTenant[]> => {
    const response = await apiClient.get<CompanyTenant[]>('/auth/companies');
    return response.data;
  },
};
