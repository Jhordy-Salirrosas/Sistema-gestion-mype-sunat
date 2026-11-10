import { UblGeneratorService } from '../../../src/modules/invoices/ublGeneratorService';
import { traducirEmision } from '../../../src/modules/invoices/application/services/emitirComprobanteAdapter';
import { ejecutarSfs } from '../../../src/modules/invoices/application/services/sunatSfsRunner';
import { SignatureService } from '../../../src/modules/sunat/signature.service';
import { fakeIssuerCertificate } from '../../fixtures/fakeIssuerCertificate';
import type { InvoicePayload } from '../../../src/modules/invoices/invoicePayload';
const generator = new UblGeneratorService();
const issuer = { ruc: '20000000001', razonSocial: 'Obviously Fake Issuer', codigoLocalAnexo: '0000', direccion: 'Domicilio ficticio 123', ubigeo: '150101', departamento: 'LIMA', provincia: 'LIMA', distrito: 'LIMA' };
function payload(tipo: string, credito = false): InvoicePayload {
  const source = traducirEmision({ tipo_comprobante: tipo === '03' ? '03' : '01', serie: tipo === '03' ? 'B001' : 'F001', fecha_emision: '2026-11-09', forma_pago: credito ? 'Credito' : 'Contado',
    cuotas: credito ? [{ monto: 118, vencimiento: '2026-12-09' }] : undefined,
    customer_identity_type: tipo === '03' ? '1' : '6', customer_identity_number: tipo === '03' ? '70123456' : '20100070970', customer_legal_name: 'Cliente ficticio',
    items: [{ codigo: 'TEST001', descripcion: 'Producto ficticio', unidad: 'NIU', cantidad: 1, precioUnitario: 118, afectacion: '10' }],
  }, issuer, 1).dto.payload_ubl as unknown as InvoicePayload;
  return ['07','08'].includes(tipo) ? { ...source, tipoComprobante: tipo, serie: tipo === '07' ? 'FC01' : 'FD01', documentoAfectado: 'F001-00000001', codigoMotivoNota: '01', descripcionMotivoNota: tipo === '07' ? 'Anulación de la operación' : 'Intereses por mora' } : source;
}
function signed(xml: string) { const fake = fakeIssuerCertificate(); return new SignatureService({ getCertificate: () => ({ certificatePem: fake.pem, privateKeyPem: fake.privateKeyPem }) } as never).signXml(xml).signedXml; }
it.each([['01',false],['01',true],['03',false],['03',true],['07',false]] as const)('XML completo %s crédito=%s conserva bytes de dev previo a la corrección', (tipo,credito) => {
  expect(generator.generateInvoiceXml(payload(tipo,credito))).toMatchSnapshot();
});
it('SPOT completo y bloques de detracción conservan bytes de dev previo a la corrección', () => {
  const xml = generator.generateInvoiceXml({ ...payload('01'), tipoOperacion: '1001', codigoDetraccion: '012', cuentaBancoNacion: '00019123456', montoGravado: 1000, montoIgv: 180, montoTotal: 1180,
    lineas: [{ id: 1, codigo: 'TEST001', descripcion: 'Servicio ficticio de flete', unidad: 'NIU', cantidad: 1, valorUnitario: 1000, precioUnitario: 1180, afectacion: '10', totalLinea: 1180, igvLinea: 180 }] });
  expect(xml).toMatchSnapshot();
});
it('ND generada y firmada pasa XSD oficial 2.1 y hoja ND con el SFS real', async () => {
  const xml = generator.generateInvoiceXml(payload('08'));
  expect(xml).not.toContain('DebitNoteTypeCode'); expect(xml).not.toContain('LegalMonetaryTotal');
  expect(xml).toContain('<cac:RequestedMonetaryTotal>');
  expect(xml.indexOf('</cac:TaxTotal>')).toBeLessThan(xml.indexOf('<cac:RequestedMonetaryTotal>'));
  expect(xml.indexOf('</cac:RequestedMonetaryTotal>')).toBeLessThan(xml.indexOf('<cac:DebitNoteLine>'));
  const invoiceTotal = generator.generateInvoiceXml(payload('01')).match(/<cac:LegalMonetaryTotal>([\s\S]*?)<\/cac:LegalMonetaryTotal>/)?.[1];
  expect(xml.match(/<cac:RequestedMonetaryTotal>([\s\S]*?)<\/cac:RequestedMonetaryTotal>/)?.[1]).toBe(invoiceTotal);
  expect(await ejecutarSfs(signed(xml), '08')).toEqual({ completado: true, errores: [] });
});
it('reintroducir el nodo anterior reproduce XSD DebitNoteTypeCode sobre XML generado', async () => {
  const xml = generator.generateInvoiceXml(payload('08')).replace('</cbc:IssueDate>', '</cbc:IssueDate>\n  <cbc:DebitNoteTypeCode listID="0101">08</cbc:DebitNoteTypeCode>');
  expect(await ejecutarSfs(signed(xml), '08')).toMatchObject({ completado: true, errores: [{ codigo: 'XSD', mensaje: expect.stringContaining('DebitNoteTypeCode') }] });
});
it('reintroducir solo el total anterior reproduce el segundo error XSD', async () => {
  const xml = generator.generateInvoiceXml(payload('08')).replaceAll('RequestedMonetaryTotal', 'LegalMonetaryTotal');
  expect(await ejecutarSfs(signed(xml), '08')).toMatchObject({ completado: true, errores: [{ codigo: 'XSD', mensaje: expect.stringContaining('LegalMonetaryTotal') }] });
});
