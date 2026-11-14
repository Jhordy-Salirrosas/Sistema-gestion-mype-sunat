import { jest, describe, it, expect } from '@jest/globals';
import { InvoiceStatus } from '../../../src/generated/client/enums';
import { InvoiceQueryService } from '../../../src/modules/invoices/application/services/invoiceQueryService';

type Resultado = 'ENCOLADO' | 'YA_EN_COLA' | 'EN_DLQ' | 'ESTADO_NO_PERMITIDO';
function crear(resultado: Resultado, estadoAlComprobar: InvoiceStatus = InvoiceStatus.EN_COLA) {
  const fila = { id: 'inv-1', estado: InvoiceStatus.EN_COLA, serie: 'F001', correlativo: 57 };
  const findFirst = jest.fn<() => Promise<unknown>>().mockResolvedValueOnce(fila).mockResolvedValue({ ...fila, estado: estadoAlComprobar });
  const marcar = jest.fn(async (_args: unknown) => ({ count: 1 }));
  const historial = jest.fn(async (_args: unknown) => ({}));
  const publicar = jest.fn();
  const rescatar = jest.fn(async (_id: string, _empresa: string, permitido: () => Promise<boolean>) => {
    if (resultado === 'YA_EN_COLA' || resultado === 'EN_DLQ') return { estado: resultado };
    if (!(await permitido())) return { estado: 'ESTADO_NO_PERMITIDO' as const };
    if (resultado === 'ENCOLADO') publicar();
    return { estado: resultado, ...(resultado === 'ENCOLADO' ? { jobId: 'job-1' } : {}) };
  });
  const servicio = new InvoiceQueryService({ invoice: { findFirst, updateMany: marcar }, transactionHistory: { create: historial } } as never, { reenqueueInvoiceIfIdle: rescatar } as never);
  return { servicio, rescatar, historial, findFirst, marcar, publicar };
}

describe('rescate manual de comprobantes en espera', () => {
  it.each(['ENCOLADO', 'YA_EN_COLA', 'EN_DLQ'] as const)('informa y registra %s sin duplicar la decisión de la cola', async (resultado) => {
    const d = crear(resultado);
    const r = await d.servicio.reintentarCdr('empresa-1', 'inv-1');
    expect(r).toMatchObject({ resultadoCola: resultado, encolado: resultado === 'ENCOLADO' });
    expect(d.rescatar).toHaveBeenCalledTimes(1);
    expect(d.historial).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ invoice_id: 'inv-1', company_id: 'empresa-1', mensaje_error: expect.stringContaining(`F001-00000057`) }) }));
    expect(d.historial.mock.calls[0][0]).toEqual(expect.objectContaining({ data: expect.objectContaining({ mensaje_error: expect.stringContaining(resultado) }) }));
  });
  it('no encola si al comprobar cambió a ACEPTADO', async () => {
    const d = crear('ENCOLADO', InvoiceStatus.ACEPTADO);
    const r = await d.servicio.reintentarCdr('empresa-1', 'inv-1');
    expect(r).toMatchObject({ resultadoCola: 'ESTADO_NO_PERMITIDO', encolado: false });
    expect(d.historial).toHaveBeenCalled();
  });
  it.each([InvoiceStatus.ACEPTADO, InvoiceStatus.ANULADO, InvoiceStatus.OBSERVADO])('no intenta rescatar un comprobante en estado %s', async (estado) => {
    const d = crear('ENCOLADO');
    d.findFirst.mockReset().mockResolvedValue({ id: 'inv-1', estado, serie: 'F001', correlativo: 57 });
    const r = await d.servicio.reintentarCdr('empresa-1', 'inv-1');
    expect(r.encolado).toBe(false);
    expect(d.rescatar).not.toHaveBeenCalled();
  });
});

it('persiste incertidumbre desconocida antes del rescate manual sin sobrescribir certezas', async () => {
  const d = crear('ENCOLADO');
  await d.servicio.reintentarCdr('empresa-1', 'inv-1');
  expect(d.marcar).toHaveBeenCalledWith({ where: { id: 'inv-1', company_id: 'empresa-1', estado: { in: ['EN_COLA', 'PENDIENTE'] }, transport_uncertain: null }, data: { transport_uncertain: true } });
  expect(d.marcar.mock.invocationCallOrder[0]).toBeLessThan(d.publicar.mock.invocationCallOrder[0]);
});
it('si no puede persistir la incertidumbre no publica el rescate', async () => {
  const d = crear('ENCOLADO'); d.marcar.mockRejectedValue(new Error('base no disponible'));
  await expect(d.servicio.reintentarCdr('empresa-1', 'inv-1')).rejects.toThrow('base no disponible');
  expect(d.publicar).not.toHaveBeenCalled();
});
