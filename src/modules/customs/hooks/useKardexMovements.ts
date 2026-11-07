import { useQuery } from '@tanstack/react-query';
import { customsApi } from '../services/customsApi';
import { type KardexMovementRecord } from '../types/customs.types';

export const useKardexMovements = () => {
  return useQuery<KardexMovementRecord[]>({
    queryKey: ['customs-kardex'],
    queryFn: customsApi.getKardexMovements,
  });
};
