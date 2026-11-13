import {fiscal8d} from '../../fixtures/8dFiscalHarness';
import {UblGeneratorService} from '../../../src/modules/invoices/ublGeneratorService';
import {SignatureService} from '../../../src/modules/sunat/signature.service';
import {fakeIssuerCertificate} from '../../fixtures/fakeIssuerCertificate';
import {ejecutarSfs} from '../../../src/modules/invoices/application/services/sunatSfsRunner';
it.each([0,1])('ND inafecta bolsas=%s declara tasa cero y supera la hoja oficial sin 2992',async bolsas=>{
 const p=fiscal8d('30',bolsas,'08').payload;const xml=new UblGeneratorService().generateInvoiceXml(p);
 expect(xml).toContain('<cbc:Percent>0.00</cbc:Percent>');expect(xml).toContain('<cbc:TaxExemptionReasonCode>30</cbc:TaxExemptionReasonCode>');expect(xml).toContain('<cbc:ID>9998</cbc:ID>');
 const cert=fakeIssuerCertificate();const signer=new SignatureService({getCertificate:()=>({certificatePem:cert.pem,privateKeyPem:cert.privateKeyPem})} as never);
 expect(await ejecutarSfs(signer.signXml(xml).signedXml,'08')).toEqual({completado:true,errores:[]});
});
it('la factura inafecta conserva su representación previa sin Percent',()=>{
 const xml=new UblGeneratorService().generateInvoiceXml(fiscal8d('30',1,'01').payload);expect(xml).not.toContain('<cbc:Percent>0.00</cbc:Percent>');
});
