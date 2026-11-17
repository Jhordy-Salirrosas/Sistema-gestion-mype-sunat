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
    inventoryProduct: {
      findMany: jest.fn().mockResolvedValue([]),
    },
    inventoryBalance: {
      findMany: jest.fn().mockResolvedValue([]),
    },
    inventoryWarehouse: {
      findMany: jest.fn().mockResolvedValue([]),
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

  describe('catalogoProductos y almacenes', () => {
    it('retorna catálogo con detracciones y descuentos correctamente mapeados', async () => {
      const { servicio, prisma } = crearServicio();
      (prisma.inventoryProduct.findMany as jest.Mock).mockResolvedValue([
        {
          id: 'prod-1',
          sku: 'SKU-001',
          description: 'Laptop',
          sunat_unit_code: 'NIU',
          tax_affectation: '10',
          sale_price: '1500.00',
          is_active: true,
          has_detraction: true,
          detraction_code: '022',
          detraction_rate: 10,
          discount_rate: 5,
        },
        {
          id: 'prod-2',
          sku: 'SKU-002',
          description: 'Mouse',
          sunat_unit_code: 'NIU',
          tax_affectation: '10',
          sale_price: '50.00',
          is_active: true,
          has_detraction: false,
          detraction_code: null,
          detraction_rate: null,
          discount_rate: null,
        },
      ]);
      (prisma.inventoryBalance.findMany as jest.Mock).mockResolvedValue([
        { product_id: 'prod-1', current_stock: 15 },
        { product_id: 'prod-2', current_stock: 30 },
      ]);

      const catalogo = await servicio.catalogoProductos(EMPRESA, 'ALM-01');

      expect(catalogo.balances).toHaveLength(2);
      expect(catalogo.balances[0]).toMatchObject({
        sku: 'SKU-001',
        hasDetraction: true,
        detractionCode: '022',
        detractionRate: 10,
        discountRate: 5,
        currentStock: 15,
        vendible: true,
      });
      expect(catalogo.balances[1]).toMatchObject({
        sku: 'SKU-002',
        hasDetraction: false,
        detractionCode: null,
        detractionRate: null,
        discountRate: 0,
        currentStock: 30,
        vendible: true,
      });
    });

    it('lista almacenes activos de la empresa', async () => {
      const { servicio, prisma } = crearServicio();
      (prisma.inventoryWarehouse.findMany as jest.Mock).mockResolvedValue([
        { warehouse_code: 'ALM-01', description: 'Principal' },
      ]);

      const res = await servicio.almacenes(EMPRESA);
      expect(res).toHaveLength(1);
      expect(prisma.inventoryWarehouse.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ company_id: EMPRESA, is_active: true }),
        }),
      );
    });
  });
});
