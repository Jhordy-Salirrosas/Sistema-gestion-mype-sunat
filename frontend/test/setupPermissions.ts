import { vi } from 'vitest';
import { serverActions, serverModules } from './fixtures/permissionsServer';
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
