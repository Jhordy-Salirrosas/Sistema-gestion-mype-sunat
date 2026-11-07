import { useMutation } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { authApi } from '../services/authApi';
import { useAuthStore } from '@/stores/authStore';
import { type RegisterPayload } from '../types/auth.types';

export const useRegister = () => {
  const navigate = useNavigate();
  const { setSession, setActiveCompany } = useAuthStore();

  return useMutation({
    mutationFn: (payload: RegisterPayload) => authApi.register(payload),
    onSuccess: (data) => {
      const token = data.accessToken || data.token || '';
      setSession(token, data.user);
      if (data.companies && data.companies.length > 0) {
        setActiveCompany(data.companies[0]);
      } else if (data.user.companyId) {
        setActiveCompany({
          tenantId: data.user.companyId,
          ruc: data.user.companyRuc || '',
          razonSocial: data.user.companyLegalName || '',
        });
      }
      navigate('/invoices');
    },
    onError: (error) => {
      console.error('Error al registrar empresa MYPE:', error);
    },
  });
};
