import {validarAdquirente} from '../../../src/modules/invoices/domain/rules/taxpayerIdValidator';
import {traducirEmision} from '../../../src/modules/invoices/application/services/emitirComprobanteAdapter';
import {UblGeneratorService} from '../../../src/modules/invoices/ublGeneratorService';
import {SignatureService} from '../../../src/modules/sunat/signature.service';
import {fakeIssuerCertificate} from '../../fixtures/fakeIssuerCertificate';
import {issuer8d} from '../../fixtures/8dFiscalHarness';
import {ejecutarSfs} from '../../../src/modules/invoices/application/services/sunatSfsRunner';
it.each(['07','08'])('nota %s sobre boleta admite DNI, genera XML y supera hoja oficial',async tipo=>{
 validarAdquirente({tipoDoc:'1',numeroDoc:'12345678'},{tipoComprobante:tipo,tipoComprobanteOrigen:'03',importeTotal:118});
 const dto={tipo_comprobante:tipo,serie:tipo==='07'?'BC01':'BD01',fecha_emision:'2026-11-13',forma_pago:'Contado',customer_identity_type:'1',customer_identity_number:'12345678',customer_legal_name:'Cliente ficticio',documento_afectado:'B001-00000001',codigo_motivo_nota:tipo==='07'?'06':'02',items:[{codigo:'MAT',descripcion:'Producto',unidad:'NIU',cantidad:1,valorUnitario:100,precioUnitario:118,afectacion:'10'}]};
 const p=traducirEmision(dto as never,issuer8d,1);const xml=new UblGeneratorService().generateInvoiceXml(p.dto.payload_ubl as never);expect(xml).toContain('schemeID="1"');expect(xml).toContain('<cbc:DocumentTypeCode>03</cbc:DocumentTypeCode>');
 const c=fakeIssuerCertificate();const s=new SignatureService({getCertificate:()=>({certificatePem:c.pem,privateKeyPem:c.privateKeyPem})} as never);
 expect(await ejecutarSfs(s.signXml(xml).signedXml,tipo)).toEqual({completado:true,errores:[]});
});
it.each(['01',null,undefined])('factura o tipo no acreditado %s conserva RUC obligatorio',tipoComprobanteOrigen=>{
 for(const tipoComprobante of ['07','08']){
 expect(()=>validarAdquirente({tipoDoc:'1',numeroDoc:'12345678'},{tipoComprobante,tipoComprobanteOrigen,importeTotal:118})).toThrow('solo admite RUC');
 expect(()=>validarAdquirente(null,{tipoComprobante,tipoComprobanteOrigen,importeTotal:118})).toThrow('exige el RUC');
 }
});
it('la nota a boleta mantiene la identificación por umbral y valida DNI',()=>{
 expect(()=>validarAdquirente(null,{tipoComprobante:'07',tipoComprobanteOrigen:'03',importeTotal:700})).not.toThrow();
 expect(()=>validarAdquirente(null,{tipoComprobante:'07',tipoComprobanteOrigen:'03',importeTotal:700.01})).toThrow('supera el umbral');
 expect(()=>validarAdquirente({tipoDoc:'1',numeroDoc:'123'},{tipoComprobante:'08',tipoComprobanteOrigen:'03',importeTotal:118})).toThrow('8 dígitos');
});
it('un tipo ajeno a este validador permanece a cargo de la validación de contenido fiscal',()=>{
 expect(()=>validarAdquirente(null,{tipoComprobante:'99',importeTotal:0})).not.toThrow();
});
