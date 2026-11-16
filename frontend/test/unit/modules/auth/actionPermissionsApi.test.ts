import { beforeEach, expect, it, vi } from 'vitest';
import { apiClient } from '@/lib/axios';
import { actionPermissionsApi, type ActionPermission } from '@/modules/auth/services/actionPermissionsApi';
vi.mock('@/lib/axios',()=>({apiClient:{get:vi.fn(),put:vi.fn()}}));
beforeEach(()=>vi.clearAllMocks());
it('consulta acciones propias y matriz con los endpoints del paquete 1',async()=>{
 const rows:ActionPermission[]=[{role:'ADMIN',actionCode:'INVOICE_FORCE_RESEND',allowed:true}];
 vi.mocked(apiClient.get).mockResolvedValue({data:rows});
 expect(await actionPermissionsApi.mine()).toEqual(rows);expect(apiClient.get).toHaveBeenNthCalledWith(1,'/auth/action-permissions/me');
 expect(await actionPermissionsApi.list()).toEqual(rows);expect(apiClient.get).toHaveBeenNthCalledWith(2,'/auth/action-permissions');
});
it('envía el arreglo role/actionCode/allowed sin otros campos',async()=>{
 const rows:ActionPermission[]=[{role:'OPERADOR_FACTURACION',actionCode:'INVOICE_EDIT_ISSUE_DATE',allowed:false}];
 vi.mocked(apiClient.put).mockResolvedValue({data:rows});expect(await actionPermissionsApi.save(rows)).toEqual(rows);
 expect(apiClient.put).toHaveBeenCalledWith('/auth/action-permissions',rows);
});
