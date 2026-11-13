import { createHash } from 'node:crypto';
import { UblGeneratorService } from '../../../src/modules/invoices/ublGeneratorService';
import { separarBolsasGratuitas } from '../../../src/modules/invoices/freeBagXml';
import { esDocumentoIntegramenteGratuito } from '../../../src/modules/invoices/freeInvoicePolicy';
import { fiscal8d } from '../../fixtures/8dFiscalHarness';
import hashes from '../../fixtures/p9-certified-xml-hashes.json';
import { fakeIssuerCertificate } from '../../fixtures/fakeIssuerCertificate';
import { SignatureService } from '../../../src/modules/sunat/signature.service';
import { ejecutarSfs } from '../../../src/modules/invoices/application/services/sunatSfsRunner';
const generator=new UblGeneratorService();
it.each(hashes)('estructura certificada $name permanece idéntica',({aff,mixed,hash})=>{
 const p=fiscal8d(aff,2,'01',mixed).payload;expect(separarBolsasGratuitas(p)).toBe(p);
 expect(createHash('sha256').update(generator.generateInvoiceXml(p)).digest('hex')).toBe(hash);
});
it.each([1,2])('gratuita de %s unidades con una bolsa conserva 0.50 y pasa SFS',async cantidad=>{
 const p=fiscal8d('11',1,'01').payload;p.lineas![0].cantidad=cantidad;
 const before=JSON.stringify(p);const expanded=separarBolsasGratuitas(p);
 expect(esDocumentoIntegramenteGratuito('01',expanded.lineas)).toBe(false);
 expect(expanded.lineas![0].icbperLinea).toBeUndefined();expect(expanded.lineas![1]).toMatchObject({cantidad:1,icbperLinea:.5});
 const xml=generator.generateInvoiceXml(p);expect(xml).toContain('<cbc:PayableAmount currencyID="PEN">0.50</cbc:PayableAmount>');
 expect(xml.match(/<cbc:ID>7152<\/cbc:ID>/g)).toHaveLength(2);
 const cert=fakeIssuerCertificate();const signed=new SignatureService({getCertificate:()=>({certificatePem:cert.pem,privateKeyPem:cert.privateKeyPem})} as never).signXml(xml).signedXml;
 expect(await ejecutarSfs(signed,'01')).toEqual({completado:true,errores:[]});expect(JSON.stringify(p)).toBe(before);
});
it('sin bolsas, sin líneas o con línea única conserva el tratamiento correcto',()=>{
 const p=fiscal8d('11',0,'01').payload;expect(separarBolsasGratuitas(p)).toBe(p);
 expect(separarBolsasGratuitas({tipoComprobante:'01'} as never)).toEqual({tipoComprobante:'01'});
 const single={...p,lineas:undefined,linea:{...p.lineas![0],icbperLinea:.5,cantidadBolsas:1}};
 expect(separarBolsasGratuitas(single).lineas).toHaveLength(2);
});
