import { useMutation } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { authApi } from '../services/authApi';
import { cargarEmpresaActiva } from '../lib/empresaActiva';
import { useAuthStore } from '@/stores/authStore';
import { type LoginCredentials } from '../types/auth.types';
import { getDefaultRouteForRole } from '@/routes/roleNavigation';

export const useLogin = () => {
  const navigate = useNavigate();
  const { setSession, setActiveCompany } = useAuthStore();

  return useMutation({
    mutationFn: (credentials: LoginCredentials) => authApi.login(credentials),
    onSuccess: async (data) => {
      const token = data.accessToken || data.token || '';
      setSession(token, data.user);
      if (data.companies && data.companies.length > 0) {
        setActiveCompany(data.companies[0]);
      } else if (data.user.companyId) {
        setActiveCompany({
          tenantId: data.user.companyId,
          ruc: data.user.companyRuc || '',
          razonSocial: data.user.companyLegalName || data.user.fullName || 'Empresa',
        });
      }

      // Si ni `companies` ni el usuario traen empresa, se pide a /auth/profile.
      // Antes esto era la única vía y la condición `data.companies?.length`
      // nunca se cumplía, así que la sesión quedaba sin empresa y con ella
      // vacíos el RUC del QR, el emisor del XML y las series.
      if (!data.user.companyId) {
        await cargarEmpresaActiva(true);
      }
      const defaultPath = getDefaultRouteForRole(data.user?.role);
      navigate(defaultPath);
    },
    onError: (error) => {
      console.error('Error al iniciar sesión:', error);
    },
  });
};
