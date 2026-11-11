import { withBridgeTransaction } from '../../fixtures/bridgeTransactionPrisma';
import { describe, expect, it, jest } from '@jest/globals';
import { InvoiceStatus } from '../../../src/generated/client/enums';
import { balanceAsiento, lineasAsientoVenta } from '../../../src/modules/invoices/application/services/accountingBridge';
import { InvoiceJobConsumer } from '../../../src/modules/invoices/invoiceJobConsumer';
import { InvoiceAccountingBridgeService } from '../../../src/modules/invoices/application/services/invoiceAccountingBridgeService';
import { GenerateAccountingEntryUseCase } from '../../../src/modules/accounting/application/use-cases/generateAccountingEntryUseCase';

const importes = { gravado: 1000, igv: 180, exonerado: 0, inafecto: 0, icbper: 0, detraccion: 0, retencion: 0, total: 1080, descuentoNoAfecto: 100 };

const REGLAS_VENTA_BASE = [
  { line_order: 1, account_code: '12121' }, { line_order: 2, account_code: '40111' }, { line_order: 3, account_code: '70121' },
  { line_order: 4, account_code: '70321' }, { line_order: 5, account_code: '70521' }, { line_order: 6, account_code: '74111' },
  { line_order: 7, account_code: '12129' }, { line_order: 8, account_code: '40114' }, { line_order: 9, account_code: '74' },
  { line_order: 10, account_code: '69111' }, { line_order: 11, account_code: '20111' },
];
describe('asiento de descuentos 01 y 03', () => {
  it('carga cobro neto y cuenta 74 contra ventas brutas e IGV', () => {
    const lineas = lineasAsientoVenta(importes);
    expect(lineas).toEqual(expect.arrayContaining([
      expect.objectContaining({ accountCode: '12121', debitAmount: 1080, creditAmount: 0 }),
      expect.objectContaining({ accountCode: '74', debitAmount: 100, creditAmount: 0 }),
      expect.objectContaining({ accountCode: '70121', debitAmount: 0, creditAmount: 1000 }),
      expect.objectContaining({ accountCode: '40111', debitAmount: 0, creditAmount: 180 }),
    ]));
    expect(balanceAsiento(lineas)).toEqual({ debe: 1180, haber: 1180, cuadra: true });
  });

  it('no añade cuenta 74 cuando no hay descuento 01/03', () => {
    const lineas = lineasAsientoVenta({ ...importes, gravado: 90, igv: 16.2, total: 106.2, descuentoNoAfecto: 0 });
    expect(lineas.some((linea) => linea.accountCode === '74')).toBe(false);
    expect(balanceAsiento(lineas)).toEqual({ debe: 106.2, haber: 106.2, cuadra: true });
  });

  it('usa el descuento validado de M1 cuando también se recibe el campo de dev', () => {
    const lineas = lineasAsientoVenta({ ...importes, descuento: 80 });
    expect(lineas.find((linea) => linea.accountCode === '74')?.debitAmount).toBe(100);
    expect(lineas.filter((linea) => linea.accountCode === '74')).toHaveLength(1);
    expect(balanceAsiento(lineas)).toEqual({ debe: 1180, haber: 1180, cuadra: true });
  });

  it('el generador contable real acepta la cuenta 74 activa y recibe partida doble', async () => {
    const saveEntry = jest.fn(async (entry: unknown) => entry);
    const repo = { findByIdempotencyKey: jest.fn(async () => null), findPeriod: jest.fn(async () => ({ status: 'ABIERTO' })),
      findAccounts: jest.fn(async () => ['12121', '74', '70121', '40111'].map((code) => ({ code }))),
      getNextEntryNumber: jest.fn(async () => 1), saveEntry };
    const generador = new GenerateAccountingEntryUseCase(repo as never);
    const puente = new InvoiceAccountingBridgeService({ accountingEntry: { findFirst: jest.fn(async () => null) }, inventoryMovement: { findMany: jest.fn(async () => []) }, accountingRule: { findMany: jest.fn(async () => REGLAS_VENTA_BASE) } } as never, {} as never, generador);
    const resultado = await puente.registrar({ id: 'inv-1', companyId: 'company-1', tipoComprobante: '01', serie: 'F001', correlativo: 1, fechaEmision: '2026-03-15', items: [], importes });
    expect(resultado.completo).toBe(true);
    expect(saveEntry).toHaveBeenCalledTimes(1);
    const asiento = saveEntry.mock.calls[0][0] as { lines: Array<{ accountCode: string; debitAmount: number; creditAmount: number }> };
    expect(asiento.lines).toEqual(expect.arrayContaining([expect.objectContaining({ accountCode: '74', debitAmount: 100 })]));
  });

  it('informa si la cuenta 74 no está activa en el catálogo contable', async () => {
    const saveEntry = jest.fn(async (entry: unknown) => entry);
    const repo = { findByIdempotencyKey: jest.fn(async () => null), findPeriod: jest.fn(async () => ({ status: 'ABIERTO' })),
      findAccounts: jest.fn(async () => ['12121', '70121', '40111'].map((code) => ({ code }))),
      getNextEntryNumber: jest.fn(async () => 1), saveEntry };
    const puente = new InvoiceAccountingBridgeService({ accountingEntry: { findFirst: jest.fn(async () => null) }, inventoryMovement: { findMany: jest.fn(async () => []) }, accountingRule: { findMany: jest.fn(async () => REGLAS_VENTA_BASE) } } as never, {} as never, new GenerateAccountingEntryUseCase(repo as never));
    const resultado = await puente.registrar({ id: 'inv-1', companyId: 'company-1', tipoComprobante: '01', serie: 'F001', correlativo: 1, fechaEmision: '2026-03-15', items: [], importes });
    expect(resultado.completo).toBe(false);
    expect(resultado.errores.join(' ')).toContain('cuenta PCGE 74 no existe');
    expect(saveEntry).not.toHaveBeenCalled();
  });

  it.each(['01', '03'] as const)('el consumidor transmite el descuento %s al puente y protege el respaldo', async (codigo) => {
    const payload = { rucEmisor: '20601012341', tipoComprobante: '01', montoTotal: 1080,
      lineas: [{ id: 1, descripcion: 'Servicio', cantidad: 1, valorUnitario: 1000, afectacion: '10', totalLinea: 1180, igvLinea: 180, descuentos: codigo === '01' ? [{ codigo: '01', monto: 100 }] : [] }],
      lineasTributarias: [{ afectacion: '10', valorVenta: 1000, igv: 180 }],
      descuentoGlobal: codigo === '03' ? { codigo: '03', monto: 100 } : null };
    const fila = { id: 'inv-1', company_id: 'company-1', ruc_emisor: '20601012341', tipo_comprobante: '01', serie: 'F001', correlativo: 1,
      estado: InvoiceStatus.EN_COLA, fecha_emision: new Date('2026-03-15T00:00:00Z'), payload_ubl: payload,
      xml_storage_url: '<?xml version="1.0"?><Invoice><ds:Signature/></Invoice>', items: [] };
    const registrar = jest.fn(async (_f: unknown) => ({ movimientosRegistrados: 0, movimientosOmitidos: 0, asientoOmitido: false, errores: [], completo: false }));
    const accounting = { execute: jest.fn() };
    const consumer = new InvoiceJobConsumer(
      {} as never, { processWithRetry: jest.fn(async () => ({ estado: InvoiceStatus.ACEPTADO })) } as never,
      withBridgeTransaction({ invoice: { findUnique: jest.fn(async () => fila), update: jest.fn() } }) as never,
      {} as never, {} as never, { verifySignature: jest.fn(() => true) } as never,
      { validar: jest.fn(async () => ({ valido: true, errores: [], codigosDesconocidos: [], bloqueado: false, motivoBloqueo: null, validadoDeVerdad: true })) } as never,
      {} as never, { registrar } as never, { guardar: jest.fn(async () => 'hash-fixture') } as never, accounting as never,
    );
    await expect(consumer.procesar({ invoice_id: 'inv-1' })).rejects.toThrow('M1_ACCOUNTING_REVIEW_REQUIRED');
    expect(registrar).toHaveBeenCalledWith(expect.objectContaining({ motivoBloqueoAsiento: null, importes: expect.objectContaining(importes) }));
    expect(accounting.execute).not.toHaveBeenCalled();
  });
});
