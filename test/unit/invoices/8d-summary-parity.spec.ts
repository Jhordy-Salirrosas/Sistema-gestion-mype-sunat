import {fiscal8d} from '../../fixtures/8dFiscalHarness';
import {fiscalResumen} from '../../../src/modules/invoices/application/services/summaryFiscal';
import {construirResumenDiario} from '../../../src/modules/invoices/application/services/summaryDocumentsBuilder';
import {UblGeneratorService} from '../../../src/modules/invoices/ublGeneratorService';
import {SignatureService} from '../../../src/modules/sunat/signature.service';
import {fakeIssuerCertificate} from '../../fixtures/fakeIssuerCertificate';
import {ejecutarSfs} from '../../../src/modules/invoices/application/services/sunatSfsRunner';
const cases = ['11','21','31'].flatMap(aff=>[false,true].flatMap(mixto=>[0,2].map(bolsas=>({aff,mixto,bolsas})))).concat([0,2].map(bolsas=>({aff:'10',mixto:false,bolsas})));
const cert=fakeIssuerCertificate();const signer=new SignatureService({getCertificate:()=>({certificatePem:cert.pem,privateKeyPem:cert.privateKeyPem})} as never);
function subtotales(xml: string) {return [...xml.matchAll(/<cac:TaxSubtotal>[\s\S]*?<\/cac:TaxSubtotal>/g)].map(([s])=>({codigo:s.match(/<cac:TaxScheme>\s*<cbc:ID>([^<]+)/)![1],impuesto:Number(s.match(/<cbc:TaxAmount[^>]*>([^<]+)/)![1]),base:Number(s.match(/<cbc:TaxableAmount[^>]*>([^<]+)/)?.[1]??0)}));}
it.each(cases)('D4 paridad boleta/RC $aff, mixta=$mixto, bolsas=$bolsas',async({aff,mixto,bolsas})=>{
 const {payload,total}=fiscal8d(aff,bolsas,'03',mixto);const before=JSON.stringify(payload);const invoice=new UblGeneratorService().generateInvoiceXml(payload);const fiscal=fiscalResumen(payload,total);
 const rc=construirResumenDiario({rucEmisor:'20000000001',razonSocialEmisor:'Emisor ficticio',correlativo:1,fechaResumen:'2026-11-12',fechaGeneracion:'2026-11-12'},[{tipoComprobante:'03',serie:'B001',correlativo:1,fechaEmision:'2026-11-12',estado:'EN_COLA',total,tipoDocCliente:'6',numDocCliente:'20100070970',igv:payload.montoIgv??0,fiscal}]);
 const header=invoice.split('<cac:InvoiceLine>')[0];const taxes=subtotales(header);const rcTaxes=subtotales(rc);
 for(const tax of taxes){expect(fiscal.tributos.find(t=>t.codigo===tax.codigo)).toMatchObject(tax);expect(rcTaxes.find(t=>t.codigo===tax.codigo)?.impuesto).toBe(tax.impuesto);}
 if(aff!=='10'){expect(rc).toContain('<sac:BillingPayment><cbc:PaidAmount currencyID="PEN">200.00</cbc:PaidAmount><cbc:InstructionID>05</cbc:InstructionID></sac:BillingPayment>');expect(fiscal.pagos.find(p=>p.codigo==='05')?.monto).toBe(200);expect(taxes.find(t=>t.codigo==='9996')).toMatchObject({base:200,impuesto:aff==='11'?36:0});}
 expect(fiscal.tributos.find(t=>t.codigo==='7152')?.impuesto??0).toBe(bolsas*.5);
 expect(rc).toContain(`<sac:TotalAmount currencyID="PEN">${total.toFixed(2)}</sac:TotalAmount>`);expect(invoice).toContain(`<cbc:PayableAmount currencyID="PEN">${total.toFixed(2)}</cbc:PayableAmount>`);expect(JSON.stringify(payload)).toBe(before);
 // RC conserva su estructura por tributo; no recibe el cambio de TaxTotal de Invoice.
 expect(rc.match(/<cac:TaxTotal>/g)).toHaveLength(fiscal.tributos.length);
 for(const [xml,tipo] of [[invoice,'03'],[rc,'RC']])expect(await ejecutarSfs(signer.signXml(xml).signedXml,tipo)).toEqual({completado:true,errores:[]});
});
it('RC rechaza un total persistido discordante y no oculta la pérdida del ICBPER',()=>{const {payload,total}=fiscal8d('11',2,'03');expect(()=>fiscalResumen(payload,total-1)).toThrow('no concuerda');});
