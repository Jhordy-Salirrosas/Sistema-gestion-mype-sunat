/**
 * TA-29 · listado de comprobantes desde la base (sin datos de demostración).
 *
 * El doble de Prisma devuelve las filas ya proyectadas con el `select` del
 * servicio, igual que lo haría la base: así se prueba el mapeo a la forma que
 * consume el frontend y el filtro por empresa del token.
 */
import { NotFoundException } from '@nestjs/common';
import type { PrismaService } from '../../../src/database/prismaService';
import { InvoiceStatus } from '../../../src/generated/client/enums';
import { InvoiceQueryService } from '../../../src/modules/invoices/application/services/invoiceQueryService';
import type { QueueService } from '../../../src/modules/resilience/infrastructure/queue/queue.service';

const EMPRESA = 'empresa-1';

function filaListado() {
  return {
    id: 'inv-1',
    tipo_comprobante: '01',
    serie: 'F001',
    correlativo: 7,
    fecha_emision: new Date('2026-10-30T15:00:00Z'),
    estado: InvoiceStatus.ACEPTADO,
    monto_total: 118,
    currency_code: 'PEN',
    customer_identity_number: '20100070970',
    customer_legal_name: 'CLIENTE DE PRUEBA S.A.C.',
    sunat_response_code: '0',
  };
}

function crearServicio(opciones: { sinComprobante?: boolean } = {}) {
  const prisma = {
    invoice: {
      findMany: jest.fn().mockResolvedValue([filaListado()]),
      count: jest.fn().mockResolvedValue(1),
      findFirst: jest.fn().mockResolvedValue(opciones.sinComprobante ? null : filaListado()),
    },
    $transaction: jest.fn(async (operaciones: Array<Promise<unknown>>) =>
      Promise.all(operaciones),
    ),
  };
  const servicio = new InvoiceQueryService(
    prisma as unknown as PrismaService,
    {} as QueueService,
  );
  return { servicio, prisma };
}

describe('TA-29 · InvoiceQueryService', () => {
  it('lista la página con el total y filtra por la empresa del token', async () => {
    const { servicio, prisma } = crearServicio();

    const pagina = await servicio.listar(EMPRESA, { estado: 'ACEPTADO' }, '1', '20');

    expect(prisma.invoice.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ company_id: EMPRESA }),
      }),
    );
    expect(prisma.invoice.count).toHaveBeenCalledWith({
      where: expect.objectContaining({ company_id: EMPRESA }),
    });
    expect(pagina.total).toBe(1);
    expect(pagina.page).toBe(1);
    expect(pagina.page_size).toBe(20);
    expect(pagina.total_pages).toBe(1);
    expect(pagina.data[0]).toMatchObject({
      id: 'inv-1',
      numero: 'F001-00000007',
      estado: InvoiceStatus.ACEPTADO,
      monto_total: 118,
    });
  });

  it('calcula el número de páginas con el total real, no con la página', async () => {
    const { servicio, prisma } = crearServicio();
    prisma.invoice.count.mockResolvedValue(45);

    const pagina = await servicio.listar(EMPRESA, {}, '2', '20');

    expect(pagina.total_pages).toBe(3);
  });

  it('responde 404 al reintentar un comprobante que no existe', async () => {
    const { servicio } = crearServicio({ sinComprobante: true });

    await expect(servicio.reintentarCdr(EMPRESA, 'inv-inexistente')).rejects.toThrow(
      NotFoundException,
    );
  });
});
