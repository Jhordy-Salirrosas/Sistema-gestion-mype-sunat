import { withBridgeTransaction } from '../../fixtures/bridgeTransactionPrisma';
import { InvoiceStatus } from '../../../src/generated/client/enums';
import { InvoiceJobConsumer } from '../../../src/modules/invoices/invoiceJobConsumer';
import { InvoiceAccountingBridgeService } from '../../../src/modules/invoices/application/services/invoiceAccountingBridgeService';
import { GenerateAccountingEntryUseCase } from '../../../src/modules/accounting/application/use-cases/generateAccountingEntryUseCase';
import { InvoiceAccountingFallbackService } from '../../../src/modules/invoices/application/services/invoiceAccountingFallbackService';
import { PrismaAccountingRepository } from '../../../src/modules/accounting/infrastructure/prismaAccountingRepository';

// Solo se simulan los límites externos: envío aceptado y almacenamiento Prisma.
// Ambos escritores usan el repositorio y los casos de uso reales.
function escenario() {
  const entries: any[] = [];
  const matches = (row: any, where: any): boolean =>
    Object.entries(where).every(([key, value]) =>
      key === 'OR'
        ? (value as any[]).some((clause) => matches(row, clause))
        : row[key] === value,
    );
  const fila = {
    id: 'invoice-uuid',
    company_id: 'company-1',
    ruc_emisor: '20601012341',
    tipo_comprobante: '01',
    serie: 'F001',
    correlativo: 143,
    estado: InvoiceStatus.EN_COLA,
    fecha_emision: new Date('2026-03-15T00:00:00Z'),
    monto_total: 118,
    total_igv: 18,
    taxable_operations: 100,
    customer_legal_name: 'CLIENTE',
    items: [],
    xml_storage_url: '<?xml version="1.0"?><Invoice><ds:Signature/></Invoice>',
    payload_ubl: {
      rucEmisor: '20601012341',
      tipoComprobante: '01',
      montoTotal: 118,
      montoIgv: 18,
      montoGravado: 100,
      lineasTributarias: [{ afectacion: '10', valorVenta: 100, igv: 18 }],
    },
  };
  const prisma = {
    invoice: { findUnique: jest.fn(async () => fila), update: jest.fn() },
    accountingPeriod: {
      findUnique: jest.fn(async () => ({ status: 'ABIERTO' })),
    },
    accountingAccount: {
      findMany: jest.fn(async () =>
        ['12121', '70121', '40111'].map((code) => ({ code })),
      ),
    },
    inventoryMovement: {
      findMany: jest.fn(async () => []),
    },
    accountingRule: { findMany: jest.fn(async () => REGLAS_VENTA_BASE) },
    accountingEntry: {
      findFirst: jest.fn(async ({ where, orderBy }: any) =>
        orderBy
          ? (entries.at(-1) ?? null)
          : (entries.find((row) => matches(row, where)) ?? null),
      ),
      count: jest.fn(
        async ({ where }: any) =>
          entries.filter((row) => matches(row, where)).length,
      ),
      create: jest.fn(async ({ data }: any) => {
        const row = {
          ...data,
          id: `entry-${entries.length + 1}`,
          lines: data.lines.create,
        };
        entries.push(row);
        return row;
      }),
    },
  };
  const repo = new PrismaAccountingRepository(prisma as never);
  const generator = new GenerateAccountingEntryUseCase(repo);
  const bridge = new InvoiceAccountingBridgeService(
    prisma as never,
    {} as never,
    generator,
  );
  const registrar = jest.spyOn(bridge, 'registrar');
  const fallback = new InvoiceAccountingFallbackService(generator);
  const respaldo = jest.spyOn(fallback, 'execute');
  const consumer = new InvoiceJobConsumer(
    {} as never,
    {
      processWithRetry: jest.fn(async () => ({
        estado: InvoiceStatus.ACEPTADO,
      })),
    } as never,
    withBridgeTransaction(prisma) as never,
    {} as never,
    {} as never,
    { verifySignature: jest.fn(() => true) } as never,
    {
      validar: jest.fn(async () => ({
        valido: true,
        errores: [],
        codigosDesconocidos: [],
        bloqueado: false,
        motivoBloqueo: null,
        validadoDeVerdad: true,
      })),
    } as never,
    {} as never,
    bridge,
    { guardar: jest.fn(async () => 'hash-fixture') } as never,
    fallback,
  );
  return { entries, prisma, registrar, respaldo, consumer };
}

async function emitir(consumer: InvoiceJobConsumer) {
  await expect(
    consumer.procesar({ invoice_id: 'invoice-uuid' }),
  ).resolves.toMatchObject({ estado: InvoiceStatus.ACEPTADO });
}

const REGLAS_VENTA_BASE = [
  { line_order: 1, account_code: '12121' }, { line_order: 2, account_code: '40111' }, { line_order: 3, account_code: '70121' },
  { line_order: 4, account_code: '70321' }, { line_order: 5, account_code: '70521' }, { line_order: 6, account_code: '74111' },
  { line_order: 7, account_code: '12129' }, { line_order: 8, account_code: '40114' }, { line_order: 9, account_code: '74' },
  { line_order: 10, account_code: '69111' }, { line_order: 11, account_code: '20111' },
];
describe('M1 · asiento único en el flujo del worker', () => {
  it('tras la emisión aceptada persiste un solo asiento y propaga su id al worker', async () => {
    const s = escenario();
    await emitir(s.consumer);
    expect(s.entries.map((e) => e.source_module)).toEqual(['M1_INVOICES']);
    expect((await s.registrar.mock.results[0].value).asientoId).toBe(
      s.entries[0].id,
    );
    expect(s.respaldo).not.toHaveBeenCalled();
  });

  it('el respaldo sí crea el asiento cuando el puente no creó ninguno; reprocesar no duplica', async () => {
    const s = escenario();
    s.registrar.mockResolvedValue({
      movimientosRegistrados: 0,
      movimientosOmitidos: 0,
      asientoOmitido: false,
      completo: false,
      errores: ['Contabilidad: fallo contable'],
    });
    await emitir(s.consumer);
    expect(s.entries.map((e) => e.source_module)).toEqual(['M1_INVOICES']);
    expect(s.entries[0].idempotency_key).toBe('m1:invoice:invoice-uuid');
    expect(s.respaldo).toHaveBeenCalledTimes(1);
    await emitir(s.consumer);
    expect(s.entries).toHaveLength(1);
    expect(s.respaldo).toHaveBeenCalledTimes(1);
  });

  it('reprocesar con el puente real conserva un solo asiento', async () => {
    const s = escenario();
    await emitir(s.consumer);
    await emitir(s.consumer);
    expect(s.entries).toHaveLength(1);
    expect(s.respaldo).not.toHaveBeenCalled();
  });

  it.each(['M1_INVOICES', 'INVOICES'])(
    'omite el respaldo si ya existe %s aunque el puente no entregue id',
    async (source_module) => {
      const s = escenario();
      s.entries.push({
        id: 'existing',
        company_id: 'company-1',
        source_module,
        source_reference_id:
          source_module === 'M1_INVOICES' ? 'F001-00000143' : 'invoice-uuid',
      });
      s.registrar.mockResolvedValue({
        movimientosRegistrados: 0,
        movimientosOmitidos: 0,
        asientoOmitido: false,
        completo: false,
        errores: [],
      });
      await emitir(s.consumer);
      expect(s.entries).toHaveLength(1);
      expect(s.respaldo).not.toHaveBeenCalled();
      expect(s.prisma.accountingEntry.findFirst).toHaveBeenCalledWith({
        where: {
          company_id: 'company-1',
          OR: [
            {
              source_module: 'M1_INVOICES',
              source_reference_id: 'F001-00000143',
            },
            { source_module: 'INVOICES', source_reference_id: 'invoice-uuid' },
            { source_module: 'M1_INVOICES', source_reference_id: 'invoice-uuid' },
            { idempotency_key: 'm1:invoice:invoice-uuid' },
          ],
        },
        select: { id: true },
      });
    },
  );
});
