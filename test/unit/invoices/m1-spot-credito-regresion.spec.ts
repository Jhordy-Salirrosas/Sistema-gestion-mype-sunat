import { traducirEmision } from '../../../src/modules/invoices/application/services/emitirComprobanteAdapter';
import { UblGeneratorService } from '../../../src/modules/invoices/ublGeneratorService';
import { SignatureService } from '../../../src/modules/sunat/signature.service';
import { fakeIssuerCertificate } from '../../fixtures/fakeIssuerCertificate';
import { ejecutarSfs } from '../../../src/modules/invoices/application/services/sunatSfsRunner';
import type { EmitirComprobanteDto } from '../../../src/modules/invoices/application/dto/emitirComprobanteDto';
const issuer = { ruc: '20000000001', razonSocial: 'Obviously Fake Issuer', codigoLocalAnexo: '0000', direccion: 'Domicilio ficticio 123', ubigeo: '150101', departamento: 'LIMA', provincia: 'LIMA', distrito: 'LIMA' };
function datos(total: number, cuota: number, retencion = false): EmitirComprobanteDto {
 return { tipo_comprobante: '01', serie: 'F001', fecha_emision: '2026-11-11', forma_pago: 'Credito', customer_identity_type: '6', customer_identity_number: '20100070970', customer_legal_name: 'Cliente prueba', medio_pago_detraccion: '001', cuenta_banco_nacion: '00019123456', agente_retencion: retencion, cuotas: [{ monto: cuota, vencimiento: '2026-12-11' }], items: [{ codigo: 'ARE', descripcion: 'Arena', cantidad: 1, precioUnitario: total, unidad: 'MTQ', afectacion: '10', codigoDetraccion: '009' }] };
}
it.each([[1180, 1062, false], [730.17, 657.15, false], [1180, 1026.6, true]] as const)('SPOT crédito total %s cuotas %s retención %s', async (total, cuota, retencion) => {
 const payload = traducirEmision(datos(total, cuota, retencion), issuer, 1).dto.payload_ubl;
 const xml = new UblGeneratorService().generateInvoiceXml(payload as never);
 expect(xml).toContain(`<cbc:PayableAmount currencyID="PEN">${total.toFixed(2)}</cbc:PayableAmount>`);
 const terminos = xml.match(/<cac:PaymentTerms>[\s\S]*?<\/cac:PaymentTerms>/g)!.filter(t => t.includes('FormaPago'));
 expect(terminos).toHaveLength(2);
 for (const termino of terminos) expect(termino).toContain(`<cbc:Amount currencyID="PEN">${cuota.toFixed(2)}</cbc:Amount>`);
 if (!retencion) {
  const fake = fakeIssuerCertificate();
  const signed = new SignatureService({ getCertificate: () => ({ certificatePem: fake.pem, privateKeyPem: fake.privateKeyPem }) } as never).signXml(xml).signedXml;
  expect(await ejecutarSfs(signed, '01')).toEqual({ completado: true, errores: [] });
 }
});
it.each([[1180, 1180], [730.17, 657.17]])('rechaza cuotas %s / %s sin deducción exacta de detracción', (total, cuota) => {
 const p = traducirEmision(datos(total, cuota), issuer, 1).dto.payload_ubl;
 expect(() => new UblGeneratorService().generateInvoiceXml(p as never)).toThrow('El cronograma no cuadra');
});
