import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiClient } from '@/lib/axios';
import { invoicesApi } from '@/modules/invoices/services/invoicesApi';
import { crearIntentoEmision } from '@/modules/invoices/lib/invoiceIdempotency';
import type { EmitirComprobantePayload } from '@/modules/invoices/types/invoiceEmision.types';
import type { CreateInvoiceDto } from '@/modules/invoices/types/invoice.types';

vi.mock('@/lib/axios', () => ({ apiClient: { post: vi.fn() } }));
const payload = { tipo_comprobante: '01', serie: 'F001' } as EmitirComprobantePayload;
beforeEach(() => { vi.resetAllMocks(); vi.mocked(apiClient.post).mockResolvedValue({ data: { id: '1' } }); });

describe('Idempotency-Key de creación', () => {
  it.each(['01', '03', '07', '08'])('envía el header separado del cuerpo para el tipo %s', async (tipo) => {
    const body = { tipo_comprobante: tipo } as never;
    const clave = crypto.randomUUID();
    await invoicesApi.emitirComprobante(body, clave);
    expect(apiClient.post).toHaveBeenCalledWith('/invoices/emitir', body, { headers: { 'Idempotency-Key': clave } });
  });
  it('también protege la creación directa', async () => {
    const dto: CreateInvoiceDto = { serie: 'F001', clienteRuc: '20100070970', clienteRazonSocial: 'Cliente', moneda: 'PEN', items: [] };
    const clave = crypto.randomUUID();
    await invoicesApi.createInvoice(dto, clave);
    expect(apiClient.post).toHaveBeenCalledWith('/invoices', expect.objectContaining({ serie: 'F001' }), { headers: { 'Idempotency-Key': clave } });
  });
  it.each([new Error('red'), { code: 'ECONNABORTED' }, { response: { status: 503 } }])('conserva clave y cuerpo al reintentar después de %j', async (error) => {
    const intento = crearIntentoEmision();
    vi.mocked(apiClient.post).mockRejectedValueOnce(error);
    await expect(invoicesApi.emitirComprobante(payload, intento.clavePara(payload))).rejects.toEqual(error);
    await invoicesApi.emitirComprobante({ ...payload }, intento.clavePara({ ...payload }));
    const [primera, segunda] = vi.mocked(apiClient.post).mock.calls;
    expect(segunda).toEqual(primera);
    expect(primera[2]?.headers?.['Idempotency-Key']).toMatch(/^[A-Za-z0-9_-]{16,128}$/);
  });
  it('renueva la clave al cambiar el cuerpo, al completar y al abrir un formulario nuevo', () => {
    const intento = crearIntentoEmision();
    const primera = intento.clavePara(payload);
    const segunda = intento.clavePara({ ...payload, serie: 'F002' });
    expect(segunda).not.toBe(primera);
    intento.completar();
    expect(intento.clavePara({ ...payload, serie: 'F002' })).not.toBe(segunda);
    expect(crearIntentoEmision().clavePara(payload)).not.toBe(primera);
  });
});
