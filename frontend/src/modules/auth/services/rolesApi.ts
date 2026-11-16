import { apiClient } from '@/lib/axios';
export interface CompanyRole { code:string;name:string;isSystem:boolean }
export interface RoleConfig { customRolesEnabled:boolean }
export interface CapabilityDefinition { code:string;name:string;reservedAdmin:boolean;accessGate:string|null }
export interface MenuDefinition { code:string;moduleCode:string;path:string;parentCode:string|null;reservedAdmin:boolean }
export interface PermissionCatalog { actions:CapabilityDefinition[];menus:MenuDefinition[] }
export interface MenuPermission { role:string;menuCode:string;canView:boolean }
export const rolesApi={
 list:async():Promise<CompanyRole[]> => (await apiClient.get('/auth/roles')).data,
 config:async():Promise<RoleConfig> => (await apiClient.get('/auth/roles/config')).data,
 catalog:async():Promise<PermissionCatalog> => (await apiClient.get('/auth/permission-catalog')).data,
 rename:async(code:string,name:string):Promise<CompanyRole> => (await apiClient.patch(`/auth/roles/${encodeURIComponent(code)}`,{name})).data,
 create:async(code:string,name:string):Promise<CompanyRole> => (await apiClient.post('/auth/roles',{code,name})).data,
 menus:async():Promise<MenuPermission[]> => (await apiClient.get('/auth/menu-permissions')).data,
 saveMenus:async(rows:MenuPermission[]):Promise<MenuPermission[]> => (await apiClient.put('/auth/menu-permissions',rows)).data,
};
