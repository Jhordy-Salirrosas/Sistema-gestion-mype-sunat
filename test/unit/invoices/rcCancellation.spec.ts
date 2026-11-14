import { fechaAceptacionNota, validarNotaAnulacionRc, esAnulacionRc } from '../../../src/modules/invoices/application/services/summaryCancellation';
import { construirResumenDiario } from '../../../src/modules/invoices/application/services/summaryDocumentsBuilder';
import { aggregateHarness } from '../../fixtures/summaryAggregateHarness';
import { hashSummary } from '../../../src/modules/invoices/application/services/summaryGate';
import { SignatureService } from '../../../src/modules/sunat/signature.service';
import { fakeIssuerCertificate } from '../../fixtures/fakeIssuerCertificate';
import { ejecutarSfs } from '../../../src/modules/invoices/application/services/sunatSfsRunner';
const doc = () => ({ tipoComprobante: '07', serie: 'BC01', correlativo: 1, fechaEmision: '2026-11-01', fechaAceptacion: '2026-11-07', documentoAfectado: 'B001-1', condicion: '3' as const, estado: 'ACEPTADO', tipoDocCliente: '6', numDocCliente: '20100070970', total: 118, igv: 18, fiscal: { pagos: [{ codigo: '01', monto: 100 }], tributos: [{ codigo: '1000', base: 100, impuesto: 18 }], descuento: 0 } });
const cabecera = { rucEmisor: '20000000001', razonSocialEmisor: 'Empresa', fechaResumen: '2026-11-01', fechaGeneracion: '2026-11-14', correlativo: 1 };
it.each(['BC01', 'BD01'])('anulación %s genera ConditionCode 3 y conserva referencia, impuestos y fecha original', serie => {
  const xml = construirResumenDiario(cabecera, [{ ...doc(), serie, tipoComprobante: serie === 'BD01' ? '08' : '07' }]);
  expect(xml).toContain('<cbc:ConditionCode>3</cbc:ConditionCode>');
  expect(xml).toContain('<cbc:ReferenceDate>2026-11-01</cbc:ReferenceDate>');
  expect(xml).toContain('<cbc:ID>B001-1</cbc:ID>'); expect(xml).toContain('118.00');
});
it.each([
 { serie: 'FC01' }, { tipoComprobante: '03' }, { estado: 'PENDIENTE' }, { estado: 'ANULADO' },
 { fechaAceptacion: undefined }, { fechaAceptacion: '2026-11-06' }, { fechaAceptacion: '2026-11-15' },
 { documentoAfectado: 'F001-1' }, { fechaAceptacion: '2026-02-31' },
])('rechaza selección no acreditada: %j', extra => {
 expect(() => validarNotaAnulacionRc({ ...doc(), ...extra }, '2026-11-14')).toThrow();
});
it('una consulta/puente no sustituye fecha de CDR, y una nueva aceptación no extiende el primer plazo', () => {
 const history = [ { created_at: new Date('2026-11-07T12:00:00Z'), estado_nuevo: 'ACEPTADO', codigo_error: '0' },
 { created_at: new Date('2026-11-14T12:00:00Z'), estado_nuevo: 'ACEPTADO', codigo_error: 'M1_BRIDGE_DONE' },
 { created_at: new Date('2026-11-14T12:00:00Z'), estado_nuevo: 'ACEPTADO', codigo_error: '0' } ];
 expect(fechaAceptacionNota({ history })).toBe('2026-11-07');
 expect(fechaAceptacionNota({ cdr_sunat: { responseDate: '2026-11-07' } })).toBe('2026-11-07');
 expect(fechaAceptacionNota({ history: history.slice(1, 2) })).toBeUndefined();
 expect(esAnulacionRc([{ conditionCode: '3', noOtorgado: true }])).toBe(true);
 expect(esAnulacionRc([{ conditionCode: '3' }])).toBe(false); expect(esAnulacionRc([])).toBe(false);
});
it('no mezcla un alta con una anulación en el mismo RC', () => {
 expect(() => construirResumenDiario(cabecera, [doc(), { ...doc(), condicion: undefined, estado: 'PENDIENTE' }])).toThrow('no mezcle');
});
function cancelHarness() {
 const h = aggregateHarness('RC'); Object.assign(h.member, { serie: 'BC01', tipoComprobante: '07', conditionCode: '3', noOtorgado: true, acceptedDate: '2026-11-07' });
 h.row.xml = h.row.xml.replace('>03</cbc:DocumentTypeCode>', '>07</cbc:DocumentTypeCode>').replace('B001-00000001', 'BC01-00000001').replace('</sac:SummaryDocumentsLine>', '<cac:Status><cbc:ConditionCode>3</cbc:ConditionCode></cac:Status></sac:SummaryDocumentsLine>');
 h.row.xml_hash = hashSummary(h.row.xml); return h;
}
it('solo un CDR aceptado anula y registra trabajo durable de reversión, sin envío individual', async () => {
 const h = cancelHarness(); const r = await h.store.finalizar(h.row as never, h.cdr(), '0');
 expect(h.db.invoice.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ estado: { in: ['ACEPTADO', 'OBSERVADO'] } }), data: { estado: 'ANULADO' } }));
 expect(r.result).toMatchObject({ bridgeReversals: [{ invoiceId: 'invoice', status: 'PENDING' }] });
 expect(h.db.transactionHistory.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ codigo_error: 'M1_RC_REVERSAL_PENDING' }) }));
 expect(h.queue.enqueueInvoiceInTx).not.toHaveBeenCalled();
});
it('un CDR rechazado o snapshot distinto no anula el documento', async () => {
 const h = cancelHarness(); await h.store.finalizar(h.row as never, h.cdr('2335'), '0');
 expect(h.db.invoice.updateMany).not.toHaveBeenCalled();
 h.row.xml = h.row.xml.replace('<cbc:ConditionCode>3', '<cbc:ConditionCode>1'); h.row.xml_hash = hashSummary(h.row.xml);
 await expect(h.store.finalizar(h.row as never, h.cdr(), '0')).rejects.toThrow('MEMBER_MISMATCH');
});
it('el XML de anulación firmado supera la hoja oficial sin transporte', async () => {
 const cert = fakeIssuerCertificate(); const signer = new SignatureService({ getCertificate: () => ({ certificatePem: cert.pem, privateKeyPem: cert.privateKeyPem }) } as never);
 expect(await ejecutarSfs(signer.signXml(construirResumenDiario(cabecera, [doc()])).signedXml, 'RC')).toEqual({ completado: true, errores: [] });
});

it('preparación RC exige confirmación de no otorgamiento antes de reservar', async () => {
 const { SummaryEnvioService } = await import('../../../src/modules/invoices/application/services/summaryEnvioService');
 const reservar = jest.fn();
 const service = new SummaryEnvioService({} as never, {} as never, {} as never, {} as never, { reservar } as never, {} as never);
 await expect(service.enviarAnulacionNotas('c', '2026-11-14', [{ id: 'i', motivo: 'Error' }], false)).rejects.toThrow('no fueron otorgadas');
 expect(reservar).not.toHaveBeenCalled();
});
it('primer despacho de RC rechaza una anulación vencida, sin afectar la consulta con ticket', async () => {
 const { summaryDispatchHarness } = await import('../../fixtures/summaryDispatchHarness');
 const { validarPlazoDespachoRa } = await import('../../../src/modules/invoices/application/services/summaryDispatchDeadline');
 const h = summaryDispatchHarness(); h.row.members = [{ id: 'i', conditionCode: '3', noOtorgado: true, acceptedDate: '2020-01-01' }] as never;
 const db = { invoice: { findMany: jest.fn(async () => [{ id: 'i', tipo_comprobante: '07', serie: 'BC01', estado: 'ACEPTADO', fecha_emision: new Date('2020-01-01'), referenced_series_correlative: 'B001-1' }]) } };
 Object.assign(h.store, { validarPlazoDespacho: (row: never) => validarPlazoDespachoRa(db as never, row) });
 expect(await h.service.procesar(h.job)).toMatchObject({ enviado: false, status: 'BLOQUEADO' });
 expect(h.client.sendSummary).not.toHaveBeenCalled();
});

it('reversión RC durable invierte movimientos y asientos una vez sin transporte', async () => {
 const { RaBridgeReversalService, raReversalWork } = await import('../../../src/modules/invoices/application/services/raBridgeReversalService');
 const { GenerateAccountingEntryUseCase } = await import('../../../src/modules/accounting/application/use-cases/generateAccountingEntryUseCase');
 const { Prisma } = await import('../../../src/generated/client/client');
 const execute = jest.spyOn(GenerateAccountingEntryUseCase.prototype, 'execute').mockResolvedValue({ id: 'reversion' } as never);
 const work = raReversalWork(['nota']);
 const row = { id: 'a', kind: 'RC', state: 'ACCEPTED', company_id: 'c', generation_date: '2026-11-14', identifier: 'RC-1', members: [{ conditionCode: '3', noOtorgado: true }], result: { bridgeReversals: work } };
 const manualExecute = jest.fn(async () => ({ totalCost: 20 }));
 const db: any = { $executeRaw: jest.fn(), invoiceAggregate: { findUniqueOrThrow: jest.fn(async () => row), update: jest.fn(async ({data}) => Object.assign(row, data)) },
  invoice: { findFirstOrThrow: jest.fn(async () => ({ id: 'nota', tipo_comprobante: '07', serie: 'BC01', correlativo: 1 })) },
  inventoryMovement: { findMany: jest.fn(async () => [{ id: 'm', direction: 'ENTRADA', quantity: new Prisma.Decimal(2), total_cost: new Prisma.Decimal(20), warehouse: { warehouse_code: 'ALM' }, product: { sku: 'P' } }]), findFirst: jest.fn(async () => null) },
  accountingEntry: { findMany: jest.fn(async () => [{ id: 'entry', journal_code: '05', lines: [{ line_order: 1, account_code: '12', account_name: 'Cuenta', debit_amount: 0, credit_amount: 20 }] }]) }, transactionHistory: { create: jest.fn() } };
 db.$transaction = jest.fn(async f => f(db));
 const service = new RaBridgeReversalService(db, { enTransaccion: () => ({ execute: manualExecute }) } as never);
 try {
  expect(await service.procesar('a', 'nota')).toBe(true);
  expect(manualExecute).toHaveBeenCalledWith(expect.objectContaining({ direction: 'SALIDA', quantity: 2, unit_cost: 10 }), 'c');
  expect(execute).toHaveBeenCalledWith(expect.objectContaining({ lines: [{ lineOrder: 1, accountCode: '12', accountName: 'Cuenta', debitAmount: 20, creditAmount: 0 }] }));
  expect(db.transactionHistory.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ codigo_error: 'M1_RC_REVERSAL_DONE' }) }));
  expect(await service.procesar('a', 'nota')).toBe(true);
  expect(manualExecute).toHaveBeenCalledTimes(1); expect(execute).toHaveBeenCalledTimes(1);
 } finally { execute.mockRestore(); }
});
