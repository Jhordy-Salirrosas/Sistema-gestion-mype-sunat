import { traducirEmision } from '../../src/modules/invoices/application/services/emitirComprobanteAdapter';
import { esAfectacionGratuita } from '../../src/modules/invoices/sunatCatalogsQuery';
import type { InvoicePayload } from '../../src/modules/invoices/invoicePayload';
export const issuer8d = { ruc:'20000000001',razonSocial:'Emisor ficticio',codigoLocalAnexo:'0000',direccion:'Domicilio ficticio',ubigeo:'150101',departamento:'LIMA',provincia:'LIMA',distrito:'LIMA' };
export function fiscal8d(afectacion: string, bolsas=0, tipo='01', mixto=false) {
 const gratuita=esAfectacionGratuita(afectacion);
 const line={codigo:'MAT',descripcion:'Bien ficticio',unidad:'NIU',cantidad:2,valorUnitario:100,precioUnitario:gratuita?0:afectacion==='10'?118:100,afectacion,cantidadBolsas:bolsas,icbper:bolsas*.5};
 const dto={tipo_comprobante:tipo,serie:tipo==='03'?'B001':tipo==='07'?'FC01':tipo==='08'?'FD01':'F001',fecha_emision:'2026-11-12',forma_pago:'Contado',customer_identity_type:'6',customer_identity_number:'20100070970',customer_legal_name:'Cliente ficticio',documento_afectado:['07','08'].includes(tipo)?'F001-00000001':undefined,codigo_motivo_nota:tipo==='07'?'06':tipo==='08'?'02':undefined,items:mixto?[line,{...line,codigo:'PAID',afectacion:'10',precioUnitario:118,cantidadBolsas:0,icbper:0}]:[line]};
 const translated=traducirEmision(dto as never,issuer8d,1);
 return {payload:translated.dto.payload_ubl as unknown as InvoicePayload,total:translated.dto.monto_total};
}
