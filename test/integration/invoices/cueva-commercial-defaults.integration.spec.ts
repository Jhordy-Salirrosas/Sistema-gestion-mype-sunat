import { PrismaService } from '../../../src/database/prismaService';
import { InvoiceCommercialDefaultsService } from '../../../src/modules/invoices/application/services/invoiceCommercialDefaultsService';
import { InvoiceCommercialDefaultsController } from '../../../src/modules/invoices/infrastructure/controllers/invoiceCommercialDefaultsController';
import { TOKEN_SERVICE_PORT } from '../../../src/modules/auth/domain/ports/tokenServicePort';
import { AuthGuard } from '../../../src/modules/auth/infrastructure/guards/authGuard';
import { RolesGuard } from '../../../src/modules/auth/infrastructure/guards/rolesGuard';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { readFileSync } from 'node:fs';
const url = process.env.TEST_DATABASE_URL;
(url ? describe : describe.skip)('Configuración comercial PostgreSQL local', () => {
  let db: PrismaService; let id: string; let otra: string; let app: any;
  let role = 'ADMIN'; const old = process.env.DATABASE_URL;
  beforeAll(async () => {
    if (!url || !['localhost','127.0.0.1'].includes(new URL(url).hostname)) throw Error('Solo PostgreSQL local');
    process.env.DATABASE_URL = url; db = new PrismaService(); await db.$connect();
    // La tabla se aprovisiona por el SQL manual revisado, nunca fuera del contenedor.
    const sql = readFileSync('scripts/manual/cueva-commercial-defaults.sql','utf8');
    const create = sql.slice(sql.indexOf('CREATE TABLE'), sql.indexOf('\nCOMMIT;'));
    await db.$executeRawUnsafe(create);
    for (const prefix of ['20','21']) {
      const c = await db.company.create({data:{ruc:prefix+Date.now().toString().slice(-9),legal_name:'Empresa local',sol_user:'FAKE',sol_pass_encrypted:'fake'}});
      if (prefix === '20') id = c.id; else otra = c.id;
    }
    const module = await Test.createTestingModule({controllers:[InvoiceCommercialDefaultsController],providers:[InvoiceCommercialDefaultsService,
      {provide:PrismaService,useValue:db}, {provide:TOKEN_SERVICE_PORT,useValue:{verifyToken:()=>({sub:'local-admin',companyId:id,role})}},AuthGuard,RolesGuard]}).compile();
    app = module.createNestApplication(); app.useLogger(false); await app.init();
  });
  afterAll(async () => { if(app) await app.close(); if(db) { await db.company.deleteMany({where:{id:{in:[id,otra].filter(Boolean)}}}); await db.$disconnect(); } if(old===undefined)delete process.env.DATABASE_URL;else process.env.DATABASE_URL=old; });
  it('persiste solo en la empresa del llamante y aplica Contado sin fila',async()=>{
    const svc = new InvoiceCommercialDefaultsService(db);
    await svc.save(id,{forma_pago:'Credito',medio_pago:'YAPE'});
    expect(await svc.get(id)).toEqual({forma_pago:'Credito',medio_pago:'YAPE'});
    expect(await svc.get(otra)).toEqual({forma_pago:'Contado',medio_pago:'EFECTIVO'});
  });
  it('PUT exige ADMIN con guard real y no modifica la configuración denegada',async()=>{
    role='OPERADOR_FACTURACION';
    await request(app.getHttpServer()).put('/api/v1/invoices/commercial-defaults').set('Authorization','Bearer local').send({forma_pago:'Contado',medio_pago:'TARJETA'}).expect(403);
    expect((await new InvoiceCommercialDefaultsService(db).get(id)).medio_pago).toBe('YAPE');
    role='ADMIN';
    await request(app.getHttpServer()).put('/api/v1/invoices/commercial-defaults').set('Authorization','Bearer local').send({forma_pago:'Contado',medio_pago:'TARJETA'}).expect(200);
  });
  it('rechaza medios ajenos al catálogo',async()=>{
    role='ADMIN';await request(app.getHttpServer()).put('/api/v1/invoices/commercial-defaults').set('Authorization','Bearer local').send({forma_pago:'Contado',medio_pago:'OTRO'}).expect(400);
  });
});
