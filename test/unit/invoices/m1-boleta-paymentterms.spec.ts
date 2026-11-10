import { traducirEmision } from '../../../src/modules/invoices/application/services/emitirComprobanteAdapter';
import { UblGeneratorService } from '../../../src/modules/invoices/ublGeneratorService';
import { ejecutarSfs } from '../../../src/modules/invoices/application/services/sunatSfsRunner';
import { SignatureService } from '../../../src/modules/sunat/signature.service';
import { fakeIssuerCertificate } from '../../fixtures/fakeIssuerCertificate';
import type { InvoicePayload } from '../../../src/modules/invoices/invoicePayload';

const generator = new UblGeneratorService();
const issuer = { ruc: '20000000001', razonSocial: 'Obviously Fake Issuer', codigoLocalAnexo: '0000', direccion: 'Domicilio ficticio 123', ubigeo: '150101', departamento: 'LIMA', provincia: 'LIMA', distrito: 'LIMA' };
function payload(tipo: '01' | '03', credito = false): InvoicePayload {
  return traducirEmision({ tipo_comprobante: tipo, serie: tipo === '01' ? 'F001' : 'B001', fecha_emision: '2026-11-09', forma_pago: credito ? 'Credito' : 'Contado',
    cuotas: credito ? [{ monto: 17.7, vencimiento: '2026-12-09' }] : undefined,
    customer_identity_type: tipo === '01' ? '6' : '1', customer_identity_number: tipo === '01' ? '20100070970' : '70123456', customer_legal_name: 'Cliente prueba',
    items: [{ codigo: 'CEM-001', descripcion: 'Producto de prueba', unidad: 'NIU', cantidad: 1, precioUnitario: 17.7, afectacion: '10' }],
  }, issuer, 5).dto.payload_ubl as unknown as InvoicePayload;
}
const terms = (xml: string) => xml.match(/  <cac:PaymentTerms>[\s\S]*?<\/cac:PaymentTerms>/g) ?? [];
it.each([false, true])('factura crédito=%s conserva FormaPago idéntico a la base', credito => {
  const xml = generator.generateInvoiceXml(payload('01', credito));
  expect(terms(xml)).toMatchSnapshot();
});
it.each([false, true])('boleta crédito=%s no declara FormaPago ni sus cuotas', credito => {
  const xml = generator.generateInvoiceXml(payload('03', credito));
  expect(xml).not.toContain('FormaPago'); expect(xml).not.toContain('<cbc:PaymentMeansID>');
});
it.each(['07', '08'])('nota %s conserva su comportamiento sin FormaPago', tipo => {
  const xml = generator.generateInvoiceXml({ ...payload('01'), tipoComprobante: tipo, serie: tipo === '07' ? 'FC01' : 'FD01', documentoAfectado: 'F001-00000001', codigoMotivoNota: '01', descripcionMotivoNota: 'Motivo de prueba' });
  expect(xml).not.toContain('FormaPago');
});
function spot(): InvoicePayload {
  return { ...payload('01'), tipoOperacion: '1001', codigoDetraccion: '012', cuentaBancoNacion: '00019123456',
    montoGravado: 1000, montoIgv: 180, montoTotal: 1180,
    lineas: [{ id: 1, codigo: 'TEST', descripcion: 'Servicio de flete', unidad: 'NIU', cantidad: 1, valorUnitario: 1000, precioUnitario: 1180, afectacion: '10', totalLinea: 1180, igvLinea: 180 }] };
}
it('SPOT conserva byte a byte PaymentMeans y PaymentTerms de detracción de la base', () => {
  const xml = generator.generateInvoiceXml(spot());
  expect({ medio: xml.match(/  <cac:PaymentMeans>[\s\S]*?<\/cac:PaymentMeans>/)?.[0], detraccion: terms(xml).find(t => t.includes('<cbc:ID>Detraccion</cbc:ID>')) }).toMatchSnapshot();
});
it('mantiene la guarda existente que rechaza boleta con SPOT', () => {
  expect(() => generator.generateInvoiceXml({ ...spot(), tipoComprobante: '03', serie: 'B001' })).toThrow(/solo se aplica a Facturas/);
});
it('boleta contado S/17.70 del flujo común → generador → firma ficticia pasa SFS real sin 3128', async () => {
  const xml = generator.generateInvoiceXml(payload('03'));
  const fake = fakeIssuerCertificate();
  const signed = new SignatureService({ getCertificate: () => ({ certificatePem: fake.pem, privateKeyPem: fake.privateKeyPem }) } as never).signXml(xml).signedXml;
  expect(await ejecutarSfs(signed, '03')).toEqual({ completado: true, errores: [] });
});

it('6D: Arena MTQ del generador conserva unidad y valida con SFS oficial', async () => {
  const p = payload('01'); p.lineas![0].unidad = 'MTQ';
  const xml = generator.generateInvoiceXml(p);
  expect(xml).toContain('unitCode="MTQ"');
  const fake = fakeIssuerCertificate();
  const signed = new SignatureService({ getCertificate: () => ({ certificatePem: fake.pem, privateKeyPem: fake.privateKeyPem }) } as never).signXml(xml).signedXml;
  expect(await ejecutarSfs(signed, '01')).toEqual({ completado: true, errores: [] });
});
