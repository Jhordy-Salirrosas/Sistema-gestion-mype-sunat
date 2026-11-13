import {createHash} from 'node:crypto';
import hashes from '../../fixtures/consolidado-anulacion-01-hashes.json';
import {fiscal8d,issuer8d} from '../../fixtures/8dFiscalHarness';
import {UblGeneratorService} from '../../../src/modules/invoices/ublGeneratorService';
import {traducirEmision} from '../../../src/modules/invoices/application/services/emitirComprobanteAdapter';
import {SignatureService} from '../../../src/modules/sunat/signature.service';
import {fakeIssuerCertificate} from '../../fixtures/fakeIssuerCertificate';
import {ejecutarSfs} from '../../../src/modules/invoices/application/services/sunatSfsRunner';
import {aplicarIcbperNota} from '../../../src/modules/invoices/noteIcbperPolicy';
const generator=new UblGeneratorService();
it.each(['04','09'].flatMap(m=>[null,0,1].map(b=>[m,b] as const)))('NC %s devolución=%s: adapter y hojas oficiales',async(motivo,bolsas)=>{
 const dto={tipo_comprobante:'07',serie:'FC01',fecha_emision:'2026-11-13',forma_pago:'Contado',customer_identity_type:'6',customer_identity_number:'20100070970',customer_legal_name:'Cliente ficticio',documento_afectado:'F001-00000001',codigo_motivo_nota:motivo,items:[{codigo:'MAT',descripcion:'Producto',unidad:'NIU',cantidad:2,valorUnitario:100,precioUnitario:118,afectacion:'10',cantidadBolsas:bolsas,icbper:.5}]};
 const original=JSON.stringify(dto);const p=traducirEmision(dto as never,issuer8d,1);const payload=p.dto.payload_ubl as never;
 expect(p.importes.total).toBe(bolsas?236.5:236);const xml=generator.generateInvoiceXml(payload);
 expect(xml.match(/<cbc:ID>7152<\/cbc:ID>/g)?.length??0).toBe(bolsas?2:0);
 expect(xml).toContain(`<cbc:PayableAmount currencyID="PEN">${p.importes.total.toFixed(2)}</cbc:PayableAmount>`);
 const cert=fakeIssuerCertificate();const signer=new SignatureService({getCertificate:()=>({certificatePem:cert.pem,privateKeyPem:cert.privateKeyPem})} as never);
 expect(await ejecutarSfs(signer.signXml(xml).signedXml,'07')).toEqual({completado:true,errores:[]});expect(JSON.stringify(dto)).toBe(original);
});
it.each(hashes)('anulación 01 $aff/$bags conserva el espejo byte a byte',({aff,bags,hash})=>{
 const p=fiscal8d(String(aff),Number(bags),'07').payload;p.codigoMotivoNota='01';
 expect(createHash('sha256').update(generator.generateInvoiceXml(p)).digest('hex')).toBe(hash);
});
it('XML heredado con impuesto pero sin devolución explícita no altera payload ni duplica tributo',()=>{
 const p=fiscal8d('10',1,'07').payload;p.codigoMotivoNota='04';delete p.lineas![0].cantidadBolsas;
 const before=JSON.stringify(p);expect(generator.generateInvoiceXml(p)).not.toContain('<cbc:ID>7152</cbc:ID>');expect(JSON.stringify(p)).toBe(before);
 const singular={...p,linea:p.lineas![0],lineas:undefined};expect(aplicarIcbperNota(singular).montoTotal).toBe(236);
 expect(aplicarIcbperNota({...singular,montoTotalIncluyeIcbper:false}).montoTotal).toBe(236.5);
 expect(aplicarIcbperNota({...p,lineas:undefined,bolsasIcBper:1,montoTotal:.5}).montoTotal).toBe(0);
 const mixed=fiscal8d('10',1,'07').payload;mixed.codigoMotivoNota='09';mixed.lineas!.push({...mixed.lineas![0],id:2,cantidadBolsas:undefined});
 expect(aplicarIcbperNota(mixed).lineas!.map(l=>l.icbperLinea)).toEqual([.5,undefined]);
});
