import { aggregateHarness } from '../../fixtures/summaryAggregateHarness';
import { hoyLima, resumenFingerprint } from '../../../src/modules/invoices/application/services/summaryAggregateStore';
import { hashSummary } from '../../../src/modules/invoices/application/services/summaryGate';

it('fingerprint es estable al reordenar, distingue motivo/tipo y usa día de Lima', () => {
  const a={id:'a',motivo:'Uno'},b={id:'b',motivo:'Dos'};
  expect(resumenFingerprint('RA','2026-11-09',[a,b])).toBe(resumenFingerprint('RA','2026-11-09',[b,a]));
  expect(resumenFingerprint('RC','2026-11-09',[a,b])).not.toBe(resumenFingerprint('RA','2026-11-09',[a,b]));
  expect(resumenFingerprint('RA','2026-11-09',[{...a,motivo:'Otro'},b])).not.toBe(resumenFingerprint('RA','2026-11-09',[a,b]));
  jest.spyOn(Date,'now').mockReturnValue(Date.parse('2026-11-10T02:00:00Z'));
  expect(hoyLima()).toBe('2026-11-09'); jest.restoreAllMocks();
});
it('no abre transacción para un contexto ajeno', async () => {
  const h=aggregateHarness(); h.context.companyId='other'; await expect(h.reserve()).rejects.toThrow('SUMMARY_COMPANY_MISMATCH'); expect(h.db.$transaction).not.toHaveBeenCalled();
});
it('reserva bajo bloqueo, numera tras los anteriores y congela miembros/motivos', async () => {
  const h=aggregateHarness(); h.delegate.findMany.mockResolvedValueOnce([{identifier:'RA-20261109-007'},{identifier:'malformed'}]).mockResolvedValueOnce([]);
  const {row,vista}=await h.reserve();
  expect(row.identifier).toMatch(/-008$/); expect(row.members).toEqual([{...h.member,motivo:h.selection[0].motivo}]);
  expect(vista?.xml).toContain(`<cbc:ID>${row.identifier}</cbc:ID>`);
  expect(h.db.$executeRaw).toHaveBeenCalledTimes(2); expect(h.preview).toHaveBeenCalledWith(h.db,8,undefined);
});
it.each(['QUEUED','POLLING','UNCERTAIN','ACCEPTED'])('reserva %s es idempotente sin reconstruir XML', async state => {
  const h=aggregateHarness(); h.row.state=state; h.delegate.findUnique.mockResolvedValue(h.row); expect(await h.reserve()).toEqual({row:h.row}); expect(h.preview).not.toHaveBeenCalled();
});
it('BLOCKED reutiliza identificador/fecha y excluye su propia reserva', async () => {
  const h=aggregateHarness(); h.row.state='BLOCKED'; h.delegate.findUnique.mockResolvedValue(h.row);
  const {row,vista}=await h.reserve(); expect(row.id).toBe(h.row.id); expect(vista?.xml).toContain('<cbc:IssueDate>2026-11-09</cbc:IssueDate>');
  expect(h.delegate.update).toHaveBeenCalledWith({where:{id:row.id},data:{state:'RESERVED'}}); expect(h.preview).toHaveBeenCalledWith(h.db,1,row.id); expect(h.delegate.create).not.toHaveBeenCalled();
});
it.each(['sin XML','errores','sin miembros','selección incompleta','reservado'])('reserva no publicable: %s', async problem => {
  const h=aggregateHarness();
  if(problem==='sin XML')h.vista.xml=null;
  if(problem==='errores')h.vista.errores=['Datos incompletos'];
  if(problem==='sin miembros')h.vista.lineas[0].incluido=false;
  if(problem==='selección incompleta')h.selection.push({id:'missing',motivo:'Prueba'});
  if(problem==='reservado')h.delegate.findMany.mockResolvedValueOnce([]).mockResolvedValueOnce([{members:[h.member]}]);
  await expect(h.reserve()).rejects.toThrow(); expect(h.delegate.create).not.toHaveBeenCalled();
});
it('RC guarda miembros sin inventar motivos de baja', async () => {
  const h=aggregateHarness('RC'); const {row}=await h.reserve(); expect(row.members).toEqual([h.member]);
});
it('lectura está aislada por empresa y requiere identificador', async () => {
  const h=aggregateHarness(); await expect(h.store.cargar('',h.row.identifier)).rejects.toThrow('COMPANY_REQUIRED');
  await expect(h.store.cargar('company','')).rejects.toThrow('COMPANY_REQUIRED');
  expect(await h.store.cargar('company',h.row.identifier)).toBe(h.row);
  expect(h.delegate.findFirst).toHaveBeenCalledWith({where:{company_id:'company',identifier:h.row.identifier}});
  h.delegate.findFirst.mockResolvedValue(null); await expect(h.store.cargar('other',h.row.identifier)).rejects.toThrow('NOT_FOUND');
});
it('artefacto y cola usan transiciones condicionales sin degradar trabajos en curso', async () => {
  const h=aggregateHarness(); await h.store.artefacto(h.row as never,'<xml/>','zip');
  expect(h.delegate.updateMany).toHaveBeenLastCalledWith({where:{id:h.row.id,state:{in:['RESERVED','BLOCKED']},transport_uncertain:false},data:{xml:'<xml/>',xml_hash:hashSummary('<xml/>'),zip_base64:'zip',state:'PREPARED',error:null}});
  await h.store.encolado(h.row.id,'job'); expect(h.delegate.updateMany).toHaveBeenLastCalledWith({where:{id:h.row.id,state:'PREPARED'},data:{state:'QUEUED',job_id:'job'}});
  await h.store.bloquear(h.row.id,'XSD'); expect(h.delegate.updateMany).toHaveBeenLastCalledWith(expect.objectContaining({data:{state:'BLOCKED',error:'XSD'}}));
});
it('reclamación única persiste incertidumbre antes de red, ticket y estados de recuperación', async () => {
  const h=aggregateHarness(); expect(await h.store.reclamar(h.row as never)).toBe(true); h.delegate.updateMany.mockResolvedValueOnce({count:0}); expect(await h.store.reclamar(h.row as never)).toBe(false);
  expect(h.delegate.updateMany.mock.calls[0][0]).toMatchObject({where:{company_id:'company',ticket:null,transport_uncertain:false},data:{state:'SENDING',transport_uncertain:true}});
  await h.store.ticket(h.row.id,'T'); expect(h.delegate.update).toHaveBeenLastCalledWith({where:{id:h.row.id},data:{ticket:'T',state:'POLLING',transport_uncertain:false,error:null}});
  await h.store.pendiente(h.row.id,'red',null); expect(h.delegate.updateMany).toHaveBeenLastCalledWith(expect.objectContaining({data:{state:'UNCERTAIN',error:'red'}}));
  await h.store.pendiente(h.row.id,'procesando','T'); expect(h.delegate.updateMany).toHaveBeenLastCalledWith(expect.objectContaining({data:{state:'POLLING',error:'procesando'}}));
  await h.store.revision(h.row.id,'ajeno'); expect(h.delegate.update).toHaveBeenLastCalledWith({where:{id:h.row.id},data:{state:'REVIEW',error:'ajeno'}});
  await h.store.rechazar(h.row.id,'2335','Rechazo'); expect(h.delegate.update).toHaveBeenLastCalledWith(expect.objectContaining({data:{state:'REJECTED',transport_uncertain:false,error:'Rechazo',result:{codigo:'2335',mensaje:'Rechazo'}}}));
  await h.store.pendientes(); expect(h.delegate.findMany).toHaveBeenCalledWith(expect.objectContaining({take:50,where:{OR:expect.arrayContaining([{state:'PREPARED'},{state:'RESERVED',updated_at:{lt:expect.any(Date)}}])}}));
});
it('monitor exige empresa y reduce resultados sin XML/ZIP/CDR', async () => {
  const h=aggregateHarness(); await expect(h.store.listar('')).rejects.toThrow('COMPANY_REQUIRED');
  h.delegate.findMany.mockResolvedValue([{id:'a',result:{codigo:'0',mensaje:'ok',referencia:'RA',contenido:'private',xml:'private'}},{id:'b',result:null}]);
  expect(await h.store.listar('company')).toEqual([{id:'a',bridge_reversal:{pending:0,done:0},result:{codigo:'0',mensaje:'ok',referencia:'RA'}},{id:'b',bridge_reversal:{pending:0,done:0},result:null}]);
  expect(h.delegate.findMany).toHaveBeenLastCalledWith(expect.objectContaining({where:{company_id:'company'}}));
});
it.each(['RA','RC'])('aceptación %s cotejada conserva resultado y efectos dentro de la transacción', async kind => {
  const h=aggregateHarness(kind); const xml=`<cac:DocumentReference><cbc:ID>${h.member.serie}-00000001</cbc:ID></cac:DocumentReference>`;
  const result=await h.store.finalizar(h.row as never,h.cdr('0',xml),'0'); expect(result.state).toBe('ACCEPTED');
  expect(h.db.invoice.updateMany).toHaveBeenCalledWith(expect.objectContaining({where:expect.objectContaining({company_id:'company',id:{in:['invoice']}}),data:{estado:kind==='RA'?'ANULADO':'ACEPTADO'}}));
  expect(h.queue.enqueueInvoiceInTx).toHaveBeenCalledTimes(kind==='RC'?1:0);
  if(kind==='RC')expect(h.queue.enqueueInvoiceInTx).toHaveBeenCalledWith(h.db,'invoice');
  expect(h.delegate.update).toHaveBeenCalledWith(expect.objectContaining({data:expect.objectContaining({result:expect.objectContaining({codigo:'0',referencia:h.row.identifier,contenido:expect.any(String)})})}));
});
it('CDR rechazado se guarda sin anular ni contabilizar', async () => {
  const h=aggregateHarness(); expect((await h.store.finalizar(h.row as never,h.cdr('2335'),null)).state).toBe('REJECTED'); expect(h.db.invoice.updateMany).not.toHaveBeenCalled(); expect(h.queue.enqueueInvoiceInTx).not.toHaveBeenCalled();
});
it.each(['identidad','archivo','hash','miembro','ordinal','tipo','lista CDR','rechazo por línea','snapshot','estado','cola'])('cotejo/fallo %s no finaliza agregado', async failure => {
  const h=aggregateHarness(failure==='cola'?'RC':'RA'); let cdr=h.cdr();
  if(failure==='identidad')cdr=h.cdr('0','','RA-ajena');
  if(failure==='archivo')cdr=h.cdr('0','',h.row.identifier,'other');
  if(failure==='hash')h.row.xml_hash='tampered';
  if(failure==='miembro')h.row.members=[];
  if(failure==='ordinal'||failure==='tipo') { h.row.xml=h.row.xml.replace(failure==='ordinal'?'<cbc:LineID>1':'<cbc:DocumentTypeCode>01',failure==='ordinal'?'<cbc:LineID>2':'<cbc:DocumentTypeCode>07'); h.row.xml_hash=hashSummary(h.row.xml); }
  if(failure==='lista CDR')cdr=h.cdr('0','<cac:DocumentReference><cbc:ID>F001-2</cbc:ID></cac:DocumentReference>');
  if(failure==='rechazo por línea')cdr=h.cdr('0','<cac:LineResponse><cac:Response><cbc:ResponseCode>99</cbc:ResponseCode></cac:Response></cac:LineResponse>');
  if(failure==='snapshot')h.delegate.findUniqueOrThrow.mockResolvedValue({...h.row,xml_hash:'changed'});
  if(failure==='estado')h.db.invoice.updateMany.mockResolvedValue({count:0});
  if(failure==='cola')h.queue.enqueueInvoiceInTx.mockResolvedValue(null);
  await expect(h.store.finalizar(h.row as never,cdr,'0')).rejects.toThrow('SUMMARY_'); expect(h.delegate.update.mock.calls.every(([call]) => !call.data.state)).toBe(true);
});
it.each(['ACCEPTED','REJECTED'])('CDR repetido en %s no repite efectos', async state => {
  const h=aggregateHarness(); h.row.state=state; expect(await h.store.finalizar(h.row as never,h.cdr(),'0')).toBe(h.row); expect(h.db.invoice.updateMany).not.toHaveBeenCalled();
});
it.each(['00000000','00000001','1'])('normaliza correlativo RC %s sin alterar el cotejo', async digits => {
  const h=aggregateHarness('RC'); h.row.xml=h.row.xml.replace('00000001',digits); h.member.correlativo=Number(digits); h.row.xml_hash=hashSummary(h.row.xml);
  expect((await h.store.finalizar(h.row as never,h.cdr(),'0')).state).toBe('ACCEPTED');
});
