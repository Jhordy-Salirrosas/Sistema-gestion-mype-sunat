import { traducirEmision } from '../../../src/modules/invoices/application/services/emitirComprobanteAdapter';
import { UblGeneratorService } from '../../../src/modules/invoices/ublGeneratorService';
import { ejecutarSfs } from '../../../src/modules/invoices/application/services/sunatSfsRunner';
import { SignatureService } from '../../../src/modules/sunat/signature.service';
import { fakeIssuerCertificate } from '../../fixtures/fakeIssuerCertificate';
import type { InvoicePayload } from '../../../src/modules/invoices/invoicePayload';
const issuer = { ruc: '20000000001', razonSocial: 'Obviously Fake Issuer', codigoLocalAnexo: '0001', direccion: 'Domicilio ficticio 123', ubigeo: '150101', departamento: 'LIMA', provincia: 'LIMA', distrito: 'LIMA' };
const dto = (afectacion: string, precioUnitario = 118) => ({ tipo_comprobante: '01' as const, serie: 'F001', fecha_emision: '2026-11-08', forma_pago: 'Contado' as const,
  customer_identity_type: '6', customer_identity_number: '20100070970', customer_legal_name: 'Cliente prueba',
  items: [{ codigo: 'REGALO', descripcion: 'Regalo prueba', unidad: 'NIU', cantidad: 2, afectacion, precioUnitario }] });
it.each(['11', '16', '21', '31', '37'])('gratuita %s conserva referencia y pasa SFS desde flujo común', async afectacion => {
  const translated = traducirEmision(dto(afectacion), issuer, 1);
  expect(translated.importes.total).toBe(0);
  const xml = new UblGeneratorService().generateInvoiceXml(translated.dto.payload_ubl as unknown as InvoicePayload);
  const unitario = ['11', '16'].includes(afectacion) ? '100.00' : '118.00';
  const base = ['11', '16'].includes(afectacion) ? '200.00' : '236.00';
  expect(xml).toContain(`<cbc:PriceAmount currencyID="PEN">${unitario}</cbc:PriceAmount>\n        <cbc:PriceTypeCode>02`);
  expect(xml).toContain(`<cbc:LineExtensionAmount currencyID="PEN">${base}</cbc:LineExtensionAmount>`);
  expect(xml).toContain('<cbc:ID>9996</cbc:ID>');
  expect(xml).toContain('<cbc:PayableAmount currencyID="PEN">0.00</cbc:PayableAmount>');
  const fake = fakeIssuerCertificate();
  const signed = new SignatureService({ getCertificate: () => ({ certificatePem: fake.pem, privateKeyPem: fake.privateKeyPem }) } as never).signXml(xml).signedXml;
  expect(await ejecutarSfs(signed, '01')).toEqual({ completado: true, errores: [] });
});
it('una gratuita exige valor referencial real positivo', () => {
  expect(() => traducirEmision(dto('11', 0), issuer, 1)).toThrow('referencial');
});
