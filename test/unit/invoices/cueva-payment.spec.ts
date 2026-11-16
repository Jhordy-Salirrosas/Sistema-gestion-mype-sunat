import { invoicePaymentAccount } from '../../../src/modules/invoices/application/services/invoicePaymentAccount';
import { InvoiceCommercialDefaultsService } from '../../../src/modules/invoices/application/services/invoiceCommercialDefaultsService';
import { fiscalToEmission } from '../../../src/modules/invoices/application/services/creationGuards';
const rules = [{ line_order: 1, account_code: '1041' }];
test.each(['YAPE','PLIN','TARJETA','TRANSFERENCIA','DEPOSITO','CHEQUE'])('%s usa COBRO bancario de la empresa', medio => {
  expect(invoicePaymentAccount('Contado', medio, rules, [])).toEqual({ codigo: '1041', nombre: `Cobro ${medio}` });
});
test('efectivo usa la misma caja PCGE de cobranzas y respeta el mapeo explícito', () => {
  expect(invoicePaymentAccount('Contado','EFECTIVO',rules,[])?.codigo).toBe('1011');
  expect(invoicePaymentAccount('Contado','YAPE',rules,[{ role_code: 'COBRO_YAPE', account_code: '10411' }])?.codigo).toBe('10411');
});
test('crédito y documentos sin medio conservan CXC; sin mapeo bancario no se presume una cuenta', () => {
  expect(invoicePaymentAccount('Credito','YAPE',rules,[])).toBeUndefined();
  expect(invoicePaymentAccount('Contado',undefined,rules,[])).toBeUndefined();
  expect(() => invoicePaymentAccount('Contado','TARJETA',[],[])).toThrow('Configure');
  expect(() => invoicePaymentAccount('Contado','YAPE',[],[{role_code:'COBRO_YAPE',account_code:'12121'}])).toThrow('Configure');
});
test('la entrada fiscal conserva medioPago al convertirse en emisión', () => {
  expect(fiscalToEmission({ tipo_comprobante:'01',serie:'F001',fecha_emision:'2026-11-16',ruc_emisor:'20000000001',payload_ubl:{ tipoComprobante:'01',serie:'F001',fechaEmision:'2026-11-16',rucEmisor:'20000000001',tipoMoneda:'PEN',formaPago:'Contado',medioPago:'YAPE',lineas:[{codigo:'SKU',cantidad:1,valorUnitario:100,afectacion:'10',unidad:'NIU'}] } } as never).medio_pago).toBe('YAPE');
});
test('configuración global valida catálogo y devuelve Contado sin fila', async () => {
  const db = { $queryRaw: jest.fn().mockResolvedValue([]), $executeRaw: jest.fn() };
  const svc = new InvoiceCommercialDefaultsService(db as never);
  expect(await svc.get('company')).toEqual({ forma_pago:'Contado',medio_pago:'EFECTIVO' });
  await expect(svc.save('company',{ forma_pago:'Crédito',medio_pago:'EFECTIVO' })).rejects.toThrow();
  expect(db.$executeRaw).not.toHaveBeenCalled();
});
