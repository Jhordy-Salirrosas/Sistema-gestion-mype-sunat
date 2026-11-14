import { InvoiceQueryService } from '../../../src/modules/invoices/application/services/invoiceQueryService';
import { InvoiceQueryController } from '../../../src/modules/invoices/infrastructure/controllers/invoiceQueryController';
import { QueueService, INVOICE_DLQ } from '../../../src/modules/resilience/infrastructure/queue/queue.service';

function harness(row: unknown) {
  const db = { invoice: { findFirst: jest.fn(async () => row), update: jest.fn(), updateMany: jest.fn() } };
  const queue = { resolveAcceptedInvoiceDlq: jest.fn(async () => 2), enqueueInvoiceInTx: jest.fn(), reenqueueInvoiceIfIdle: jest.fn() };
  const service = new InvoiceQueryService(db as never, queue as never);
  return { db, queue, service };
}
it('resuelve todos los trabajos del aceptado con CDR sin tocar el documento ni publicar', async () => {
  const h = harness({ estado: 'ACEPTADO', cdr_sunat: { responseCode: '0' } });
  const controller = new InvoiceQueryController(h.service, ...Array(9).fill({}) as [never, never, never, never, never, never, never, never, never]);
  expect(await controller.resolverDlq('c', 'i')).toMatchObject({ resueltos: 2 });
  expect(h.db.invoice.findFirst).toHaveBeenCalledWith({ where: { id: 'i', company_id: 'c' }, select: { estado: true, cdr_sunat: true } });
  expect(h.queue.resolveAcceptedInvoiceDlq).toHaveBeenCalledWith('i', 'c');
  expect(h.db.invoice.update).not.toHaveBeenCalled(); expect(h.db.invoice.updateMany).not.toHaveBeenCalled();
  expect(h.queue.enqueueInvoiceInTx).not.toHaveBeenCalled(); expect(h.queue.reenqueueInvoiceIfIdle).not.toHaveBeenCalled();
});
it.each([
  { estado: 'ACEPTADO', cdr_sunat: null }, { estado: 'ACEPTADO', cdr_sunat: {} },
  { estado: 'ACEPTADO', cdr_sunat: { responseCode: '3105' } },
  ...['PENDIENTE', 'ERROR_RED', 'RECHAZADO', 'OBSERVADO', 'ANULADO'].map(estado => ({ estado, cdr_sunat: { responseCode: '0' } })),
])('no elimina trabajos sin aceptación consistente: %j', async row => {
  const h = harness(row);
  await expect(h.service.resolverDlqAceptado('c', 'i')).rejects.toMatchObject({ status: 400 });
  expect(h.queue.resolveAcceptedInvoiceDlq).not.toHaveBeenCalled();
});
it('un documento ausente o ajeno responde 404 sin tocar trabajos', async () => {
  const h = harness(null);
  await expect(h.service.resolverDlqAceptado('otra', 'i')).rejects.toMatchObject({ status: 404 });
  expect(h.queue.resolveAcceptedInvoiceDlq).not.toHaveBeenCalled();
});
function cola(jobs: unknown[]) {
  const boss = { findJobs: jest.fn(async () => jobs), deleteJob: jest.fn(), send: jest.fn() };
  const service = Object.create(QueueService.prototype) as QueueService;
  Object.assign(service, { boss });
  return { service, boss };
}
it('elimina solo trabajos pendientes de la misma empresa/documento y es repetible', async () => {
  const job = (id: string, company_id = 'c', invoice_id = 'i') => ({ id, data: { company_id, invoice_id } });
  const h = cola([job('a'), job('b'), job('ajeno', 'otra'), job('otro', 'c', 'otro'), { id: 'incompleto' }]);
  expect(await h.service.resolveAcceptedInvoiceDlq('i', 'c')).toBe(2);
  expect(h.boss.findJobs).toHaveBeenCalledWith(INVOICE_DLQ, { data: { invoice_id: 'i', company_id: 'c' }, queued: true });
  expect(h.boss.deleteJob).toHaveBeenCalledTimes(1);
  expect(h.boss.deleteJob).toHaveBeenCalledWith(INVOICE_DLQ, ['a', 'b']);
  expect(h.boss.send).not.toHaveBeenCalled();
  h.boss.findJobs.mockResolvedValue([]); h.boss.deleteJob.mockClear();
  expect(await h.service.resolveAcceptedInvoiceDlq('i', 'c')).toBe(0);
  expect(h.boss.deleteJob).not.toHaveBeenCalled();
});
it('un fallo de limpieza se informa sin reenviar ni afirmar resolución', async () => {
  const h = cola([{ id: 'a', data: { company_id: 'c', invoice_id: 'i' } }]);
  h.boss.deleteJob.mockRejectedValue(new Error('Cola no disponible'));
  await expect(h.service.resolveAcceptedInvoiceDlq('i', 'c')).rejects.toThrow('Cola no disponible');
  expect(h.boss.send).not.toHaveBeenCalled();
});
