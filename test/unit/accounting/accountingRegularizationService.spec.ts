import { BadRequestException } from '@nestjs/common';
import { AccountingRegularizationService } from '../../../src/modules/invoices/application/services/accountingRegularizationService';

const factura = (over: Record<string, unknown> = {}) => ({
  id: 'inv-1',
  serie: 'F001',
  correlativo: 1,
  tipo_comprobante: '01',
  ...over,
});

const crearPrisma = (facturas: unknown[], referencias: Array<{ source_reference_id: string }> = []) => ({
  invoice: { findMany: jest.fn().mockResolvedValue(facturas) },
  accountingEntry: { findMany: jest.fn().mockResolvedValue(referencias) },
});

describe('AccountingRegularizationService', () => {
  it('en seco informa los pendientes sin reprocesar nada', async () => {
    const prisma = crearPrisma([factura(), factura({ id: 'inv-2', correlativo: 2 })]);
    const puente = { reprocesar: jest.fn() };

    const r = await new AccountingRegularizationService(prisma as never, puente as never).execute('c1');

    expect(r.dryRun).toBe(true);
    expect(r.pendientes).toBe(2);
    expect(r.regularizados).toBe(0);
    expect(r.detalle.map((d) => d.numero)).toEqual(['F001-00000001', 'F001-00000002']);
    expect(puente.reprocesar).not.toHaveBeenCalled();
  });

  it('excluye los comprobantes que ya tienen asiento', async () => {
    const prisma = crearPrisma(
      [factura(), factura({ id: 'inv-2', correlativo: 2 })],
      [{ source_reference_id: 'inv-1' }],
    );
    const puente = { reprocesar: jest.fn() };

    const r = await new AccountingRegularizationService(prisma as never, puente as never).execute('c1');

    expect(r.pendientes).toBe(1);
    expect(r.detalle[0].id).toBe('inv-2');
  });

  it('reconoce como existente un asiento referenciado por número de comprobante', async () => {
    const prisma = crearPrisma([factura()], [{ source_reference_id: 'F001-00000001' }]);
    const r = await new AccountingRegularizationService(prisma as never, { reprocesar: jest.fn() } as never).execute('c1');
    expect(r.pendientes).toBe(0);
  });

  it('reprocesa cuando se pide explícitamente y cuenta los resultados', async () => {
    const prisma = crearPrisma([
      factura(),
      factura({ id: 'inv-2', correlativo: 2 }),
      factura({ id: 'inv-3', correlativo: 3 }),
    ]);
    const puente = {
      reprocesar: jest
        .fn()
        .mockResolvedValueOnce({ asientoId: 'a1', asientoOmitido: false, errores: [] })
        .mockResolvedValueOnce({ asientoId: 'a2', asientoOmitido: true, errores: [] })
        .mockResolvedValueOnce({ asientoOmitido: false, errores: ['sin reglas'] }),
    };

    const r = await new AccountingRegularizationService(prisma as never, puente as never).execute('c1', {
      dryRun: false,
    });

    expect(r.regularizados).toBe(1);
    expect(r.omitidos).toBe(1);
    expect(r.fallidos).toHaveLength(1);
    expect(r.fallidos[0].motivo).toBe('sin reglas');
    expect(puente.reprocesar).toHaveBeenCalledTimes(3);
  });

  it('no detiene el lote cuando un comprobante falla', async () => {
    const prisma = crearPrisma([
      factura(),
      factura({ id: 'inv-2', correlativo: 2 }),
    ]);
    const puente = {
      reprocesar: jest
        .fn()
        .mockRejectedValueOnce(new Error('puente roto'))
        .mockResolvedValueOnce({ asientoId: 'a2', asientoOmitido: false, errores: [] }),
    };

    const r = await new AccountingRegularizationService(prisma as never, puente as never).execute('c1', {
      dryRun: false,
    });

    expect(r.fallidos[0].motivo).toContain('puente roto');
    expect(r.regularizados).toBe(1);
  });

  it('devuelve un resultado vacío cuando no hay comprobantes', async () => {
    const prisma = crearPrisma([]);
    const r = await new AccountingRegularizationService(prisma as never, { reprocesar: jest.fn() } as never).execute('c1');
    expect(r).toMatchObject({ revisados: 0, pendientes: 0, regularizados: 0, detalle: [] });
  });

  it('recorta el límite al máximo permitido', async () => {
    const prisma = crearPrisma([]);
    await new AccountingRegularizationService(prisma as never, { reprocesar: jest.fn() } as never).execute('c1', {
      limit: 5000,
    });
    expect(prisma.invoice.findMany.mock.calls[0][0].take).toBe(500);
  });

  it('usa 50 comprobantes por defecto', async () => {
    const prisma = crearPrisma([]);
    await new AccountingRegularizationService(prisma as never, { reprocesar: jest.fn() } as never).execute('c1');
    expect(prisma.invoice.findMany.mock.calls[0][0].take).toBe(50);
  });

  it('rechaza una lista de ids mayor al lote máximo', async () => {
    const prisma = crearPrisma([]);
    await expect(
      new AccountingRegularizationService(prisma as never, { reprocesar: jest.fn() } as never).execute('c1', {
        ids: Array.from({ length: 501 }, (_, i) => `id-${i}`),
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('acota la consulta a la empresa y a los comprobantes aceptados u observados', async () => {
    const prisma = crearPrisma([]);
    await new AccountingRegularizationService(prisma as never, { reprocesar: jest.fn() } as never).execute('c1');
    expect(prisma.invoice.findMany.mock.calls[0][0].where).toMatchObject({
      company_id: 'c1',
      estado: { in: ['ACEPTADO', 'OBSERVADO'] },
      tipo_comprobante: { in: ['01', '03'] },
    });
  });
});
