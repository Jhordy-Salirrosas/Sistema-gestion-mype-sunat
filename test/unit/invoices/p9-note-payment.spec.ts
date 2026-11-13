import { fiscalToEmission, prepareCreation } from '../../../src/modules/invoices/application/services/creationGuards';
import { scenario } from '../../fixtures/8bTerAtomicHarness';
const base={tipo_comprobante:'07',serie:'FC01',fecha_emision:'2026-11-12',customer_identity_type:'6',customer_identity_number:'20100070970',customer_legal_name:'Cliente',documento_afectado:'F001-69',codigo_motivo_nota:'09',forma_pago:'Credito',cuotas:[{monto:1,vencimiento:'invalido'}],items:[{codigo:'SERV',descripcion:'Servicio',unidad:'NIU',afectacion:'10',cantidad:1,precioUnitario:11.8}]};
it.each([['07','09'],['08','02']])('nota %s/%s no hereda cuotas ni exige crédito',async(tipo,motivo)=>{
 const h=scenario();const input={...base,tipo_comprobante:tipo,serie:tipo==='07'?'FC01':'FD01',codigo_motivo_nota:motivo};
 const r=await prepareCreation(h.tx,input as never,'empresa');
 expect(r).toMatchObject({forma_pago:'Contado',cuotas:[]});expect(h.tx.businessPartner.findFirst).not.toHaveBeenCalled();expect(input.forma_pago).toBe('Credito');
});
it('motivo 13 conserva las guardas de crédito y no acepta cuotas inválidas',async()=>{
 const h=scenario(); await expect(prepareCreation(h.tx,{...base,codigo_motivo_nota:'13'} as never,'empresa')).rejects.toThrow();
});
it.each(['09','13'])('adaptación fiscal conserva el contrato de pago solo para %s',motivo=>{
 const dto={tipo_comprobante:'07',serie:'FC01',fecha_emision:'2026-11-12',ruc_emisor:'20601234567',payload_ubl:{tipoComprobante:'07',serie:'FC01',fechaEmision:'2026-11-12',rucEmisor:'20601234567',tipoMoneda:'PEN',codigoMotivoNota:motivo,formaPago:'Credito',cuotas:[{monto:11.8,vencimiento:'2026-12-01'}],lineas:[{codigo:'SERV',cantidad:1}],documentoAfectado:'F001-69'}};
 expect(fiscalToEmission(dto as never)).toMatchObject(motivo==='13'?{forma_pago:'Credito',cuotas:[{monto:11.8,vencimiento:'2026-12-01'}]}:{forma_pago:'Contado',cuotas:[]});
});
