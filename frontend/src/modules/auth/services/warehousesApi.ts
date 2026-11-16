import { apiClient } from '@/lib/axios';

export interface WarehouseOption { warehouse_code: string; description: string; sunat_establishment_code?: string }
export interface UserWarehouseRow { id: string; email: string; fullName: string; role: string; isActive: boolean; warehouseCodes: string[] }

export interface CreateUserInput { name: string; email: string; password: string; role: string }
export type CreatedUser = Omit<UserWarehouseRow, 'warehouseCodes'> & { companyId: string };

export const warehousesApi = {
  createUser: async (payload: CreateUserInput): Promise<CreatedUser> => (await apiClient.post<CreatedUser>('/auth/users', payload)).data,
  list: async (): Promise<WarehouseOption[]> => (await apiClient.get<WarehouseOption[]>('/auth/warehouses')).data,
  listUsers: async (): Promise<UserWarehouseRow[]> => (await apiClient.get<UserWarehouseRow[]>('/auth/users')).data,
  updateUser: async (id: string, payload: { role?: string; isActive?: boolean }) => (await apiClient.patch(`/auth/users/${id}`, payload)).data as { id: string; role: string; isActive: boolean },
  setUserWarehouses: async (id: string, warehouseCodes: string[]) => (await apiClient.put(`/auth/users/${id}/warehouses`, { warehouseCodes })).data as { userId: string; warehouseCodes: string[] },
};
