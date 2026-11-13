import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { EmitirComprobanteDto } from '../../../src/modules/invoices/application/dto/emitirComprobanteDto';
import { traducirEmision } from '../../../src/modules/invoices/application/services/emitirComprobanteAdapter';
import { UblGeneratorService, type InvoicePayload } from '../../../src/modules/invoices/ublGeneratorService';
import { bloqueCliente } from '../../../src/modules/invoices/xmlPartiesHelper';
import { SignatureService } from '../../../src/modules/sunat/signature.service';
import { ejecutarSfs } from '../../../src/modules/invoices/application/services/sunatSfsRunner';
import { issuer8d } from '../../fixtures/8dFiscalHarness';
import { fakeIssuerCertificate } from '../../fixtures/fakeIssuerCertificate';
const form = { forma_pago: 'Contado', tipo_comprobante: '01', serie: 'F001', fecha_emision: '2026-11-13', customer_identity_type: '6', customer_identity_number: '20100070970', customer_legal_name: 'Receptor ficticio', items: [{ descripcion: 'Servicio ficticio', unidad: 'NIU', cantidad: 1, valorUnitario: 100, afectacion: '10' }] };
function traducir(extra: object) {
  return traducirEmision({ ...form, ...extra } as EmitirComprobanteDto, issuer8d, 1).dto.payload_ubl as unknown as InvoicePayload;
}
it.each([undefined, '', '  ', 'Av. Receptor & Cía 123'])('acepta dirección opcional %j bajo whitelist estricto', customer_address => {
  expect(validateSync(plainToInstance(EmitirComprobanteDto, { ...form, customer_address }), { whitelist: true, forbidNonWhitelisted: true })).toEqual([]);
});
it.each([42, 'A'.repeat(1501)])('rechaza dirección inválida sin relajar el DTO: %j', customer_address => {
  expect(validateSync(plainToInstance(EmitirComprobanteDto, { ...form, customer_address }), { whitelist: true, forbidNonWhitelisted: true }).map(e => e.property)).toContain('customer_address');
});
it.each([undefined, '', '  '])('sin dirección útil conserva exactamente el payload y XML previos: %j', customer_address => {
  expect(traducir({ customer_address })).toEqual(traducir({}));
  const cliente = traducir({ customer_address }).cliente!;
  expect(bloqueCliente(cliente)).not.toContain('RegistrationAddress');
});
it('conserva la edición del receptor en payload y XML, escapa texto y mantiene íntegro al emisor', async () => {
  const previo = traducir({}); const actual = traducir({ customer_address: '  Av. Receptor & <Local> 123  ' });
  expect(actual.cliente).toEqual({ ...previo.cliente, direccion: 'Av. Receptor & <Local> 123' });
  const sinCliente = ({ cliente: _cliente, ...rest }: InvoicePayload) => rest;
  expect(sinCliente(actual)).toEqual(sinCliente(previo));
  const generator = new UblGeneratorService(); const xml = generator.generateInvoiceXml(actual);
  const customer = xml.match(/<cac:AccountingCustomerParty>[\s\S]*?<\/cac:AccountingCustomerParty>/)![0];
  expect(customer).toContain('Av. Receptor &amp; &lt;Local&gt; 123');
  expect(xml.match(/<cac:AccountingSupplierParty>[\s\S]*?<\/cac:AccountingSupplierParty>/)![0]).toBe(generator.generateInvoiceXml(previo).match(/<cac:AccountingSupplierParty>[\s\S]*?<\/cac:AccountingSupplierParty>/)![0]);
  const cert = fakeIssuerCertificate();
  const signature = new SignatureService({ getCertificate: () => ({ certificatePem: cert.pem, privateKeyPem: cert.privateKeyPem }) } as never);
  expect(await ejecutarSfs(signature.signXml(xml).signedXml, '01')).toEqual({ completado: true, errores: [] });
});
