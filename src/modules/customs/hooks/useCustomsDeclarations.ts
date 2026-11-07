import { useQuery } from '@tanstack/react-query';
import { customsApi } from '../services/customsApi';
import { type CustomsDeclarationSummary } from '../types/customs.types';

export const useCustomsDeclarations = () => {
  return useQuery<CustomsDeclarationSummary[]>({
    queryKey: ['customs-declarations'],
    queryFn: customsApi.getDeclarations,
  });
};
