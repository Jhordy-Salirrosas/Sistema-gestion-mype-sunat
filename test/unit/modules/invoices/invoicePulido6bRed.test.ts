import { it, expect, vi } from 'vitest';
import { invoicesApi } from '@/modules/invoices/services/invoicesApi';
import { apiClient } from '@/lib/axios';
import { cachedGet } from '@/lib/offlineCache';
vi.mock('@/lib/axios', () => ({ apiClient: { get: vi.fn() } }));
vi.mock('@/lib/offlineCache', () => ({ cachedGet: vi.fn(async () => ({ data: ['copia anterior'] })) }));
it('lectura normal conserva fallback; actualizar fuerza red y propaga fallo sin consultar caché', async () => {
 expect(await invoicesApi.getInvoices()).toEqual({ data: ['copia anterior'] });
 vi.mocked(cachedGet).mockClear(); vi.mocked(apiClient.get).mockRejectedValue(new Error('red sin respuesta'));
 await expect(invoicesApi.getInvoices(1,{},true)).rejects.toThrow('red sin respuesta');
 expect(cachedGet).not.toHaveBeenCalled(); expect(apiClient.get).toHaveBeenCalledWith('/invoices',{ params:{ page:1 } });
});
