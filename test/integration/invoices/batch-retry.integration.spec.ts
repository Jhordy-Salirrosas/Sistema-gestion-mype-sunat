import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { InvoiceBatchRetryController } from '../../../src/modules/invoices/infrastructure/controllers/invoiceBatchRetryController';
import { TOKEN_SERVICE_PORT } from '../../../src/modules/auth/domain/ports/tokenServicePort';
import { AuthGuard } from '../../../src/modules/auth/infrastructure/guards/authGuard';
import { RolesGuard } from '../../../src/modules/auth/infrastructure/guards/rolesGuard';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../../../src/database/prismaService';
import { QueueService, INVOICE_QUEUE, INVOICE_DLQ } from '../../../src/modules/resilience/infrastructure/queue/queue.service';
import { InvoiceBatchRetryService } from '../../../src/modules/invoices/application/services/invoiceBatchRetryService';
const url=process.env.TEST_DATABASE_URL;
(url?describe:describe.skip)('reintento masivo con PostgreSQL y singleton real, sin consumidor ni SUNAT',()=>{
 let db:PrismaService,queue:QueueService,boss:any,company:string,otra:string;let app:INestApplication;const ids:string[]=[];const oldDb=process.env.DATABASE_URL,oldBoss=process.env.PG_BOSS_URL;
 beforeAll(async()=>{
  if(!url || !['localhost','127.0.0.1'].includes(new URL(url).hostname))throw Error('Solo PostgreSQL local');
  process.env.DATABASE_URL=url;process.env.PG_BOSS_URL=url;db=new PrismaService();await db.$connect();queue=new QueueService();await queue.onModuleInit();boss=(queue as any).boss;
  company=(await db.company.create({data:{ruc:`20${Date.now().toString().slice(-9)}`,legal_name:'Prueba local de lote',sol_user:'FAKE',sol_pass_encrypted:'obviously-fake'}})).id;
  otra=(await db.company.create({data:{ruc:`21${Date.now().toString().slice(-9)}`,legal_name:'Otra empresa local',sol_user:'FAKE',sol_pass_encrypted:'obviously-fake'}})).id;
  for(const [i,estado,incierto] of [[0,'ERROR_RED',false],[1,'ERROR_RED',true],[2,'RECHAZADO',false],[3,'ERROR_RED',false],[4,'ERROR_RED',false]] as const){
   const id=randomUUID();ids.push(id);await db.invoice.create({data:{id,company_id:i===4?otra:company,ruc_emisor:'20000000001',tipo_comprobante:'01',serie:'F001',correlativo:i+1,estado,fecha_emision:new Date('2026-11-13'),monto_total:118,payload_ubl:{},transport_uncertain:incierto,...(i===2?{cdr_sunat:{responseCode:'3105',description:'Rechazo de prueba'}}:{})}});
  }
  await db.transactionHistory.create({data:{company_id:company,invoice_id:ids[3],estado_anterior:'PENDIENTE',estado_nuevo:'ERROR_RED',intento:1,codigo_error:'M1_PREPARATION_DATOS_INVALIDOS',mensaje_error:JSON.stringify({recuperable:false,causa:'Datos inválidos'})}});
  const module=await Test.createTestingModule({controllers:[InvoiceBatchRetryController],providers:[
    {provide:InvoiceBatchRetryService,useValue:new InvoiceBatchRetryService(db,queue)},
    {provide:TOKEN_SERVICE_PORT,useValue:{verifyToken:()=>({companyId:company,role:'ADMIN'})}},AuthGuard,RolesGuard,
  ]}).compile();
  app=module.createNestApplication();app.useLogger(false);await app.init();

 },30000);
 afterAll(async()=>{
  if(boss)for(const id of ids)for(const name of [INVOICE_QUEUE,INVOICE_DLQ]){const jobs=await boss.findJobs(name,{data:{invoice_id:id}});if(jobs.length)await boss.deleteJob(name,jobs.map((j:any)=>j.id));}
  if(db){await db.transactionHistory.deleteMany({where:{company_id:{in:[company,otra].filter(Boolean)}}});await db.invoice.deleteMany({where:{id:{in:ids}}});await db.company.deleteMany({where:{id:{in:[company,otra].filter(Boolean)}}});}
  if(app)await app.close();if(queue)await queue.onModuleDestroy();if(db)await db.$disconnect();
  if(oldDb===undefined)delete process.env.DATABASE_URL;else process.env.DATABASE_URL=oldDb;
  if(oldBoss===undefined)delete process.env.PG_BOSS_URL;else process.env.PG_BOSS_URL=oldBoss;
 },30000);
 it('dos solicitudes concurrentes publican solo un job; incertidumbre, SUNAT, datos y otro tenant quedan fuera',async()=>{
  const service=new InvoiceBatchRetryService(db,queue);
  const previa=await service.ejecutar(company,true);expect(previa).toMatchObject({elegibles:1,omitidos_incertidumbre:1,omitidos_rechazo_definitivo:1,omitidos_bloqueo_local:1});
  const post=()=>request(app.getHttpServer()).post('/api/v1/invoices/retry-batch').set('Authorization','Bearer local-admin').expect(200);
  const respuestas=await Promise.all([post(),post()]);const resultados=respuestas.map(r=>r.body);
  expect(resultados.reduce((s,r)=>s+r.encolados,0)).toBe(1);
  expect(await boss.findJobs(INVOICE_QUEUE,{data:{invoice_id:ids[0]},queued:true})).toHaveLength(1);
  for(const id of ids.slice(1))expect(await boss.findJobs(INVOICE_QUEUE,{data:{invoice_id:id},queued:true})).toHaveLength(0);
  expect((await db.invoice.findUniqueOrThrow({where:{id:ids[1]}})).transport_uncertain).toBe(true);
  expect((await service.ejecutar(company)).encolados).toBe(0);
 });
 it('un POST posterior tampoco duplica el job ya reclamado por el worker antes de actualizar Invoice',async()=>{
  const service=new InvoiceBatchRetryService(db,queue);
  await service.ejecutar(company);
  const [job]=await boss.findJobs(INVOICE_QUEUE,{data:{invoice_id:ids[0]},queued:true});
  // Simula solo el claim del worker en PostgreSQL local, sin consumidor ni transporte.
  await db.$executeRaw`UPDATE pgboss.job SET state='active',started_on=now() WHERE name=${INVOICE_QUEUE} AND id=${job.id}::uuid`;
  expect(await boss.findJobs(INVOICE_QUEUE,{data:{invoice_id:ids[0]},queued:true})).toHaveLength(0);
  expect((await db.invoice.findUniqueOrThrow({where:{id:ids[0]}}))).toMatchObject({estado:'ERROR_RED',transport_uncertain:false});
  const {body:r}=await request(app.getHttpServer()).post('/api/v1/invoices/retry-batch').set('Authorization','Bearer local-admin').expect(200);
  expect(r.encolados).toBe(0);expect(r.ya_en_cola).toBe(1);
  const vivos=(await boss.findJobs(INVOICE_QUEUE,{data:{invoice_id:ids[0]}})).filter((j:any)=>['created','retry','active'].includes(j.state));
  expect(vivos).toHaveLength(1);expect(vivos[0].state).toBe('active');
 });

});
