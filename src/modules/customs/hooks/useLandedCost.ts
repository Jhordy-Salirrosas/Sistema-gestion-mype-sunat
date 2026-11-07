import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { landedCostApi } from '../services/landedCostApi';
import {
  type AddLocalExpensePayload,
  type LandedCostSheetRecord,
  type LocalExpenseInvoiceRecord,
} from '../types';

export const DEFAULT_LOCAL_EXPENSES: LocalExpenseInvoiceRecord[] = [
  {
    id: 'exp-001',
    shipment_id: 'EXP-2026-00042',
    supplier_ruc: '20503840121',
    supplier_name: 'DP WORLD CALLAO S.R.L.',
    expense_concept: 'ALMACENAJE_PORTUARIO',
    invoice_serial_number: 'F001-00284',
    issue_date: '2026-10-29',
    net_amount_pen: 850.0,
    igv_amount_pen: 153.0,
    total_amount_pen: 1003.0,
    spot_detraction_rate: 10.0,
    is_capitalizable: true,
    proration_method: 'PESO_BRUTO',
  },
  {
    id: 'exp-002',
    shipment_id: 'EXP-2026-00042',
    supplier_ruc: '20412589631',
    supplier_name: 'AGENCIA DE ADUANA DEL PACIFICO S.A.C.',
    expense_concept: 'AGENTE_ADUANAS',
    invoice_serial_number: 'F002-00159',
    issue_date: '2026-10-29',
    net_amount_pen: 650.0,
    igv_amount_pen: 117.0,
    total_amount_pen: 767.0,
    spot_detraction_rate: 12.0,
    is_capitalizable: true,
    proration_method: 'VALOR_FOB',
  },
  {
    id: 'exp-003',
    shipment_id: 'EXP-2026-00042',
    supplier_ruc: '20556987412',
    supplier_name: 'TRANSPORTES LOGISTICOS DEL CALLAO S.A.C.',
    expense_concept: 'FLETE_LOCAL_PUERTO_ALMACEN',
    invoice_serial_number: 'F001-00412',
    issue_date: '2026-10-30',
    net_amount_pen: 420.0,
    igv_amount_pen: 75.6,
    total_amount_pen: 495.6,
    spot_detraction_rate: 4.0,
    is_capitalizable: true,
    proration_method: 'PESO_BRUTO',
  },
];

export const useLandedCost = (shipmentId: string) => {
  const queryClient = useQueryClient();

  const expensesQuery = useQuery<LocalExpenseInvoiceRecord[]>({
    queryKey: ['landed-cost-expenses', shipmentId],
    queryFn: async () => {
      const data = await landedCostApi.getLocalExpenses(shipmentId);
      return data.length > 0 ? data : DEFAULT_LOCAL_EXPENSES;
    },
    enabled: Boolean(shipmentId),
  });

  const sheetQuery = useQuery<LandedCostSheetRecord | null>({
    queryKey: ['landed-cost-sheet', shipmentId],
    queryFn: () => landedCostApi.getLandedCostSheet(shipmentId),
    enabled: Boolean(shipmentId),
  });

  const addExpenseMutation = useMutation<
    LocalExpenseInvoiceRecord,
    Error,
    AddLocalExpensePayload
  >({
    mutationFn: landedCostApi.addLocalExpense,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['landed-cost-expenses', shipmentId] });
      queryClient.invalidateQueries({ queryKey: ['landed-cost-sheet', shipmentId] });
    },
  });

  const calculateMutation = useMutation<LandedCostSheetRecord, Error, void>({
    mutationFn: () => landedCostApi.calculateLandedCost({ shipment_id: shipmentId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['landed-cost-sheet', shipmentId] });
      queryClient.invalidateQueries({ queryKey: ['customs-shipment', shipmentId] });
    },
  });

  const approveMutation = useMutation<any, Error, string | undefined>({
    mutationFn: (notes?: string) =>
      landedCostApi.approveLandedCost({ shipmentId, notes }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['landed-cost-sheet', shipmentId] });
      queryClient.invalidateQueries({ queryKey: ['customs-shipment', shipmentId] });
    },
  });

  const adjustLateCostMutation = useMutation<any, Error, any>({
    mutationFn: (payload: any) =>
      landedCostApi.adjustLateCost({ ...payload, shipmentId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['landed-cost-expenses', shipmentId] });
      queryClient.invalidateQueries({ queryKey: ['landed-cost-sheet', shipmentId] });
    },
  });

  const applyKardexMutation = useMutation<
    { message: string; movements_count: number },
    Error,
    void
  >({
    mutationFn: () => landedCostApi.applyKardex({ shipment_id: shipmentId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['landed-cost-sheet', shipmentId] });
      queryClient.invalidateQueries({ queryKey: ['customs-shipment', shipmentId] });
    },
  });

  return {
    expenses: expensesQuery.data ?? [],
    sheet: sheetQuery.data,
    isLoading: expensesQuery.isLoading || sheetQuery.isLoading,
    refetchExpenses: expensesQuery.refetch,
    refetchSheet: sheetQuery.refetch,
    addExpense: addExpenseMutation.mutateAsync,
    isAddingExpense: addExpenseMutation.isPending,
    calculateLandedCost: calculateMutation.mutateAsync,
    isCalculating: calculateMutation.isPending,
    approveLandedCost: approveMutation.mutateAsync,
    isApproving: approveMutation.isPending,
    adjustLateCost: adjustLateCostMutation.mutateAsync,
    isAdjusting: adjustLateCostMutation.isPending,
    applyKardex: applyKardexMutation.mutateAsync,
    isApplyingKardex: applyKardexMutation.isPending,
  };
};
