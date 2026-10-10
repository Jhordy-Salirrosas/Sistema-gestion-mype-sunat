import { Test, TestingModule } from '@nestjs/testing';
import { InternalServerErrorException } from '@nestjs/common';
import { InvoicesService } from './invoices.service';
import { PrismaService } from '../../prisma/prisma.service';
import { QueueService } from '../queue/queue.service';

describe('InvoicesService', () => {
  let service: InvoicesService;

  const invoice = {
    id: 'invoice-test-001',
    estado: 'PENDIENTE',
    created_at: new Date('2026-10-10T10:00:00Z'),
  };

  const dto = {
    ruc_emisor: '20100070970',
    serie: 'F001',
    correlativo: 1,
    tipo_comprobante: '01',
    monto_total: 150.5,
    fecha_emision: '2026-10-10T10:00:00.000Z',
    payload_ubl: {
      comprobante: 'prueba',
    },
  };

  const tx = {
    invoice: {
      create: jest.fn(),
    },
    $queryRawUnsafe: jest.fn(),
  };

  const prismaMock = {
    $transaction: jest.fn(),
  };

  const queueMock = {
    enqueueInvoiceInTx: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    tx.invoice.create.mockResolvedValue(invoice);

    prismaMock.$transaction.mockImplementation(
      async (callback: (transaction: typeof tx) => Promise<unknown>) =>
        callback(tx),
    );

    queueMock.enqueueInvoiceInTx.mockResolvedValue('job-test-001');

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InvoicesService,
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

    service = module.get<InvoicesService>(InvoicesService);
  });

  it('registra el comprobante y encola el trabajo dentro de la misma transacción', async () => {
    const result = await service.create(dto);

    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);

    expect(tx.invoice.create).toHaveBeenCalledWith({
      data: {
        ruc_emisor: dto.ruc_emisor,
        serie: dto.serie,
        correlativo: dto.correlativo,
        tipo_comprobante: dto.tipo_comprobante,
        monto_total: dto.monto_total,
        fecha_emision: new Date(dto.fecha_emision),
        payload_ubl: dto.payload_ubl,
      },
      select: {
        id: true,
        estado: true,
        created_at: true,
      },
    });

    expect(queueMock.enqueueInvoiceInTx).toHaveBeenCalledWith(
      tx,
      invoice.id,
    );

    expect(result).toEqual(invoice);
  });

  it('propaga un error HTTP 500 si falla el encolado', async () => {
    queueMock.enqueueInvoiceInTx.mockRejectedValue(
      new Error('Fallo simulado al escribir el trabajo'),
    );

    await expect(service.create(dto)).rejects.toThrow(
      InternalServerErrorException,
    );

    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
    expect(tx.invoice.create).toHaveBeenCalledTimes(1);
    expect(queueMock.enqueueInvoiceInTx).toHaveBeenCalledWith(
      tx,
      invoice.id,
    );
  });

  it('no invoca directamente a SUNAT al registrar un comprobante', async () => {
    await service.create(dto);

    expect(queueMock.enqueueInvoiceInTx).toHaveBeenCalledTimes(1);

    expect(Object.keys(service)).not.toContain('sunatService');
  });
});