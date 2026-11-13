import { validarPlazoDespachoRa } from '../../../src/modules/invoices/application/services/summaryDispatchDeadline';
import { summaryDispatchHarness } from '../../fixtures/summaryDispatchHarness';
import { SummaryAggregateStore } from '../../../src/modules/invoices/application/services/summaryAggregateStore';
afterEach(()=>jest.restoreAllMocks());
it.each([0,7,8,-1])('el despacho diferido recalcula %s días por documento y conserva el artefacto',async dias=>{
 jest.spyOn(Date,'now').mockReturnValue(Date.parse('2026-11-13T17:00:00Z'));
 const h=summaryDispatchHarness();h.row.kind='RA';h.job.tipo='COMUNICACION_BAJA';h.row.members=[{id:'a'},{id:'b'}] as never;
 const fecha=new Date(Date.parse('2026-11-13T00:00:00Z')-dias*86400000);
 const db={invoice:{findMany:jest.fn(async()=>[{id:'a',fecha_emision:new Date('2026-11-13')},{id:'b',fecha_emision:fecha}])}};
 Object.assign(h.store,{validarPlazoDespacho:(row:any)=>validarPlazoDespachoRa(db as never,row)});
 const before=h.row.xml;const result=await h.service.procesar(h.job,{maxConsultas:0});
 if(dias<0||dias>7){expect(result).toMatchObject({enviado:false,status:'BLOQUEADO',error:expect.stringContaining('2957')});expect(h.store.revision).toHaveBeenCalledWith(h.row.id,expect.stringContaining('b'));expect(h.client.sendSummary).not.toHaveBeenCalled();expect(h.store.reclamar).not.toHaveBeenCalled();}
 else expect(h.client.sendSummary).toHaveBeenCalledTimes(1);
 expect(h.row.xml).toBe(before);expect(db.invoice.findMany).toHaveBeenCalledWith(expect.objectContaining({where:{company_id:h.row.company_id,id:{in:['a','b']}}}));
});
it('miembro inexistente o selección vacía bloquea sin inventar fechas',async()=>{
 for(const members of [[],[{id:'a'}]])await expect(validarPlazoDespachoRa({invoice:{findMany:async()=>[]}} as never,{company_id:'c',members} as never)).rejects.toThrow('MIEMBROS_INCOMPLETOS');
});
it('un ticket antiguo conserva la consulta y no vuelve a enviar ni comprobar el plazo',async()=>{
 const h=summaryDispatchHarness();h.row.kind='RA';h.job.tipo='COMUNICACION_BAJA';h.row.ticket='stored';const check=jest.fn();Object.assign(h.store,{validarPlazoDespacho:check});
 await h.service.procesar(h.job,{maxConsultas:0});expect(check).not.toHaveBeenCalled();expect(h.client.sendSummary).not.toHaveBeenCalled();expect(h.client.getStatus).toHaveBeenCalled();
});
it('la comprobación del store usa los miembros persistidos, no los del job',async()=>{
 const db={invoice:{findMany:jest.fn(async()=>[])}};const store=new SummaryAggregateStore(db as never,{} as never);
 await expect(store.validarPlazoDespacho({company_id:'c',members:[{id:'persistido'}]} as never)).rejects.toThrow('MIEMBROS_INCOMPLETOS');
 expect(db.invoice.findMany).toHaveBeenCalledWith(expect.objectContaining({where:{company_id:'c',id:{in:['persistido']}}}));
});
