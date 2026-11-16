import { apiClient } from '@/lib/axios';

export interface ModulePermission { role: string; moduleCode: string; canView: boolean; canWrite: boolean }
export const MODULES_PERMISOS = [
  ['M1', 'Facturación'], ['M2', 'Importaciones'], ['M3', 'SIRE'], ['M4', 'Contabilidad'], ['M5', 'Resiliencia'],
  ['M6', 'Inventario y Kardex'], ['M7', 'Ventas'], ['M8', 'Compras'], ['M9', 'Seguridad y Accesos'], ['M10', 'Experiencia de Usuario'],
] as const;
export const modulePermissionsApi = {
  list: async (): Promise<ModulePermission[]> => (await apiClient.get<ModulePermission[]>('/auth/module-permissions')).data,
  mine: async (): Promise<ModulePermission[]> => (await apiClient.get<ModulePermission[]>('/auth/module-permissions/me')).data,
  save: async (rows: ModulePermission[]): Promise<ModulePermission[]> => (await apiClient.put<ModulePermission[]>('/auth/module-permissions', rows)).data,
};
