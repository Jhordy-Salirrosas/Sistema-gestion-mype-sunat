import { apiClient } from '@/lib/axios';
import type { CompanyRole,MenuDefinition } from './rolesApi';
import type { ModulePermission } from './modulePermissionsApi';
import type { ActionPermission } from './actionPermissionsApi';
export interface PermissionSnapshot {
 ui:{showDuaCreation:boolean;showAccountingCreation:boolean};
 role:CompanyRole;modules:ModulePermission[];actions:ActionPermission[];
 menus:Array<MenuDefinition&{canView:boolean}>;homePath:string|null;customRolesEnabled:boolean;
}
export const permissionsApi={mine:async():Promise<PermissionSnapshot> => (await apiClient.get('/auth/permissions/me')).data};
