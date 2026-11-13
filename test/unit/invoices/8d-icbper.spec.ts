import { createHash } from 'node:crypto';
import { UblGeneratorService } from '../../../src/modules/invoices/ublGeneratorService';
import { fiscal8d } from '../../fixtures/8dFiscalHarness';
import hashes from '../../fixtures/8d-no-icbper-hashes.json';
import { SignatureService } from '../../../src/modules/sunat/signature.service';
import { fakeIssuerCertificate } from '../../fixtures/fakeIssuerCertificate';
import { ejecutarSfs } from '../../../src/modules/invoices/application/services/sunatSfsRunner';
const gen=new UblGeneratorService();
it.each(hashes)('D2 conserva XML sin ICBPER salvo tasa inafecta SFS 2992: $tipo/$aff',({tipo,aff,hash})=>{
 let xml=gen.generateInvoiceXml(fiscal8d(aff,0,tipo).payload);
 if(['01','03'].includes(tipo)&&aff==='30') {
  const tasa='\n          <cbc:Percent>0.00</cbc:Percent>';
  expect(xml.split(tasa)).toHaveLength(2);xml=xml.replace(tasa,'');
 }
 expect(createHash('sha256').update(xml).digest('hex')).toBe(hash);
});
describe.each(['01','03'])('D2 paridad ICBPER y SFS %s',tipo=>{
 const cert=fakeIssuerCertificate();const signer=new SignatureService({getCertificate:()=>({certificatePem:cert.pem,privateKeyPem:cert.privateKeyPem})} as never);
 it.each(['10','11','21','31'])('dos bolsas en %s: un solo TaxTotal y total consistente',async aff=>{
  const {payload,total}=fiscal8d(aff,2,tipo);const xml=gen.generateInvoiceXml(payload);
  expect(total).toBe(aff==='10'?237:1);expect(xml).toContain(`<cbc:PayableAmount currencyID="PEN">${total.toFixed(2)}</cbc:PayableAmount>`);
  const header=xml.split('<cac:InvoiceLine>')[0];expect(header.match(/<cac:TaxTotal>/g)).toHaveLength(1);expect(header).toContain('<cbc:ID>7152</cbc:ID>');expect(header).toContain('<cbc:TaxAmount currencyID="PEN">1.00</cbc:TaxAmount>');
  expect(await ejecutarSfs(signer.signXml(xml).signedXml,tipo)).toEqual({completado:true,errores:[]});
 });
});
it('mezcla gratuita/onerosa no cobra referencia ni IGV gratuito y suma las bolsas',()=>{const {payload,total}=fiscal8d('11',2,'01',true);expect(total).toBe(237);expect(gen.generateInvoiceXml(payload)).toContain('<cbc:PayableAmount currencyID="PEN">237.00</cbc:PayableAmount>');});
