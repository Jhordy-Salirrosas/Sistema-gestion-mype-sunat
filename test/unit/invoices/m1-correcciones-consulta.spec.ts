import { InvoiceQueryService } from '../../../src/modules/invoices/application/services/invoiceQueryService';
import {
  aListado,
  aDetalle,
  aComprobanteOrigenFallback,
} from '../../../src/modules/invoices/application/services/invoiceQueryMapper';
import { InvoiceQueryController } from '../../../src/modules/invoices/infrastructure/controllers/invoiceQueryController';

const company = 'empresa-1';
const fecha = new Date('2026-11-07T12:00:00Z');
const fila = (extra = {}) => ({
  id: 'nota',
  tipo_comprobante: '07',
  serie: 'FC01',
  correlativo: 2,
  fecha_emision: fecha,
  estado: 'ACEPTADO' as never,
  monto_total: 118,
  currency_code: 'PEN',
  customer_identity_number: '20100070970',
  customer_legal_name: 'Cliente de la nota',
  sunat_response_code: '0',
  ruc_emisor: '20100070970',
  taxable_operations: 100,
  total_igv: 18,
  cdr_sunat: null,
  history: [],
  created_at: fecha,
  updated_at: fecha,
  ...extra,
});
const origen = {
  id: 'original',
  tipo_comprobante: '01',
  serie: 'F001',
  correlativo: 42,
  customer_identity_number: '20600000001',
  customer_legal_name: 'Cliente original',
  monto_total: { toString: () => '1180.50' },
  currency_code: 'USD',
};
const esperado = {
  id: 'original',
  tipo_comprobante: '01',
  serie: 'F001',
  correlativo: 42,
  numero: 'F001-00000042',
  cliente_documento: '20600000001',
  cliente_nombre: 'Cliente original',
  monto_total: 1180.5,
  moneda: 'USD',
};

function montar(filas: ReturnType<typeof fila>[], origenes: unknown[] = []) {
  const prisma = {
    $transaction: jest.fn((ops: Promise<unknown>[]) => Promise.all(ops)),
    invoice: {
      findMany: jest
        .fn()
        .mockResolvedValueOnce(filas)
        .mockResolvedValue(origenes),
      count: jest.fn().mockResolvedValue(filas.length),
      findFirst: jest.fn().mockResolvedValue(filas[0]),
    },
  };
  return {
    prisma,
    servicio: new InvoiceQueryService(prisma as never, {} as never),
  };
}

describe('M1 consulta de notas y datos fiscales reales', () => {
  it.each(['referenced_invoice_id', 'numero_largo', 'numero_corto'])(
    'resuelve origen en listado por %s dentro de la empresa',
    async (clave) => {
      const nota = fila(
        clave === 'referenced_invoice_id'
          ? { referenced_invoice_id: 'original' }
          : {
              referenced_series_correlative:
                clave === 'numero_largo' ? ' F001-00000042 ' : 'F001-42',
            },
      );
      const { servicio, prisma } = montar(
        [nota, fila({ tipo_comprobante: '01' })],
        [origen],
      );
      const resultado = await servicio.listar(company, {});
      expect(resultado.data[0].comprobante_origen).toEqual(esperado);
      expect(resultado.data[1].comprobante_origen).toBeNull();
      expect(prisma.invoice.findMany.mock.calls[1][0].where).toEqual({
        company_id: company,
        OR:
          clave === 'referenced_invoice_id'
            ? [{ id: { in: ['original'] } }]
            : [{ serie: 'F001', correlativo: 42 }],
      });
      expect(prisma.invoice.findMany.mock.calls[0][0].select).toMatchObject({
        payload_ubl: true,
        cdr_sunat: true,
        referenced_invoice_id: true,
      });
    },
  );

  it('el detalle publica el mismo origen completo que el listado', async () => {
    const { servicio, prisma } = montar([
      fila({ tipo_comprobante: '08', referenced_invoice_id: 'original' }),
    ]);
    prisma.invoice.findMany.mockReset().mockResolvedValue([origen]);
    expect(
      (await servicio.detalle(company, 'nota')).comprobante_origen,
    ).toEqual(esperado);
    expect(prisma.invoice.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { company_id: company, id: 'nota' } }),
    );
  });

  it('conserva la referencia sin inventar importe cuando no encuentra el origen', async () => {
    const { servicio } = montar([
      fila({
        referenced_invoice_id: 'ausente',
        referenced_series_correlative: 'F001-42',
        referenced_document_type: '01',
      }),
    ]);
    expect(
      (await servicio.listar(company, {})).data[0].comprobante_origen,
    ).toMatchObject({
      id: 'ausente',
      numero: 'F001-00000042',
      monto_total: null,
    });
  });

  it.each([undefined, '', 'referencia antigua'])(
    'tolera referencia %s sin consultar un origen inexistente',
    async (ref) => {
      const { servicio, prisma } = montar([
        fila({ referenced_series_correlative: ref }),
      ]);
      const dto = (await servicio.listar(company, {})).data[0];
      expect(prisma.invoice.findMany).toHaveBeenCalledTimes(1);
      expect(dto.comprobante_origen).toEqual(
        ref
          ? expect.objectContaining({
              serie: null,
              correlativo: null,
              numero: ref,
              monto_total: null,
            })
          : null,
      );
    },
  );

  it.each([null, undefined, {}, 'basura', { formaPago: 'crédito' }])(
    'pago desconocido en listado y detalle para %j',
    (payload_ubl) => {
      for (const map of [aListado, aDetalle]) {
        const dto = map(fila({ payload_ubl }));
        expect(dto.forma_pago).toBeNull();
        expect(dto.cuotas).toEqual([]);
        expect(dto.cdr_descripcion).toBeNull();
      }
    },
  );

  it('mantiene cuotas, fechas e importe del payload y descripción literal del CDR en ambas vistas', () => {
    const datos = fila({
      payload_ubl: {
        formaPago: 'Credito',
        cuotas: [
          null,
          {
            monto: 59.25,
            vencimiento: '2026-12-07T12:00:00Z',
          },
        ],
      },
      cdr_sunat: { description: 'Aceptado con observación' },
    });
    for (const map of [aListado, aDetalle]) {
      expect(map(datos)).toMatchObject({
        forma_pago: 'Credito',
        cuotas: [
          { numero: null, monto: 59.25, vencimiento: '2026-12-07' },
        ],
        cdr_descripcion: 'Aceptado con observación',
      });
    }
  });

  it('respeta origen null explícito y no asigna origen a facturas', () => {
    expect(
      aListado(
        fila({
          comprobante_origen: null,
          referenced_series_correlative: 'F001-42',
        }),
      ).comprobante_origen,
    ).toBeNull();
    expect(
      aComprobanteOrigenFallback(fila({ tipo_comprobante: '01' }), origen),
    ).toBeNull();
  });
});

describe('M1 catálogo de productos para emisión', () => {
  it('proyecta Catálogo 07 por producto, agrega almacenes y deja null si no consta afectación', async () => {
    const prisma = {
      inventoryProduct: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'p1',
            sku: 'A',
            description: 'Exonerado',
            sunat_unit_code: 'NIU',
            tax_affectation: ' 20 ',
          },
          {
            id: 'p2',
            sku: 'B',
            description: 'Sin dato',
            sunat_unit_code: 'KGM',
            tax_affectation: null,
          },
          {
            id: 'p3',
            sku: 'C',
            description: 'Blanco',
            sunat_unit_code: 'NIU',
            tax_affectation: ' ',
          },
        ]),
      },
      inventoryBalance: {
        findMany: jest.fn().mockResolvedValue([
          { product_id: 'p1', current_stock: '2.5', average_unit_cost: '10' },
          { product_id: 'p1', current_stock: 3, average_unit_cost: 0 },
          {
            product_id: 'p1',
            current_stock: 'invalido',
            average_unit_cost: 'invalido',
          },
          { product_id: 'p2', current_stock: null, average_unit_cost: null },
        ]),
      },
    };
    const servicio = new InvoiceQueryService(prisma as never, {} as never);
    expect(await servicio.catalogoProductos(company)).toEqual({
      balances: [
        {
          sku: 'A',
          description: 'Exonerado',
          sunatUnitCode: 'NIU',
          taxAffectation: '20',
          currentStock: 5.5,
          averageUnitCost: 10,
        },
        {
          sku: 'B',
          description: 'Sin dato',
          sunatUnitCode: 'KGM',
          taxAffectation: null,
          currentStock: 0,
          averageUnitCost: 0,
        },
        {
          sku: 'C',
          description: 'Blanco',
          sunatUnitCode: 'NIU',
          taxAffectation: null,
          currentStock: 0,
          averageUnitCost: 0,
        },
      ],
    });
    expect(prisma.inventoryProduct.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { company_id: company, is_active: true },
        select: expect.objectContaining({ tax_affectation: true }),
      }),
    );
    expect(prisma.inventoryBalance.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { company_id: company } }),
    );
  });

  it('el controlador del catálogo delega con la empresa del token', async () => {
    const consultas = {
      catalogoProductos: jest.fn().mockResolvedValue({ balances: [] }),
    };
    const controller = new InvoiceQueryController(
      consultas as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );
    expect(Reflect.getMetadata('method', controller.catalogoProductos)).toBe(0);
    expect(await controller.catalogoProductos(company)).toEqual({
      balances: [],
    });
    expect(consultas.catalogoProductos).toHaveBeenCalledWith(company);
  });
});

it('una cuota histórica incompleta no recibe número, monto ni fecha inventados', () => {
  const r = aListado(fila({ payload_ubl: { formaPago: 'Credito', cuotas: [{}, { numero: 1, monto: '59', vencimiento: 'no consta' }, { numero: 'Cuota003', monto: 59, vencimiento: '2026-12-07T12:00:00Z' }] } }));
  expect(r.cuotas).toEqual([{ numero: null, monto: null, vencimiento: null }, { numero: null, monto: null, vencimiento: null }, { numero: 'Cuota003', monto: 59, vencimiento: '2026-12-07' }]);
});
it('no atribuye datos de la nota al origen que no pudo recuperar', () => {
  expect(aComprobanteOrigenFallback(fila({ referenced_series_correlative: 'F001-42', referenced_document_type: '01' }))).toMatchObject({ cliente_documento: null, cliente_nombre: null, monto_total: null, moneda: null });
});
