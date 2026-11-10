import AdmZip from 'adm-zip';
import { summaryDispatchHarness } from '../../fixtures/summaryDispatchHarness';
it('rechaza tipo de job incoherente sin abrir red',async()=>{
  const h=summaryDispatchHarness();h.row.kind='RA';await expect(h.service.procesar(h.job)).rejects.toThrow('SUMMARY_JOB_KIND_MISMATCH'); expect(h.client.sendSummary).not.toHaveBeenCalled();
});
it.each(['ACCEPTED','REJECTED'])('final %s devuelve resultado persistido sin SOAP',async state=>{
  const h=summaryDispatchHarness();h.row.state=state;h.row.ticket='T';h.row.result={codigo:'0',contenido:'saved'};
  expect(await h.service.procesar(h.job)).toMatchObject({enviado:true,status:'0',contenido:'saved',ticket:'T'});expect(h.resolver.resolve).not.toHaveBeenCalled();
  h.row.result=null;expect(await h.service.procesar(h.job)).toMatchObject({enviado:false,status:null,contenido:null});
});
it.each(['SENDING','UNCERTAIN','REVIEW'])('%s sin ticket no reenvía aunque el job sea reentregado',async state=>{
  const h=summaryDispatchHarness();h.row.state=state;h.row.error='Causa guardada';expect(await h.service.procesar(h.job)).toMatchObject({enviado:false,error:'Causa guardada'});expect(h.client.sendSummary).not.toHaveBeenCalled();
});
it.each(['sin XML','hash','sin ZIP','nombre ZIP','hash ZIP','múltiples entradas','gate'])('artefacto %s falla cerrado en consumer',async problem=>{
  const h=summaryDispatchHarness();if(problem==='sin XML')h.row.xml=null;if(problem==='hash')h.row.xml_hash='tampered';if(problem==='sin ZIP')h.row.zip_base64=null;
  if(['nombre ZIP','hash ZIP','múltiples entradas'].includes(problem)){
    const z=new AdmZip();z.addFile(problem==='nombre ZIP'?'other.xml':`${h.row.issuer_ruc}-${h.row.identifier}.xml`,Buffer.from(problem==='hash ZIP'?'<tampered/>':h.row.xml!));if(problem==='múltiples entradas')z.addFile('extra.xml',Buffer.from('extra'));h.row.zip_base64=z.toBuffer().toString('base64');
  }
  if(problem==='gate')h.gate.validar.mockRejectedValue(new Error('XSD no concluyente'));
  expect(await h.service.procesar(h.job)).toMatchObject({enviado:false,status:'BLOQUEADO'});expect(h.store.revision).toHaveBeenCalled();expect(h.client.sendSummary).not.toHaveBeenCalled();
});
it('otro worker que ganó la reclamación evita sendSummary',async()=>{
  const h=summaryDispatchHarness();h.store.reclamar.mockResolvedValue(false);expect(await h.service.procesar(h.job)).toMatchObject({error:'Otro trabajo tiene el envío reservado'});expect(h.client.sendSummary).not.toHaveBeenCalled();
});
it('marca y guarda ticket antes de getStatus; nunca usa el ZIP del job',async()=>{
  const h=summaryDispatchHarness();expect(await h.service.procesar(h.job,{maxConsultas:0})).toMatchObject({enviado:true,ticket:'T-FAKE',consultas:1});
  expect(h.store.reclamar.mock.invocationCallOrder[0]).toBeLessThan(h.client.sendSummary.mock.invocationCallOrder[0]);expect(h.store.ticket.mock.invocationCallOrder[0]).toBeLessThan(h.client.getStatus.mock.invocationCallOrder[0]);
  expect(h.client.sendSummary).toHaveBeenCalledWith(expect.objectContaining({fileName:`${h.row.issuer_ruc}-${h.row.identifier}.zip`,zip:Buffer.from(h.row.zip_base64!,'base64')}));expect(h.store.finalizar).toHaveBeenCalledWith(h.row,'cdr','0');
});
it.each(['ticket ausente','persistencia ticket','red'])('%s conserva incertidumbre, sin getStatus ni reenvío',async failure=>{
  const h=summaryDispatchHarness();if(failure==='ticket ausente')h.client.sendSummary.mockResolvedValue({ticket:''});if(failure==='persistencia ticket')h.store.ticket.mockRejectedValue(new Error('base caída'));if(failure==='red')h.client.sendSummary.mockRejectedValue('timeout');
  expect(await h.service.procesar(h.job,{maxConsultas:0})).toMatchObject({enviado:false,ticket:null,error:expect.any(String)});expect(h.store.pendiente).toHaveBeenCalledWith(h.row.id,expect.any(String),null);expect(h.client.getStatus).not.toHaveBeenCalled();
});
it('ticket persistido retoma getStatus sin sendSummary y sin SOL en MOCK local',async()=>{
  const h=summaryDispatchHarness();h.row.ticket='stored';h.context.sol=null;h.context.environment=h.row.environment='MOCK';h.context.endpoint='http://127.0.0.1/billService';
  expect(await h.service.procesar(h.job,{maxConsultas:0})).toMatchObject({enviado:true,ticket:'stored'});expect(h.client.sendSummary).not.toHaveBeenCalled();expect(h.client.getStatus).toHaveBeenCalledWith('stored',null,h.context);
});
it.each(['SUMMARY_CDR_IDENTITY_MISMATCH','SUMMARY_XML_HASH_MISMATCH'])('CDR inválido %s queda REVIEW sin finalizar',async message=>{
  const h=summaryDispatchHarness();h.row.ticket='stored';h.store.finalizar.mockRejectedValue(new Error(message));expect(await h.service.procesar(h.job,{maxConsultas:0})).toMatchObject({status:'CDR_INVALIDO',error:message});expect(h.store.revision).toHaveBeenCalledWith(h.row.id,message);expect(h.client.sendSummary).not.toHaveBeenCalled();
});
it('fallo transaccional tras CDR conserva ticket y estado recuperable',async()=>{
  const h=summaryDispatchHarness();h.row.ticket='stored';h.store.finalizar.mockRejectedValue(new Error('base caída'));expect(await h.service.procesar(h.job,{maxConsultas:0})).toMatchObject({enviado:false,status:null,ticket:'stored',error:'base caída'});expect(h.store.pendiente).toHaveBeenCalledWith(h.row.id,'base caída','stored');
});
it.each(['2335',null])('resultado sin CDR %s persiste rechazo o incertidumbre de consulta',async status=>{
  const h=summaryDispatchHarness();h.client.getStatus.mockResolvedValue({statusCode:status,enProceso:false,contenido:null});expect(await h.service.procesar(h.job,{maxConsultas:0})).toMatchObject({enviado:false,status});
  if(status)expect(h.store.rechazar).toHaveBeenCalledWith(h.row.id,status,expect.stringContaining(status));else expect(h.store.pendiente).toHaveBeenCalledWith(h.row.id,expect.stringContaining('sin estado'),'T-FAKE');
});
it('getStatus fallido nunca pierde el ticket',async()=>{
  const h=summaryDispatchHarness();h.row.ticket='stored';h.client.getStatus.mockRejectedValue('red caída');expect(await h.service.procesar(h.job,{maxConsultas:0})).toMatchObject({ticket:'stored',error:'red caída'});expect(h.store.pendiente).toHaveBeenCalledWith(h.row.id,'red caída','stored');
});
it('98 reprograma tras agotar consultas y respeta espera configurada',async()=>{
  const h=summaryDispatchHarness();h.client.getStatus.mockResolvedValue({statusCode:'98',enProceso:true,contenido:null});const r=await h.service.procesar(h.job,{maxConsultas:1,esperaMs:1});expect(r).toMatchObject({enviado:false,status:'98',ticket:'T-FAKE',consultas:2});expect(h.client.sendSummary).toHaveBeenCalledTimes(1);expect(h.client.getStatus).toHaveBeenCalledTimes(2);expect(h.store.pendiente).toHaveBeenCalledWith(h.row.id,expect.stringContaining('98'),'T-FAKE');
});
