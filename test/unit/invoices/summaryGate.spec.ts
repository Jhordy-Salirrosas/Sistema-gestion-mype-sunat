import * as runner from '../../../src/modules/invoices/application/services/sunatSfsRunner';
import { SummaryGate } from '../../../src/modules/invoices/application/services/summaryGate';
const context={environment:'BETA',endpoint:'https://e-beta.sunat.gob.pe/ol-ti-itcpfegem-beta/billService',ruc:'20000000001',sol:{username:'FAKE',password:'fake'}};
function xml(root='SummaryDocuments', signature=true) { return `<${root}><cbc:ID>RC-20261109-001</cbc:ID><cac:AccountingSupplierParty><cbc:CustomerAssignedAccountID>20000000001</cbc:CustomerAssignedAccountID></cac:AccountingSupplierParty>${signature?'<ext:UBLExtensions><ext:UBLExtension><ext:ExtensionContent><ds:Signature><ds:SignedInfo><ds:CanonicalizationMethod/></ds:SignedInfo></ds:Signature></ext:ExtensionContent></ext:UBLExtension></ext:UBLExtensions>':''}</${root}>`; }
let validate: jest.SpyInstance;
beforeEach(()=>{ validate=jest.spyOn(runner,'ejecutarSfs').mockResolvedValue({completado:true,errores:[]}); });
afterEach(()=>jest.restoreAllMocks());
it.each(['RA','RC'] as const)('compuerta %s espera validación firmada SFS',async kind=>{
  const input=xml(kind==='RA'?'VoidedDocuments':'SummaryDocuments'); await expect(new SummaryGate().validar(input,kind,context as never,'RC-20261109-001')).resolves.toBeUndefined(); expect(validate).toHaveBeenCalledWith(input,kind);
});
it('MOCK solo local no necesita credenciales SOL y no omite SFS',async()=>{
  await new SummaryGate().validar(xml(),'RC',{...context,environment:'MOCK',endpoint:'http://127.0.0.1/billService',sol:null} as never,'RC-20261109-001'); expect(validate).toHaveBeenCalledTimes(1);
});
it.each(['SOL','sintaxis','DTD','entidad','raíz','ID','RUC','firma'])('bloquea %s antes del ejecutor',async problem=>{
  let input=xml(); const ctx={...context,sol:context.sol as typeof context.sol|null};
  if(problem==='SOL')ctx.sol=null;
  if(problem==='sintaxis')input='<SummaryDocuments>';
  if(problem==='DTD')input='<!DOCTYPE SummaryDocuments>'+input;
  if(problem==='entidad')input='<!DOCTYPE SummaryDocuments [<!ENTITY test "test">]>'+input;
  if(problem==='raíz')input=xml('Invoice');
  if(problem==='ID')input=input.replace('RC-20261109-001','RC-20261109-002');
  if(problem==='RUC')input=input.replace('20000000001','20000000002');
  if(problem==='firma')input=xml('SummaryDocuments',false);
  await expect(new SummaryGate().validar(input,'RC',ctx as never,'RC-20261109-001')).rejects.toThrow('SUMMARY_'); expect(validate).not.toHaveBeenCalled();
});
it.each(['incompleto','error','no disponible'])('SFS %s conserva bloqueo',async problem=>{
  if(problem==='incompleto')validate.mockResolvedValue({completado:false,errores:[]});
  if(problem==='error')validate.mockResolvedValue({completado:true,errores:[{codigo:'XSD',mensaje:'Secuencia inválida',nodo:null}]});
  if(problem==='no disponible')validate.mockRejectedValue(new Error('Python no disponible'));
  await expect(new SummaryGate().validar(xml(),'RC',context as never,'RC-20261109-001')).rejects.toThrow(problem==='no disponible'?'Python':'SUMMARY_VALIDATION_BLOCKED');
});
