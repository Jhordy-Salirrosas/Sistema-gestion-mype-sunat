import { useQuery } from '@tanstack/react-query';
import { customsApi } from '../services/customsApi';
import { type CustomsDeclarationDetail } from '../types/customs.types';

export const useCustomsDeclarationDetail = (id: string | null) => {
  return useQuery<CustomsDeclarationDetail>({
    queryKey: ['customs-declaration', id],
    queryFn: () => customsApi.getDeclarationById(id!),
    enabled: Boolean(id),
  });
};
