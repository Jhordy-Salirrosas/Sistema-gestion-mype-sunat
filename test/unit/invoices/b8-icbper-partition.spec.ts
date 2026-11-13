import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { UblGeneratorService } from '../../../src/modules/invoices/ublGeneratorService';
import { XsdValidatorService } from '../../../src/modules/invoices/xsdValidatorService';
import { InvoiceJobConsumer } from '../../../src/modules/invoices/invoiceJobConsumer';
import { InvoiceDownloadService } from '../../../src/modules/invoices/application/services/invoiceDownloadService';
import { traducirEmision } from '../../../src/modules/invoices/application/services/emitirComprobanteAdapter';
import { separarBolsasGratuitas } from '../../../src/modules/invoices/freeBagXml';
import { referenciaGratuita, totalesGratuitos } from '../../../src/modules/invoices/freeOperationReference';
import { SignatureService } from '../../../src/modules/sunat/signature.service';
import { ejecutarSfs } from '../../../src/modules/invoices/application/services/sunatSfsRunner';
import { fakeIssuerCertificate } from '../../fixtures/fakeIssuerCertificate';
import { fiscal8d, issuer8d } from '../../fixtures/8dFiscalHarness';
import hashes from '../../fixtures/b8-unchanged-xml-hashes.json';
const generator=new UblGeneratorService();
function workerXml(payload:object):string {
 const worker=Object.create(InvoiceJobConsumer.prototype);
 worker.ublGenerator=generator;worker.xsdValidator=new XsdValidatorService();
 return worker.xmlDelComprobante({id:'b8-local',payload_ubl:payload});
}
function firmante(){
 const cert=fakeIssuerCertificate();return new SignatureService({getCertificate:()=>({certificatePem:cert.pem,privateKeyPem:cert.privateKeyPem})} as never);
}
function entrada(cantidades:number[],bolsas:number[],afectacion='21',referencia=35){
 return {tipo_comprobante:'01',serie:'F001',fecha_emision:'2026-11-12',forma_pago:'Contado',customer_identity_type:'6',customer_identity_number:'20100070970',customer_legal_name:'Cliente ficticio',items:cantidades.map((cantidad,i)=>({codigo:`MAT-${i}`,descripcion:`Bien gratuito ${i}`,unidad:'NIU',cantidad,precioUnitario:0,valorUnitario:referencia,afectacion,cantidadBolsas:bolsas[i],icbper:bolsas[i]*.5}))};
}
// Se extrae el predicado de contraste de los assets: no se altera el SFS ni se duplica una regla permisiva.
function comprobarPredicados(xml:string){
 const script=`import sys,json
from lxml import etree
ns={'xsl':'http://www.w3.org/1999/XSL/Transform','cac':'urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2','cbc':'urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2'}
x=etree.parse('assets/sunat-sfs/commons/xsl/validation/2.X/ValidaExprRegBoleta-2.0.1.xsl')
expr=x.xpath('//xsl:call-template[xsl:with-param[@name="errorCodeValidate" and @select=$code]]/xsl:with-param[@name="expresion"]/@select',namespaces=ns,code="'3105'")[0]
doc=etree.fromstring(sys.stdin.buffer.read())
lines=doc.findall('cac:InvoiceLine',ns)
print(json.dumps({'3105':[l.find('cac:TaxTotal',ns).xpath(expr,namespaces=ns) for l in lines], '3236':[s.xpath('number(cbc:BaseUnitMeasure) != round(number(../../cbc:InvoicedQuantity))',namespaces=ns) for l in lines for s in l.xpath('cac:TaxTotal/cac:TaxSubtotal[cac:TaxCategory/cac:TaxScheme/cbc:ID="7152"]',namespaces=ns)]}))`;
 const r=spawnSync('python3',['-c',script],{input:xml,encoding:'utf8'});expect(r.status).toBe(0);
 const result=JSON.parse(r.stdout);expect(result['3105']).not.toContain(true);expect(result['3236']).not.toContain(true);
}
it.each([
 ['a',[1],[1],1],['b',[2],[1],2],['c',[3,4],[1,2],4],['sin bolsas en una línea',[2,3],[0,1],3],['cantidad fraccionaria',[2.5],[1],2],
] as const)('%s: formulario → payload persistible → worker → firma → SFS',async(_name,cantidades,bolsas,lineas)=>{
 const dto=entrada([...cantidades],[...bolsas]);const before=JSON.stringify(dto);
 const translated=traducirEmision(dto as never,issuer8d,1);const payload=translated.dto.payload_ubl;
 const persisted=JSON.stringify(payload);const xml=workerXml(payload);
 expect(xml.match(/<cac:InvoiceLine>/g)).toHaveLength(lineas);
 expect(xml).not.toContain('BOLSA PLASTICA');expect(xml).toContain(`<cbc:PayableAmount currencyID="PEN">${(bolsas.reduce((s,n)=>s+n,0)*.5).toFixed(2)}</cbc:PayableAmount>`);
 expect(xml).toContain(`<cbc:TaxInclusiveAmount currencyID="PEN">${Number(translated.dto.monto_total).toFixed(2)}</cbc:TaxInclusiveAmount>`);
 comprobarPredicados(xml);
 const signature=firmante();const signed=signature.signXml(xml).signedXml;
 expect(await ejecutarSfs(signed,'01')).toEqual({completado:true,errores:[]});
 const download=Object.create(InvoiceDownloadService.prototype);download.ublGenerator=generator;download.signature=signature;download.logger={warn:jest.fn()};
 expect(download.regenerarXmlFirmado({id:'b8-local',serie:'F001',correlativo:1,payload_ubl:payload})).toBe(signed);
 expect(JSON.stringify(payload)).toBe(persisted);expect(JSON.stringify(dto)).toBe(before);
 const original=(payload as any).lineas;expect(original.every((l:object)=>Object.getOwnPropertySymbols(l).length===0)).toBe(true);const expanded=separarBolsasGratuitas(payload as never).lineas!;
 expect(totalesGratuitos(expanded)).toEqual(totalesGratuitos(original));
 expect(expanded.map(l=>l.id)).toEqual(expanded.map((_,i)=>i+1));
});
it.each(hashes)('$name conserva representación previa salvo tasa inafecta SFS 2992',({aff,bags,mixed,hash})=>{
 const payload=fiscal8d(aff,bags,'01',mixed).payload;
 let xml = workerXml(payload);
 if (aff === '30') {
  // Única diferencia aprobada por S: Percent cero de la afectación 9998.
  const tasa = '\n          <cbc:Percent>0.00</cbc:Percent>';
  expect(xml.split(tasa)).toHaveLength(2); xml = xml.replace(tasa, '');
 }
 expect(createHash('sha256').update(xml).digest('hex')).toBe(hash);
});
it.each([['11',.335,3],['21',.335,3],['31',.335,3],['21',.335,2],['11',100.03,2]] as const)('partición %s con referencia %s y cantidad %s conserva los céntimos',async(aff,valor,cantidad)=>{
 const payload=traducirEmision(entrada([cantidad],[1],aff,valor) as never,issuer8d,1).dto.payload_ubl;
 const original=(payload as any).lineas;
 const expanded=separarBolsasGratuitas(payload as never).lineas!;
 expect(expanded.map(l=>l.valorUnitario)).toEqual([valor,valor]);
 expect(expanded.map(referenciaGratuita).reduce((s,r)=>s+r.base,0)).toBe(totalesGratuitos(original).gratuito);
 expect(totalesGratuitos(expanded)).toEqual(totalesGratuitos(original));const xml=workerXml(payload);comprobarPredicados(xml);
 expect(await ejecutarSfs(firmante().signXml(xml).signedXml,'01')).toEqual({completado:true,errores:[]});
});
it('payload legado infiere bolsas del impuesto y defensa de regeneración rechaza exceso',()=>{
 const payload=fiscal8d('31',1).payload;delete payload.lineas![0].cantidadBolsas;
 expect(separarBolsasGratuitas(payload).lineas).toHaveLength(2);
 payload.lineas![0].cantidad=1;expect(separarBolsasGratuitas(payload).lineas![0].cantidadBolsas).toBe(1);comprobarPredicados(workerXml(payload));
 payload.lineas![0].cantidad=.5;expect(()=>workerXml(payload)).toThrow('Las bolsas de una línea gratuita');
});
