import { decidirEnvio, ErrorValidacionBloqueada } from '../../../src/modules/invoices/application/services/invoiceSendGate';
import { InvoiceJobConsumer } from '../../../src/modules/invoices/invoiceJobConsumer';
const params = (context?: any) => ({ invoiceId: 'i', rucEmisor: '20100070970', tipoComprobante: '01', serie: 'F001', correlativo: 1, zip: Buffer.from('test'), context });
const missing = { valido: false, bloqueado: false, errores: [], validadoDeVerdad: false, causaNoConcluyente: 'DEPENDENCIA_VALIDATE_UTILS_AUSENTE' };
afterEach(() => { delete process.env.BYPASS_XSL_GATE_DEMO; });
it.each([undefined, { environment: 'BETA', endpoint: 'https://e-beta.sunat.gob.pe/billService' },
  { environment: 'PRODUCCION', endpoint: 'https://e-factura.sunat.gob.pe/billService' },
  { environment: 'MOCK', endpoint: 'https://e-beta.sunat.gob.pe/billService' },
  { environment: 'MOCK', endpoint: 'bad url' }, { environment: 'MOCK' }])(
  'ni bypass ni XSL inconclusa permiten envío externo: %j', async (context) => {
    const validate = { validar: jest.fn(async () => missing) };
    await expect(decidirEnvio(params(context) as never, '<Invoice/>', validate as never, {} as never)).rejects.toThrow(ErrorValidacionBloqueada);
    process.env.BYPASS_XSL_GATE_DEMO = 'true';
    await expect(decidirEnvio(params(context) as never, '<Invoice/>', validate as never, {} as never)).rejects.toThrow('mock local');
  },
);
function consumer(signature: any, hash: string | null = 'hash') {
  return new InvoiceJobConsumer({} as never, {} as never, {} as never, {} as never, {} as never,
    signature, {} as never, {} as never, {} as never, { guardar: jest.fn(async () => hash) } as never);
}
it('rechaza firma guardada manipulada', () => {
  const c = consumer({ verifySignature: jest.fn(() => false) });
  expect(() => (c as any).firmar({}, '<Invoice><ds:Signature/></Invoice>')).toThrow('guardada inválida');
});
it('rechaza ausencia de certificado y firma generada inválida', () => {
  const c = consumer({ verifySignature: jest.fn(() => false), signXml: jest.fn(() => ({ signedXml: '<Invoice/>' })) });
  expect(() => (c as any).firmar({}, '<Invoice/>', { certificate: null })).toThrow('Certificado no configurado');
  expect(() => (c as any).firmar({}, '<Invoice/>', { certificate: {} })).toThrow('generada inválida');
});
it('si no se guarda el XML, no se llega a la compuerta ni al transporte', async () => {
  const c = consumer({ verifySignature: jest.fn(() => true) }, null);
  jest.spyOn(c as any, 'cargar').mockResolvedValue({ ...params(), id: 'i', tipo_comprobante: '01', ruc_emisor: '20100070970', estado: 'EN_COLA', xml_storage_url: '<?xml version="1.0"?><Invoice><ds:Signature/></Invoice>' });
  await expect(c.preparar('i')).rejects.toThrow('No se pudo persistir');
});
