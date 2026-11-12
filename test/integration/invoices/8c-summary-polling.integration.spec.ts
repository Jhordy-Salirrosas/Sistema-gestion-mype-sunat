import { randomUUID } from 'node:crypto';
import { PrismaService } from '../../../src/database/prismaService';
import { QueueService } from '../../../src/modules/resilience/infrastructure/queue/queue.service';
import { SummaryAggregateStore } from '../../../src/modules/invoices/application/services/summaryAggregateStore';
import { SummaryDispatchService } from '../../../src/modules/invoices/application/services/summaryDispatchService';
import { pollingOf, summaryPollDelay } from '../../../src/modules/invoices/application/services/summaryPollingCoordinator';
import { summaryDispatchHarness } from '../../fixtures/summaryDispatchHarness';
const url=process.env.TEST_DATABASE_URL;
(url?describe:describe.skip)('8C C5: agenda y exclusión durables en PostgreSQL',()=>{
 let db:PrismaService,queue:QueueService,company:string,id:string,h:ReturnType<typeof summaryDispatchHarness>,store:SummaryAggregateStore;
 const old=process.env.DATABASE_URL,oldBoss=process.env.PG_BOSS_URL;
 beforeAll(async()=>{
  if(!url||!['localhost','127.0.0.1'].includes(new URL(url).hostname))throw new Error('Solo PostgreSQL local');
  process.env.DATABASE_URL=url;process.env.PG_BOSS_URL=url;db=new PrismaService();await db.$connect();queue=new QueueService();await queue.onModuleInit();
 });
 beforeEach(async()=>{
  h=summaryDispatchHarness();company=randomUUID();id=randomUUID();h.job.companyId=company;
  await db.company.create({data:{id:company,ruc:'2'+Date.now().toString().slice(-10),legal_name:'Polling ficticio',sol_user:'fake',sol_pass_encrypted:'fake'}});
  await db.invoiceAggregate.create({data:{...h.row,id,company_id:company,state:'POLLING',ticket:'T',fingerprint:randomUUID(),reference_date:'2026-11-11',generation_date:'2026-11-11',members:[],result:{polling:{attempts:0,nextAt:new Date().toISOString()}}}});
  h.client.getStatus.mockResolvedValue({statusCode:'98',enProceso:true,contenido:null});store=new SummaryAggregateStore(db,queue);
 });
 const service=(s=store)=>new SummaryDispatchService(queue,h.client as never,{resolve:async()=>h.context} as never,s,{validar:async()=>undefined} as never);
 const read=async()=>pollingOf((await db.invoiceAggregate.findUniqueOrThrow({where:{id}})).result)!;
 afterEach(async()=>{
  jest.restoreAllMocks();await db.$executeRaw`DELETE FROM pgboss.job WHERE data->>'companyId'=${company}`;
  await db.invoiceAggregate.deleteMany({where:{company_id:company}});await db.company.delete({where:{id:company}});
 });
 afterAll(async()=>{await queue.onModuleDestroy();await db.$disconnect();if(old===undefined)delete process.env.DATABASE_URL;else process.env.DATABASE_URL=old;if(oldBoss===undefined)delete process.env.PG_BOSS_URL;else process.env.PG_BOSS_URL=oldBoss;});
 it('manual/worker/otro proceso comparten exclusión; solo se ejecuta un getStatus',async()=>{
  let finish!:(r:any)=>void;h.client.getStatus.mockImplementation(()=>new Promise(resolve=>{finish=resolve;}));
  const pending=service().procesar(h.job,{maxConsultas:0});
  for(let i=0;i<100&&!finish;i++)await new Promise(r=>setTimeout(r,5));
  expect(finish).toBeDefined();
  expect((await service(new SummaryAggregateStore(db,queue)).procesar(h.job,{maxConsultas:0,automatico:true,sondeoIntento:1})).status).toBe('SUMMARY_POLL_BUSY');
  expect((await service().procesar(h.job,{maxConsultas:0})).status).toBe('SUMMARY_POLL_BUSY');
  finish({statusCode:'98',enProceso:true,contenido:null});await pending;
  expect(h.client.getStatus).toHaveBeenCalledTimes(1);expect(h.client.sendSummary).not.toHaveBeenCalled();
 });
 it('24 intentos sobreviven reinicios, respetan 5/15/30/60 minutos y no se rearman por consulta manual',async()=>{
  let now=Date.now()+100; jest.spyOn(Date,'now').mockImplementation(()=>now);
  for(let attempt=1;attempt<=24;attempt++){
   await service(new SummaryAggregateStore(db,queue)).procesar(h.job,{maxConsultas:0,automatico:true,sondeoIntento:attempt,ticketEsperado:'T'});
   const p=await read();expect(p.attempts).toBe(attempt);
   if(attempt<24){expect(Date.parse(p.nextAt!)-now).toBe(summaryPollDelay(attempt));
    expect((await service().procesar(h.job,{maxConsultas:0,automatico:true,sondeoIntento:attempt+1})).status).toBe('SUMMARY_POLL_NOT_DUE');now=Date.parse(p.nextAt!);
   }else{expect(p.exhausted).toBe(true);expect(p.nextAt).toBeNull();}
  }
  expect(h.client.getStatus).toHaveBeenCalledTimes(24);
  expect(await store.polling.publish(h.job)).toBe('POLL_STOPPED');
  await service().procesar(h.job,{maxConsultas:0});expect((await read()).attempts).toBe(24);expect((await read()).nextAt).toBeNull();
  expect(h.client.sendSummary).not.toHaveBeenCalled();
 });
 it('lease vencida conserva el intento consumido y programa el siguiente con cadencia',async()=>{
  let now=Date.now()+100;jest.spyOn(Date,'now').mockImplementation(()=>now);
  expect((await store.polling.claim(id,true,1,90000)).token).toBeTruthy();now+=120001;
  await store.polling.publish(h.job);const p=await read();expect(p.attempts).toBe(1);expect(Date.parse(p.nextAt!)-now).toBe(300000);
  now=Date.parse(p.nextAt!);await service().procesar(h.job,{maxConsultas:0,automatico:true,sondeoIntento:2});expect((await read()).attempts).toBe(2);
 });
 it('publicación concurrente usa agenda persistida y no crea dos jobs',async()=>{
  await db.invoiceAggregate.update({where:{id},data:{result:{polling:{attempts:3,nextAt:new Date(Date.now()+1800000).toISOString()}}}});
  const results=await Promise.all([store.polling.publish(h.job),new SummaryAggregateStore(db,queue).polling.publish(h.job)]);
  expect(results[0]).toBe(results[1]);
  const jobs=await db.$queryRaw<{n:bigint}[]>`SELECT count(*) AS n FROM pgboss.job WHERE data->>'companyId'=${company}`;expect(Number(jobs[0].n)).toBe(1);
 });
 it('adopta contador y fecha de un POLLING anterior sin reiniciarlos',async()=>{
  await db.invoiceAggregate.update({where:{id},data:{result:{}}});const due=new Date(Date.now()+1800000);
  const job=await queue.encolarResumen({...h.job,sondeoIntento:10,ticketConsulta:'T'} as never,due);
  expect(await store.polling.publish(h.job)).toBe(job);
  const p=await read();expect(p.attempts).toBe(9);expect(p.nextAt).toBe(due.toISOString());
 });
 it('legado agotado o sin historial no se convierte en presupuesto nuevo',async()=>{
  await db.invoiceAggregate.update({where:{id},data:{result:{},error:'Sondeo automático agotado tras 24 intentos.'}});
  expect(await store.polling.publish(h.job)).toBe('POLL_STOPPED');expect((await read()).attempts).toBe(24);
  await db.invoiceAggregate.update({where:{id},data:{result:{},error:null}});
  expect(await store.polling.publish(h.job)).toBe('POLL_STOPPED');expect((await read()).historyUnknown).toBe(true);
 });
 it('fallo de publicación no pierde agenda ni reinicia intentos',async()=>{
  const nextAt=new Date(Date.now()+5000).toISOString();await db.invoiceAggregate.update({where:{id},data:{result:{polling:{attempts:7,nextAt}}}});
  const broken=new SummaryAggregateStore(db,{encolarResumen:async()=>null} as never);
  await expect(broken.polling.publish(h.job)).rejects.toThrow('SUMMARY_POLL_ENQUEUE_FAILED');expect(await read()).toMatchObject({attempts:7,nextAt});
 });
});
