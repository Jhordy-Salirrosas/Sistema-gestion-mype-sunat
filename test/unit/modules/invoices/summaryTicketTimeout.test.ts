import { afterEach, expect, it, vi } from 'vitest';
import { apiClient } from '@/lib/axios';
import { invoicesApi } from '@/modules/invoices/services/invoicesApi';
afterEach(() => vi.restoreAllMocks());
it('Consultar ticket configura 120000 ms sin modificar el timeout global', async () => {
  const post=vi.spyOn(apiClient,'post').mockResolvedValue({data:{motivo:'En proceso',status:'98'}});
  expect(apiClient.defaults.timeout).toBe(15000);
  expect(await invoicesApi.consultarAgregado('RA-20261109-001')).toEqual({motivo:'En proceso',status:'98'});
  expect(post).toHaveBeenCalledExactlyOnceWith('/invoices/resumenes/envios/RA-20261109-001/consultar',undefined,{timeout:120000});
  expect(apiClient.defaults.timeout).toBe(15000);
});
