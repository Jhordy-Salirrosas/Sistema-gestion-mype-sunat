import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  customsDeclarationsApi,
  getStoredSettlements,
} from '../services/customsDeclarationsApi';
import {
  type CustomsSettlementRecord,
  type PaySettlementPayload,
} from '../types';

export const useCustomsSettlements = (declarationId?: string) => {
  const queryClient = useQueryClient();

  const pendingSettlementsQuery = useQuery<CustomsSettlementRecord[]>({
    queryKey: ['customs-settlements', 'pending'],
    queryFn: customsDeclarationsApi.getPendingSettlements,
    initialData: () => getStoredSettlements(),
    staleTime: 1000 * 60 * 5,
    enabled: !declarationId,
  });

  const declarationSettlementsQuery = useQuery<CustomsSettlementRecord[]>({
    queryKey: ['customs-settlements', 'declaration', declarationId],
    queryFn: () => customsDeclarationsApi.getSettlementsByDeclaration(declarationId!),
    initialData: () =>
      declarationId
        ? getStoredSettlements().filter((s) => s.declaration_id === declarationId)
        : [],
    staleTime: 1000 * 60 * 5,
    enabled: Boolean(declarationId),
  });

  const paySettlementMutation = useMutation<
    { message: string; levante_granted: boolean },
    Error,
    { settlementId: string; payload: PaySettlementPayload }
  >({
    mutationFn: ({ settlementId, payload }) =>
      customsDeclarationsApi.paySettlement(settlementId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customs-settlements'] });
      queryClient.invalidateQueries({ queryKey: ['customs-shipment'] });
      queryClient.invalidateQueries({ queryKey: ['customs-declarations'] });
    },
  });

  const settlements = declarationId
    ? declarationSettlementsQuery.data ?? []
    : pendingSettlementsQuery.data ?? [];

  const isLoading = declarationId
    ? declarationSettlementsQuery.isLoading
    : pendingSettlementsQuery.isLoading;

  return {
    settlements,
    isLoading,
    refetch: declarationId
      ? declarationSettlementsQuery.refetch
      : pendingSettlementsQuery.refetch,
    paySettlement: (settlementId: string, payload: PaySettlementPayload) =>
      paySettlementMutation.mutateAsync({ settlementId, payload }),
    isPaying: paySettlementMutation.isPending,
    paymentResult: paySettlementMutation.data,
  };
};
