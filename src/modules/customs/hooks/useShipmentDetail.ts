import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { customsShipmentsApi } from '../services/customsShipmentsApi';
import { getDemoShipmentDetail } from '../services/shipmentDemoDetail';
import {
  type AddDocumentPayload,
  type AddEventPayload,
  type CustomsDocumentRecord,
  type CustomsEventRecord,
  type CustomsShipmentDetail,
} from '../types';

export const useShipmentDetail = (shipmentId: string) => {
  const queryClient = useQueryClient();

  const shipmentQuery = useQuery<CustomsShipmentDetail>({
    queryKey: ['customs-shipment', shipmentId],
    queryFn: () => customsShipmentsApi.getShipmentById(shipmentId),
    initialData: () => getDemoShipmentDetail(shipmentId),
    staleTime: 1000 * 60 * 5,
    enabled: Boolean(shipmentId),
  });

  const addDocumentMutation = useMutation<
    CustomsDocumentRecord,
    Error,
    AddDocumentPayload
  >({
    mutationFn: (payload) => customsShipmentsApi.addDocument(shipmentId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customs-shipment', shipmentId] });
      queryClient.invalidateQueries({ queryKey: ['customs-shipments'] });
    },
  });

  const addEventMutation = useMutation<
    CustomsEventRecord,
    Error,
    AddEventPayload
  >({
    mutationFn: (payload) => customsShipmentsApi.addEvent(shipmentId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customs-shipment', shipmentId] });
      queryClient.invalidateQueries({ queryKey: ['customs-shipments'] });
    },
  });

  return {
    shipment: shipmentQuery.data,
    isLoading: shipmentQuery.isLoading,
    isError: shipmentQuery.isError,
    error: shipmentQuery.error,
    refetch: shipmentQuery.refetch,
    addDocument: addDocumentMutation.mutateAsync,
    isAddingDocument: addDocumentMutation.isPending,
    addEvent: addEventMutation.mutateAsync,
    isAddingEvent: addEventMutation.isPending,
  };
};
