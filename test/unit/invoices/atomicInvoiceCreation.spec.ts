import { AtomicInvoiceCreationService } from '../../../src/modules/invoices/application/services/atomicInvoiceCreationService';
import { ConflictException } from '@nestjs/common';

const fiscal = { ruc_emisor: '20100070970', tipo_comprobante: '01', serie: 'F001', correlativo: 1,
  monto_total: 118, fecha_emision: '2026-11-08', customer_identity_type: '6',
  customer_identity_number: '20100070970', customer_legal_name: 'Cliente', payload_ubl: {} };
const pantalla = { tipo_comprobante: '01', serie: 'F001', customer_identity_type: '6',
  customer_identity_number: '20100070970', customer_legal_name: 'Cliente',
  items: [{ descripcion: 'Servicio', cantidad: 1, precioUnitario: 118, afectacion: '10' }] };

function harness() {
  const requests = new Map<string, any>();
  const tx = {
    $executeRaw: jest.fn(async () => 1),
    $queryRaw: jest.fn(async () => [{ current_correlative: 10 }]),
    invoiceCreationRequest: {
      findUnique: jest.fn(async ({ where }: any) => requests.get(JSON.stringify(where))),
      create: jest.fn(async ({ data }: any) => {
        requests.set(JSON.stringify({ company_id_request_key: { company_id: data.company_id, request_key: data.request_key } }), data);
      }),
    },
    company: { findUnique: jest.fn(async () => ({ ruc: '20100070970', legal_name: 'Empresa' })) },
    businessPartner: { findFirst: jest.fn(async () => null) },
    invoice: {
      create: jest.fn(async ({ data }: any) => ({ ...data, id: 'inv-10', estado: 'PENDIENTE', created_at: new Date('2026-11-08') })),
      update: jest.fn(async () => ({})),
    },
    invoiceItem: { createMany: jest.fn(async () => ({ count: 1 })) },
    transactionHistory: { create: jest.fn() },
  };
  const prisma = { $transaction: jest.fn(async (work: any) => work(tx)) };
  const queue = { enqueueInvoiceInTx: jest.fn(async () => 'job-10') };
  return { tx, prisma, queue, service: new AtomicInvoiceCreationService(prisma as never, queue as never) };
}

it.each([undefined, '', 'short', 'invalid space request'])(
  'rechaza una clave inválida sin abrir transacción: %s', async (key) => {
    const h = harness();
    await expect(h.service.create(fiscal as never, 'empresa', key)).rejects.toThrow('Idempotency-Key');
    expect(h.prisma.$transaction).not.toHaveBeenCalled();
  },
);
it('exige tenant antes de abrir transacción', async () => {
  await expect(harness().service.create(fiscal as never, '', 'request-key-00001')).rejects.toThrow('ISSUER_COMPANY_REQUIRED');
});
it('reserva serie y crea evento usando el mismo cliente de la transacción exterior', async () => {
  const h = harness();
  const result = await h.service.create(fiscal as never, 'empresa', 'request-key-00001');
  expect(result.id).toBe('inv-10');
  expect(h.tx.$queryRaw).toHaveBeenCalledTimes(1);
  expect(h.queue.enqueueInvoiceInTx).toHaveBeenCalledWith(h.tx, 'inv-10');
  expect(h.tx.invoice.create.mock.calls[0][0].data.correlativo).toBe(10);
  expect(h.prisma.$transaction).toHaveBeenCalledTimes(1);
  expect(h.tx.$executeRaw.mock.invocationCallOrder[0]).toBeLessThan(h.tx.invoice.create.mock.invocationCallOrder[0]);
});
it('reintento posterior recupera respuesta durable sin consumir número ni crear evento', async () => {
  const h = harness();
  const first = await h.service.create(fiscal as never, 'empresa', 'request-key-00001');
  const replay = await h.service.create({ ...fiscal, payload_ubl: {} } as never, 'empresa', 'request-key-00001');
  expect(JSON.stringify(replay)).toBe(JSON.stringify(first));
  expect(h.tx.invoice.create).toHaveBeenCalledTimes(1);
  expect(h.tx.$queryRaw).toHaveBeenCalledTimes(1);
  expect(h.queue.enqueueInvoiceInTx).toHaveBeenCalledTimes(1);
});
it('misma clave y cuerpo distinto da conflicto, pero otro tenant no colisiona', async () => {
  const h = harness();
  await h.service.create(fiscal as never, 'empresa', 'request-key-00001');
  await expect(h.service.create({ ...fiscal, monto_total: 119 } as never, 'empresa', 'request-key-00001')).rejects.toThrow(ConflictException);
  await h.service.create(fiscal as never, 'otra', 'request-key-00001');
  expect(h.tx.invoice.create).toHaveBeenCalledTimes(2);
});
it('pantalla escribe importes y líneas antes de confirmar la respuesta idempotente', async () => {
  const h = harness();
  const result = await h.service.emitir(pantalla as never, 'empresa', 'request-key-00001');
  expect(result.numero).toBe('F001-00000010');
  expect(h.tx.invoice.update).toHaveBeenCalledWith(expect.objectContaining({ data: {
    taxable_operations: 100, total_igv: 18, exempt_operations: 0, unaffected_operations: 0,
  } }));
  expect(h.tx.invoiceItem.createMany.mock.invocationCallOrder[0]).toBeLessThan(h.tx.invoiceCreationRequest.create.mock.invocationCallOrder[0]);
  expect(h.prisma.$transaction).toHaveBeenCalledTimes(1);
  await h.service.emitir(pantalla as never, 'empresa', 'request-key-00001');
  expect(h.tx.invoiceItem.createMany).toHaveBeenCalledTimes(1);
});
it('fallo en líneas rechaza la transacción exterior y no registra éxito idempotente', async () => {
  const h = harness();
  h.tx.invoiceItem.createMany.mockRejectedValueOnce(new Error('write failed'));
  await expect(h.service.emitir(pantalla as never, 'empresa', 'request-key-00001')).rejects.toThrow('write failed');
  expect(h.tx.invoiceCreationRequest.create).not.toHaveBeenCalled();
});
