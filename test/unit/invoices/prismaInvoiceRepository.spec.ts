import { Test, TestingModule } from '@nestjs/testing';
import { InternalServerErrorException } from '@nestjs/common';
import { PrismaInvoiceRepository } from '../../../src/modules/invoices/infrastructure/persistence/prismaInvoiceRepository';
import { PrismaService } from '../../../src/database/prismaService';
import { QueueService } from '../../../src/modules/resilience/infrastructure/queue/queue.service';
import { InvoiceEntity } from '../../../src/modules/invoices/domain/entities/invoiceEntity';

describe('PrismaInvoiceRepository', () => {
  let repository: PrismaInvoiceRepository;

  const invoiceEntity = new InvoiceEntity({
    ruc_emisor: '20100070970',
    serie: 'F001',
    correlativo: 1,
    tipo_comprobante: '01',
    monto_total: 150.5,
    fecha_emision: new Date('2026-10-10T10:00:00.000Z'),
    payload_ubl: { comprobante: 'prueba' },
  });

  const tx = {
    invoice: {
      create: jest.fn(),
    },
  };

  const prismaMock = {
    $transaction: jest.fn(),
  };

  const queueMock = {
    enqueueInvoiceInTx: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    tx.invoice.create.mockResolvedValue({
      id: 'invoice-test-001',
      estado: 'PENDIENTE',
      created_at: new Date('2026-10-10T10:00:00Z'),
    });

    prismaMock.$transaction.mockImplementation(
      async (callback: (transaction: typeof tx) => Promise<unknown>) =>
        callback(tx),
    );

    queueMock.enqueueInvoiceInTx.mockResolvedValue('job-test-001');

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PrismaInvoiceRepository,
        {
          provide: PrismaService,
          useValue: prismaMock,
        },
        {
          provide: QueueService,
          useValue: queueMock,
        },
      ],
    }).compile();

    repository = module.get<PrismaInvoiceRepository>(PrismaInvoiceRepository);
  });

  it('persiste la entidad y encola el trabajo dentro de una transacción atómica', async () => {
    const result = await repository.saveWithTransactionalOutbox(invoiceEntity);

    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
    expect(tx.invoice.create).toHaveBeenCalledWith({
      data: {
        ruc_emisor: invoiceEntity.ruc_emisor,
        serie: invoiceEntity.serie,
        correlativo: invoiceEntity.correlativo,
        tipo_comprobante: invoiceEntity.tipo_comprobante,
        monto_total: invoiceEntity.monto_total,
        fecha_emision: invoiceEntity.fecha_emision,
        payload_ubl: invoiceEntity.payload_ubl,
      },
      select: {
        id: true,
        estado: true,
        created_at: true,
      },
    });

    expect(queueMock.enqueueInvoiceInTx).toHaveBeenCalledWith(
      tx,
      'invoice-test-001',
    );
    expect(result.id).toBe('invoice-test-001');
  });

  it('lanza InternalServerErrorException si la transacción o el encolado fallan', async () => {
    queueMock.enqueueInvoiceInTx.mockRejectedValue(
      new Error('Fallo en cola'),
    );

    await expect(
      repository.saveWithTransactionalOutbox(invoiceEntity),
    ).rejects.toThrow(InternalServerErrorException);
  });
});
