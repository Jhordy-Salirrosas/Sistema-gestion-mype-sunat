import { InvoiceRetryService } from '../../../src/modules/resilience/infrastructure/queue/invoiceRetryService';
import { ResilienceStateService } from '../../../src/modules/resilience/application/resilienceStateService';
import { aceptado, falloDeRed, paramsBase } from '../resilience/invoiceRetryTestSupport';
import { InvoiceAccountingFallbackService } from '../../../src/modules/invoices/application/services/invoiceAccountingFallbackService';

function harness(uncertain = false) {
  const row = { transport_uncertain: uncertain };
  const prisma = { invoice: {
    findUnique: jest.fn(async () => ({ ...row })),
    findUniqueOrThrow: jest.fn(async () => ({ ...row, estado: 'ENVIADO', company_id: 'empresa' })),
    update: jest.fn(async ({ data }: any) => { Object.assign(row, data); return row; }),
  }, transactionHistory: { findMany: jest.fn(async () => []), create: jest.fn(async () => ({})) } };
  const sunat = { sendAndProcess: jest.fn() };
  const consulta = { consultarEstado: jest.fn() };
  const dlq = { enviar: jest.fn(async () => 'job-dlq') };
  const sleep = jest.fn(async () => undefined);
  const service = new InvoiceRetryService(dlq as never, sunat as never, new ResilienceStateService(), sleep, consulta, prisma as never);
  return { row, prisma, sunat, consulta, dlq, service };
}
it('tras reinicio recupera CDR de intento incierto antes de cualquier sendBill', async () => {
  const h = harness(true);
  h.consulta.consultarEstado.mockResolvedValue({ tipo: 'RECUPERADO', resultado: { ...aceptado(), cdr: { responseCode: '0' } } });
  expect((await h.service.processWithRetry(paramsBase)).estado).toBe('ACEPTADO');
  expect(h.sunat.sendAndProcess).not.toHaveBeenCalled();
  expect(h.row.transport_uncertain).toBe(false);
});
it('consulta inconcluyente conserva incertidumbre durable y no reenvía', async () => {
  const h = harness(true);
  h.consulta.consultarEstado.mockRejectedValue(new Error('consulta inconcluyente'));
  await h.service.processWithRetry(paramsBase);
  expect(h.sunat.sendAndProcess).not.toHaveBeenCalled();
  expect(h.row.transport_uncertain).toBe(true);
  expect(h.dlq.enviar).not.toHaveBeenCalled();
});
it('solo ausencia confirmada permite reenviar y el marcador se confirma antes de la red', async () => {
  const h = harness(true);
  h.consulta.consultarEstado.mockResolvedValue({ tipo: 'NO_ENCONTRADO' });
  h.sunat.sendAndProcess.mockImplementation(async () => {
    expect(h.row.transport_uncertain).toBe(true);
    return aceptado();
  });
  await h.service.processWithRetry(paramsBase);
  expect(h.consulta.consultarEstado.mock.invocationCallOrder[0]).toBeLessThan(h.sunat.sendAndProcess.mock.invocationCallOrder[0]);
  expect(h.row.transport_uncertain).toBe(false);
});
it('si el intento pierde respuesta y la consulta falla, no hay segundo envío', async () => {
  const h = harness();
  h.sunat.sendAndProcess.mockResolvedValue(falloDeRed());
  h.consulta.consultarEstado.mockRejectedValue(new Error('caída simulada'));
  await expect(h.service.processWithRetry(paramsBase)).resolves.toMatchObject({ incertidumbreTransporte: true, enviadoADlq: false });
  expect(h.sunat.sendAndProcess).toHaveBeenCalledTimes(1);
  expect(h.row.transport_uncertain).toBe(true);
});
it('7L respaldo retirado no crea asiento ni sustituye el mapeo', async () => {
  const generate = { execute: jest.fn(async () => ({ id: 'asiento' })) };
  await expect(new InvoiceAccountingFallbackService(generate as never).execute({ companyId: 'empresa', invoiceId: 'inv-1', tipoComprobante: '01', serie: 'F001', correlativo: 1, fechaEmision: '2026-11-08', cliente: 'Prueba', base: 100, igv: 18, total: 118 })).rejects.toThrow('M1_ACCOUNTING_PENDING');
  expect(generate.execute).not.toHaveBeenCalled();
});
