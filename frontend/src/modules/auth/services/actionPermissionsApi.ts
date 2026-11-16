import { apiClient } from '@/lib/axios';

export const ACTIONS_PERMISOS = [
  ['INVOICE_EDIT_ISSUE_DATE', 'Modificar fecha de emisión'],
  ['INVOICE_FORCE_RESEND', 'Reenvío forzado'],
  ['INVOICE_RESOLVE_DLQ', 'Resolver DLQ'],
  ['INVOICE_REPROCESS_BRIDGE', 'Reprocesar puente'],
] as const;
export type ActionCode = typeof ACTIONS_PERMISOS[number][0];
export interface ActionPermission { role: string; actionCode: ActionCode; allowed: boolean }

export const actionPermissionsApi = {
  mine: async (): Promise<ActionPermission[]> => (await apiClient.get<ActionPermission[]>('/auth/action-permissions/me')).data,
  list: async (): Promise<ActionPermission[]> => (await apiClient.get<ActionPermission[]>('/auth/action-permissions')).data,
  save: async (rows: ActionPermission[]): Promise<ActionPermission[]> => (await apiClient.put<ActionPermission[]>('/auth/action-permissions', rows)).data,
};
