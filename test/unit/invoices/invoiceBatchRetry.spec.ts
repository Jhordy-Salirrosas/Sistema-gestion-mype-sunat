import { InvoiceBatchRetryService, clasificarReintentoMasivo } from '../../../src/modules/invoices/application/services/invoiceBatchRetryService';
const evento=(codigo:string|null,mensaje='Causa',estado='ERROR_RED')=>({codigo_error:codigo,mensaje_error:mensaje,estado_nuevo:estado,created_at:new Date()});
const fila=(id='a',estado='ERROR_RED',transport_uncertain:boolean|null=false,history:unknown[]=[],cdr_sunat:unknown=null)=>({id,estado,serie:'F001',correlativo:1,transport_uncertain,history,cdr_sunat}) as any;
function harness(rows:any[]=[fila()]) {
  const actual={value:rows[0]};
  const tx={ $queryRaw:jest.fn(async()=>[{adquirido:true}]),invoice:{findFirst:jest.fn(async()=>actual.value),updateMany:jest.fn(async()=>({count:1}))},transactionHistory:{create:jest.fn(async()=>({}))} };
  const prisma={invoice:{findMany:jest.fn(async()=>rows)},$transaction:jest.fn(async(work:any)=>work(tx))};
  const queue={hasLiveInvoiceJob:jest.fn(async()=>false),reenqueueInvoiceIfIdle:jest.fn(async(_id:string,_company:string,permitido:()=>Promise<boolean>)=>({estado:await permitido()?'ENCOLADO':'ESTADO_NO_PERMITIDO'}))};
  return {actual,tx,prisma,queue,service:new InvoiceBatchRetryService(prisma as never,queue as never)};
}
it.each([
 ['uncertain',fila('u','ERROR_RED',true),'OMITIDO_INCERTIDUMBRE'],
 ['CDR SUNAT',fila('s','RECHAZADO',false,[],{responseCode:'3105',description:'Rechazo SUNAT'}),'OMITIDO_RECHAZO_DEFINITIVO'],
 ['SOAP SUNAT',fila('s','RECHAZADO',false,[evento('3105','SOAP Fault del billService: rechazo','RECHAZADO')]),'OMITIDO_RECHAZO_DEFINITIVO'],
 ['XSL local',fila('l','RECHAZADO',false,[evento('3236','Validación XSL local: error','RECHAZADO')]),'OMITIDO_BLOQUEO_LOCAL'],
 ['datos locales',fila('l','ERROR_RED',false,[evento('M1_PREPARATION_DATOS_INVALIDOS',JSON.stringify({causa:'Datos',recuperable:false}))]),'OMITIDO_BLOQUEO_LOCAL'],
 ['local sin recuperabilidad',fila('l','ERROR_RED',false,[evento('M1_PREPARATION_DATOS_INVALIDOS','{}')]),'OMITIDO_BLOQUEO_LOCAL'],
 ['JSON local mal formado',fila('l','ERROR_RED',false,[evento('M1_PREPARATION_DATOS_INVALIDOS','mal formado')]),'OMITIDO_BLOQUEO_LOCAL'],
 ['rechazo no confirmado',fila('r','RECHAZADO'),'OMITIDO_ESTADO'],['procesando',fila('p','PROCESANDO'),'OMITIDO_ESTADO'],
 ['certificado recuperable',fila('c','ERROR_RED',false,[evento('M1_PREPARATION_CERTIFICADO',JSON.stringify({recuperable:true}))]),'ELEGIBLE'],
 ['sin error local',fila('a','ERROR_RED',false,[evento(null),evento('M1_NOTE_DESCRIPTION_COMPLETED'),evento('ETIMEDOUT')]),'ELEGIBLE'],
 ['cola',fila('c','EN_COLA'),'ELEGIBLE'],['pendiente',fila('p','PENDIENTE',null),'ELEGIBLE'],['enviado',fila('e','ENVIADO'),'ELEGIBLE'],
] as const)('política %s produce %s',(_name,row,resultado)=>expect(clasificarReintentoMasivo(row).resultado).toBe(resultado));
it('sin tenant no consulta ni encola',async()=>{
 const h=harness();await expect(h.service.ejecutar('')).rejects.toThrow('ISSUER_COMPANY_REQUIRED');expect(h.prisma.invoice.findMany).not.toHaveBeenCalled();
});
it('vista previa devuelve conteos y detalles sin publicar ni cambiar datos',async()=>{
 const h=harness([fila(),fila('u','EN_COLA',true),fila('r','RECHAZADO',false,[],{responseCode:'3105'}),fila('l','ERROR_RED',false,[evento('M1_PREPARATION_DATOS_INVALIDOS','{}')])]);
 const r=await h.service.ejecutar('tenant',true);
 expect(r).toMatchObject({fase:'PREVIA',elegibles:1,encolados:0,omitidos_incertidumbre:1,omitidos_rechazo_definitivo:1,omitidos_bloqueo_local:1});
 expect(r.documentos).toHaveLength(4);expect(h.prisma.invoice.findMany).toHaveBeenCalledWith(expect.objectContaining({where:expect.objectContaining({company_id:'tenant'})}));expect(h.queue.reenqueueInvoiceIfIdle).not.toHaveBeenCalled();expect(h.prisma.$transaction).not.toHaveBeenCalled();
});
it('las exclusiones duras nunca llegan a la compuerta',async()=>{
 const h=harness([fila('u','ERROR_RED',true),fila('r','RECHAZADO',false,[],{responseCode:'3105'}),fila('l','ERROR_RED',false,[evento('M1_PREPARATION_DATOS_INVALIDOS','{}')])]);
 const r=await h.service.ejecutar('tenant');expect(r.encolados).toBe(0);expect(h.queue.reenqueueInvoiceIfIdle).not.toHaveBeenCalled();
});
it('comparte compuerta y confirma marcador y auditoría antes de publicar',async()=>{
 const h=harness([fila('legacy','PENDIENTE',null)]);const r=await h.service.ejecutar('tenant');
 expect(r).toMatchObject({encolados:1,no_confirmados:0});expect(h.tx.$queryRaw).toHaveBeenCalled();
 expect(h.queue.reenqueueInvoiceIfIdle).toHaveBeenCalledWith('legacy','tenant',expect.any(Function),{rescatarDlq:true});
 expect(h.tx.invoice.updateMany).toHaveBeenCalledWith({where:{id:'legacy',company_id:'tenant',transport_uncertain:null},data:{transport_uncertain:true}});
 expect(h.tx.transactionHistory.create).toHaveBeenCalledWith(expect.objectContaining({data:expect.objectContaining({company_id:'tenant',invoice_id:'legacy',mensaje_error:expect.stringContaining('Reintento manual masivo')})}));
});
it.each([null,fila('a','ACEPTADO'),fila('a','ERROR_RED',true),fila('a','RECHAZADO',false,[],{responseCode:'3105'}),fila('a','ERROR_RED',false,[evento('M1_PREPARATION_DATOS_INVALIDOS','{}')])])('reevalúa bajo bloqueo y excluye cambios de estado/campo: %j',async row=>{
 const h=harness();h.actual.value=row;const r=await h.service.ejecutar('tenant');expect(r.encolados).toBe(0);expect(h.tx.invoice.updateMany).not.toHaveBeenCalled();expect(h.tx.transactionHistory.create).not.toHaveBeenCalled();
 expect(h.tx.invoice.findFirst).toHaveBeenCalledWith(expect.objectContaining({where:{id:'a',company_id:'tenant'}}));
});
it.each(['YA_EN_COLA','EN_DLQ','ESTADO_NO_PERMITIDO'])('conserva la respuesta real de la compuerta %s',async estado=>{
 const h=harness();h.queue.reenqueueInvoiceIfIdle.mockResolvedValue({estado} as never);
 const r=await h.service.ejecutar('tenant');expect(r.encolados).toBe(0);expect(r.ya_en_cola).toBe(estado==='YA_EN_COLA'?1:0);expect(r.omitidos_estado).toBe(estado==='YA_EN_COLA'?0:1);
});
it('un error individual no impide continuar con otros comprobantes',async()=>{
 const h=harness([fila('falla'),fila('sigue')]);h.queue.reenqueueInvoiceIfIdle.mockRejectedValueOnce(new Error('cola privada'));
 const r=await h.service.ejecutar('tenant');expect(r.no_confirmados).toBe(1);expect(r.encolados).toBe(1);expect(r.documentos[0].motivo).not.toContain('privada');
});
it('lote vacío devuelve ceros y no abre transacciones',async()=>{
 const h=harness([]);expect(await h.service.ejecutar('tenant')).toMatchObject({fase:'EJECUTADA',documentos:[],encolados:0,no_confirmados:0});expect(h.prisma.$transaction).not.toHaveBeenCalled();
});

it('un lote simultáneo conserva exclusiones e informa en curso sin volver a publicar',async()=>{
 const h=harness([fila(),fila('u','EN_COLA',true)]);h.tx.$queryRaw.mockResolvedValue([{adquirido:false}]);
 const r=await h.service.ejecutar('tenant');expect(r).toMatchObject({en_curso:1,encolados:0,omitidos_incertidumbre:1});expect(h.queue.reenqueueInvoiceIfIdle).not.toHaveBeenCalled();
});

it('un trabajo vivo impide publicar aunque la fila siga siendo elegible',async()=>{
 const h=harness();h.queue.hasLiveInvoiceJob.mockResolvedValue(true);
 const r=await h.service.ejecutar('tenant');expect(r).toMatchObject({encolados:0,ya_en_cola:1});
 expect(h.queue.hasLiveInvoiceJob).toHaveBeenCalledWith('a');expect(h.tx.invoice.updateMany).not.toHaveBeenCalled();expect(h.tx.transactionHistory.create).not.toHaveBeenCalled();
});
it('si no puede comprobar trabajos vivos, no autoriza publicación y devuelve no confirmado',async()=>{
 const h=harness();h.queue.hasLiveInvoiceJob.mockRejectedValue(new Error('cola privada'));
 const r=await h.service.ejecutar('tenant');expect(r).toMatchObject({encolados:0,no_confirmados:1});expect(h.tx.invoice.updateMany).not.toHaveBeenCalled();
});
