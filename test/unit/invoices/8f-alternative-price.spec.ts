import { createHash } from 'node:crypto';
import { traducirEmision } from '../../../src/modules/invoices/application/services/emitirComprobanteAdapter';
import { UblGeneratorService } from '../../../src/modules/invoices/ublGeneratorService';
import { issuer8d } from '../../fixtures/8dFiscalHarness';
import { SignatureService } from '../../../src/modules/sunat/signature.service';
import { fakeIssuerCertificate } from '../../fixtures/fakeIssuerCertificate';
import { ejecutarSfs } from '../../../src/modules/invoices/application/services/sunatSfsRunner';
const gen=new UblGeneratorService(),cert=fakeIssuerCertificate();
const signer=new SignatureService({getCertificate:()=>({certificatePem:cert.pem,privateKeyPem:cert.privateKeyPem})} as never);
function payload(tipo:string,variant:string,cantidad:number,monto=cantidad===7?1:3.5){
 const d={tipo_comprobante:tipo,serie:tipo==='03'?'B001':tipo==='07'?'FC01':tipo==='08'?'FD01':'F001',fecha_emision:'2026-11-12',forma_pago:'Contado',customer_identity_type:'6',customer_identity_number:'20100070970',customer_legal_name:'Cliente ficticio',documento_afectado:['07','08'].includes(tipo)?'F001-00000069':undefined,codigo_motivo_nota:tipo==='07'?'06':tipo==='08'?'02':undefined,items:[{codigo:'MAT',descripcion:'Bien ficticio',unidad:'NIU',cantidad,precioUnitario:41.3,afectacion:'10',descuento:['00','01'].includes(variant)?{codigo:variant,monto}:undefined}],descuento_global:variant.startsWith('global')?{codigo:variant.slice(-2),monto}:undefined};
 return traducirEmision(d as never,issuer8d,15).dto.payload_ubl as never;
}
it('control exacto 37.17 conserva XML byte por byte de main',()=>{
 const xml=gen.generateInvoiceXml(payload('07','00',1));expect(xml).toContain('>37.17</cbc:PriceAmount>');
 expect(createHash('sha256').update(xml).digest('hex')).toBe('5f7ade9b3ac8684c6834c10986d48b777ab0a7109d56e2510e78b9879457c8f4');
});
const variants=['00','01','global02','global03'];
const cases=['01','03','07','08'].flatMap(tipo=>[3,7].flatMap(cantidad=>variants.map(variant=>({tipo,cantidad,variant}))));
it.each(cases)('$tipo cantidad $cantidad descuento $variant: precisión y SFS',async({tipo,cantidad,variant})=>{
 const xml=gen.generateInvoiceXml(payload(tipo,variant,cantidad));
 const conBase=['00','global02'].includes(variant);
 const expected=cantidad===3?(conBase?'39.92333':'40.13333'):(conBase?'41.13143':'41.15714');
 expect(xml).toContain(`<cbc:PriceAmount currencyID="PEN">${expected}</cbc:PriceAmount>\n        <cbc:PriceTypeCode>01</cbc:PriceTypeCode>`);
 expect(await ejecutarSfs(signer.signXml(xml).signedXml,tipo)).toEqual({completado:true,errores:[]});
},30000);
