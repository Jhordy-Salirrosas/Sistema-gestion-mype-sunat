import { vi } from 'vitest';
import { serverActions, serverModules, serverSnapshot, serverRoleRows, serverCatalog, serverMenuRows } from './fixtures/permissionsServer';
// Los tests de otros flujos reciben la matriz efectiva de la API simulada.
// Los tests específicos de permisos sobreescriben mine para probar denegación,
// carga, errores y cambios de identidad; no se sustituyen los hooks ni los guards.
vi.mock('@/modules/auth/services/modulePermissionsApi',async importOriginal=>{
 const actual=await importOriginal<typeof import('@/modules/auth/services/modulePermissionsApi')>();
 return {...actual,modulePermissionsApi:{...actual.modulePermissionsApi,mine:vi.fn(async()=> serverModules())}};
});
vi.mock('@/modules/auth/services/actionPermissionsApi',async importOriginal=>{
 const actual=await importOriginal<typeof import('@/modules/auth/services/actionPermissionsApi')>();
 return {...actual,actionPermissionsApi:{...actual.actionPermissionsApi,mine:vi.fn(async()=> serverActions())}};
});
vi.mock('@/modules/auth/services/permissionsApi',async original=>{
 const actual=await original<typeof import('@/modules/auth/services/permissionsApi')>();
 return {...actual,permissionsApi:{...actual.permissionsApi,mine:vi.fn(async()=>serverSnapshot())}};
});
vi.mock('@/modules/auth/services/rolesApi',async original=>{
 const actual=await original<typeof import('@/modules/auth/services/rolesApi')>();
 return {...actual,rolesApi:{...actual.rolesApi,list:vi.fn(async()=>serverRoleRows()),catalog:vi.fn(async()=>serverCatalog()),config:vi.fn(async()=>({customRolesEnabled:false})),menus:vi.fn(async()=>serverMenuRows())}};
});
