import { useMutation, useQueryClient } from '@tanstack/react-query';
import { customsApi } from '../services/customsApi';
import {
  type CustomsDeclarationDetail,
  type RegisterDuaPayload,
} from '../types/customs.types';

export const useRegisterDeclaration = () => {
  const queryClient = useQueryClient();

  return useMutation<CustomsDeclarationDetail, Error, RegisterDuaPayload>({
    mutationFn: customsApi.registerDua,
    onSuccess: () => {
      // Invalida caché de historial y de kardex para refresco automático
      queryClient.invalidateQueries({ queryKey: ['customs-declarations'] });
      queryClient.invalidateQueries({ queryKey: ['customs-kardex'] });
    },
  });
};
