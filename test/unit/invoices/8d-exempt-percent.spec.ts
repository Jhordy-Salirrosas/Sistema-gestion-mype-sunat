import {fiscal8d} from '../../fixtures/8dFiscalHarness';
import {UblGeneratorService} from '../../../src/modules/invoices/ublGeneratorService';
import {SignatureService} from '../../../src/modules/sunat/signature.service';
import {fakeIssuerCertificate} from '../../fixtures/fakeIssuerCertificate';
import {ejecutarSfs} from '../../../src/modules/invoices/application/services/sunatSfsRunner';
const gen=new UblGeneratorService();const cert=fakeIssuerCertificate();const signer=new SignatureService({getCertificate:()=>({certificatePem:cert.pem,privateKeyPem:cert.privateKeyPem})} as never);
describe.each(['01','03','07','08'])('D3 exonerada onerosa %s',tipo=>{
 it.each([false,true])('Percent cero, categoría E y tributo 9997, mixta=%s',async mixta=>{
  const {payload,total}=fiscal8d('20',0,tipo,mixta);const xml=gen.generateInvoiceXml(payload);const line=xml.match(/<cac:(?:InvoiceLine|CreditNoteLine|DebitNoteLine)>[\s\S]*?<\/cac:(?:InvoiceLine|CreditNoteLine|DebitNoteLine)>/)![0];
  expect(line).toContain('<cbc:ID schemeID="UN/ECE 5305">E</cbc:ID>\n          <cbc:Percent>0.00</cbc:Percent>');expect(line).toContain('<cbc:TaxExemptionReasonCode>20</cbc:TaxExemptionReasonCode>');expect(line).toContain('<cbc:ID>9997</cbc:ID>');expect(total).toBe(mixta?436:200);
  expect(await ejecutarSfs(signer.signXml(xml).signedXml,tipo)).toEqual({completado:true,errores:[]});
 });
});
