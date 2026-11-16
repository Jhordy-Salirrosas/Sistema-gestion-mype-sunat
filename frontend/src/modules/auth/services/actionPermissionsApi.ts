import { apiClient } from '@/lib/axios';

export type ActionCode = string;
export interface ActionPermission { role: string; actionCode: ActionCode; allowed: boolean; available?: boolean }

export const actionPermissionsApi = {
  mine: async (): Promise<ActionPermission[]> => (await apiClient.get<ActionPermission[]>('/auth/action-permissions/me')).data,
  list: async (): Promise<ActionPermission[]> => (await apiClient.get<ActionPermission[]>('/auth/action-permissions')).data,
  save: async (rows: ActionPermission[]): Promise<ActionPermission[]> => (await apiClient.put<ActionPermission[]>('/auth/action-permissions', rows)).data,
};
