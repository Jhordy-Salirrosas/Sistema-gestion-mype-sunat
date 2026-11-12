import { validarContenidoFiscal } from '../../../src/modules/invoices/validateInvoiceContent';
import { fiscal8d } from '../../fixtures/8dFiscalHarness';
it.each(['01','03','07','08'])('descripción y motivo en el borde SFS %s',tipo=>{
 const {payload}=fiscal8d('10',0,tipo);
 payload.lineas![0].descripcion='A'.repeat(500);if(['07','08'].includes(tipo))payload.descripcionMotivoNota='M'.repeat(500);
 expect(()=>validarContenidoFiscal(payload)).not.toThrow();
 payload.lineas![0].descripcion+='A';expect(()=>validarContenidoFiscal(payload)).toThrow('lineas[0].descripcion admite como máximo 500');
 if(['07','08'].includes(tipo)){payload.lineas![0].descripcion='Bien';payload.descripcionMotivoNota+='M';expect(()=>validarContenidoFiscal(payload)).toThrow('descripcionMotivoNota admite como máximo 500');}
});
it.each([['razonSocialEmisor',1500],['nombreComercialEmisor',1500],['direccionEmisor',200],['provinciaEmisor',30],['departamentoEmisor',30],['distritoEmisor',30],['ordenCompra',20]] as const)('límite oficial %s=%s', (campo,max)=>{
 const {payload}=fiscal8d('10');payload[campo]='A'.repeat(max);expect(()=>validarContenidoFiscal(payload)).not.toThrow();payload[campo]+='A';expect(()=>validarContenidoFiscal(payload)).toThrow(`${campo} admite como máximo ${max}`);
});
it('razón social del cliente usa máximo 1500',()=>{const {payload}=fiscal8d('10');payload.cliente!.razonSocial='A'.repeat(1500);expect(()=>validarContenidoFiscal(payload)).not.toThrow();payload.cliente!.razonSocial+='A';expect(()=>validarContenidoFiscal(payload)).toThrow('cliente.razonSocial');});
it('no inventa máximo para observaciones',()=>{const {payload}=fiscal8d('10');payload.observaciones='A'.repeat(2000);expect(()=>validarContenidoFiscal(payload)).not.toThrow();});
it('cuenta caracteres Unicode como XSL, no unidades UTF-16',()=>{const {payload}=fiscal8d('10');payload.lineas![0].descripcion='😀'.repeat(500);expect(()=>validarContenidoFiscal(payload)).not.toThrow();});
it('valida la variante de línea singular',()=>{const {payload}=fiscal8d('10');payload.linea={...payload.lineas![0],descripcion:'A'.repeat(501)};delete payload.lineas;expect(()=>validarContenidoFiscal(payload)).toThrow('500');});
