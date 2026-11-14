import { expect, it, vi } from 'vitest';
import { invoicesApi } from '@/modules/invoices/services/invoicesApi';
import { apiClient } from '@/lib/axios';
import { INVOICE_QUEUED } from '@/modules/invoices/lib/invoiceQueueEvents';
vi.mock('@/lib/axios',()=>({apiClient:{post:vi.fn()}}));
it.each([{encolado:true},{encolado:false,resultadoCola:'YA_EN_COLA'}])('notifica seguimiento del detalle tras %j',async result=>{
 const listener=vi.fn();window.addEventListener(INVOICE_QUEUED,listener);
 try { vi.mocked(apiClient.post).mockResolvedValue({data:result});await invoicesApi.retryCdr('i');expect(listener).toHaveBeenCalledTimes(1);expect((listener.mock.calls[0][0] as CustomEvent).detail).toBe('i'); }
 finally {window.removeEventListener(INVOICE_QUEUED,listener);}
});
