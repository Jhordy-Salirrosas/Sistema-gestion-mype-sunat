import { InvoiceQueryService } from '../../../src/modules/invoices/application/services/invoiceQueryService';
import { InvoiceStatus } from '../../../src/generated/client/enums';

const EMPRESA = 'empresa-propia';

function servicioCon(estado: string) {
  const prisma = {
    invoice: {
      updateMany: jest.fn(async () => ({ count: 1 })),
      findFirst: jest.fn().mockResolvedValue({ id: 'inv-1', estado: InvoiceStatus.ERROR_RED }),
      findUnique: jest.fn().mockResolvedValue({ estado: InvoiceStatus.ERROR_RED }),
    },
    auditLog: { create: jest.fn().mockResolvedValue({}) },
  };
  const queue = {
    enqueueInvoiceInTx: jest.fn(),
    reenqueueInvoiceIfIdle: jest.fn(async (_id: string, _company: string, cb: () => Promise<boolean>) => {
      await cb();
      return { estado, jobId: 'job-2' };
    }),
  };
  return { servicio: new InvoiceQueryService(prisma as never, queue as never), queue };
}

describe('TA-29 · reintento con operación atómica de M2', () => {
  it.each([
    ['ENCOLADO', true],
    ['YA_EN_COLA', false],
    ['EN_DLQ', false],
    ['ESTADO_NO_PERMITIDO', false],
  ] as const)('traduce el resultado %s a encolado=%s', async (estado, encolado) => {
    const { servicio, queue } = servicioCon(estado);
    const resultado = await servicio.reintentarCdr(EMPRESA, 'inv-1');

    expect(resultado.encolado).toBe(encolado);
    expect(resultado.mensaje).toBeTruthy();
    expect(queue.reenqueueInvoiceIfIdle).toHaveBeenCalled();
    expect(queue.enqueueInvoiceInTx).not.toHaveBeenCalled();
  });
});
