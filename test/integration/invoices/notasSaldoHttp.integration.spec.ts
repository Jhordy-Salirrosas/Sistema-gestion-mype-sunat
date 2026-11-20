import { execFileSync, spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { Client } from 'pg';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { fakeFiscalAddress } from '../../fixtures/fakeFiscalAddress';
import { fakeIssuerCertificate } from '../../fixtures/fakeIssuerCertificate';

const url = process.env.TEST_DATABASE_URL;
const cases = ['07', '08'].flatMap(tipo => ['pantalla', 'fiscal'].map(route => ({ tipo, route })));
(url ? describe : describe.skip)('Notas: HTTP completo sobre build ES2023 y PostgreSQL local', () => {
  let db: any, app: any, queue: any, actor: any, token: string, company: string;
  let translate: any, today: () => string;
  let databaseName: string;
  let consumer: any;
  const original = { DATABASE_URL: process.env.DATABASE_URL, PG_BOSS_URL: process.env.PG_BOSS_URL, CERT_BASE64: process.env.CERT_BASE64, CERT_PASSWORD: process.env.CERT_PASSWORD };
  jest.setTimeout(120000);
  beforeAll(async () => {
    if (!url || !['localhost','127.0.0.1'].includes(new URL(url).hostname)) throw Error('Solo PostgreSQL local de pruebas');
    // CI construye antes de Jest. Este archivo ejercita deliberadamente el
    // build de producción (class fields ES2023), no el transform ES2021 de Jest.
    const root = resolve(__dirname, '../../..');
    if (process.env.CI !== 'true') execFileSync(process.execPath, [resolve(root,'node_modules/@nestjs/cli/bin/nest.js'),'build'], { cwd: root, stdio: 'pipe', timeout: 90000 });
    // Base aislada por corrida para no competir con otras integraciones de CI.
    databaseName = `notas_http_${process.pid}_${randomUUID().replace(/-/g,'').slice(0,12)}`;
    const admin = new Client({ connectionString: url }); await admin.connect();
    try { await admin.query(`CREATE DATABASE "${databaseName}"`); } finally { await admin.end(); }
    const isolated = new URL(url); isolated.pathname = '/' + databaseName;
    process.env.DATABASE_URL = isolated.toString(); process.env.PG_BOSS_URL = isolated.toString();
    execFileSync(process.execPath, [resolve(root,'node_modules/prisma/build/index.js'),'migrate','deploy'], { cwd: root, stdio:'pipe', timeout:90000, env:{...process.env,DIRECT_URL:isolated.toString()} });
    const load = (path: string) => require(resolve(__dirname, '../../../dist', path));
    const { AppModule } = load('appModule.js');
    const { PrismaService } = load('database/prismaService.js');
    const { InvoiceJobConsumer } = load('modules/invoices/invoiceJobConsumer.js');
    const { SummaryJobConsumer } = load('modules/invoices/summaryJobConsumer.js');
    const { QueueService } = load('modules/resilience/infrastructure/queue/queue.service.js');
    const { RucConsultaService } = load('modules/sunat/rucConsultaService.js');
    const { TOKEN_SERVICE_PORT } = load('modules/auth/domain/ports/tokenServicePort.js');
    const { applyGlobalValidation } = load('main.js');
    const { HttpExceptionFilter } = load('common/filters/httpExceptionFilter.js');
    translate = load('modules/invoices/application/services/emitirComprobanteAdapter.js').traducirEmision;
    today = load('modules/invoices/fiscalDate.js').fechaFiscalLima;
    // Prerrequisitos aditivos ya entregados, solo en PostgreSQL local. No
    // dependemos de una base compartida ni cambiamos los guards de la app.
    const pg = new Client({ connectionString: process.env.DATABASE_URL }); await pg.connect();
    try { if (!(await pg.query("SELECT to_regclass('public.company_roles') AS table_name")).rows[0].table_name) await pg.query(readFileSync('scripts/manual/roles-administrables-expansion.sql','utf8')); }
    finally { await pg.end(); }
    process.env.CERT_BASE64 = fakeIssuerCertificate().p12();
    process.env.CERT_PASSWORD = 'obviously-fake-password';
    // Se detiene solo el registro automático de la cola, no la preparación.
    const workerInit = jest.spyOn(InvoiceJobConsumer.prototype, 'onModuleInit').mockResolvedValue(undefined);
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(SummaryJobConsumer).useValue({ onModuleInit: () => undefined })
      .overrideProvider(RucConsultaService).useValue({consultar: async () => null})
      .compile();
    app = module.createNestApplication(); app.useLogger(false);
    applyGlobalValidation(app); app.useGlobalFilters(new HttpExceptionFilter());
    try { await app.init(); } finally { workerInit.mockRestore(); }
    consumer = app.get(InvoiceJobConsumer); db = app.get(PrismaService); queue = app.get(QueueService);
    actor = app.get(TOKEN_SERVICE_PORT);
  });
  beforeEach(async () => {
    company = randomUUID();
    await db.company.create({ data: { id: company, ruc:'20000000001',issuer_ruc:'20000000001',legal_name:'Emisor HTTP local',sunat_issuer_username:'FAKE',sunat_issuer_password_enc:'fake',...fakeFiscalAddress } });
    await db.companyRole.create({data:{company_id:company,code:'ADMIN',name:'Administrador',is_system:true}});
    const user = await db.user.create({data:{company_id:company,email:`${company}@example.invalid`,password_hash:'not-a-login-password',full_name:'Actor de pruebas',role:'ADMIN'}});
    token = actor.signToken({sub:user.id,email:user.email,companyId:company,role:'ADMIN'});
    await db.inventoryWarehouse.create({data:{company_id:company,warehouse_code:'ALM-01',description:'Local'}});
    await db.inventoryProduct.create({data:{company_id:company,sku:'SERV',description:'Servicio',is_inventory:false,sale_price:118,tax_affectation:'10',sunat_unit_code:'NIU'}});
    await db.invoice.create({data:{company_id:company,ruc_emisor:'20000000001',tipo_comprobante:'01',serie:'F001',correlativo:1,fecha_emision:new Date(today()),monto_total:118,estado:'ACEPTADO',customer_identity_type:'6',customer_identity_number:'20100070970',payload_ubl:{},items:{create:[{item_order:1,item_code:'SERV',description:'Servicio',quantity:1,unit_value:100,unit_price:118,unit_code:'NIU',igv_affectation_type:'10',igv_amount:18,total_amount:118}]}}});
    for(const [type,serie] of [['07','FC01'],['08','FD01']])await db.invoiceSeries.create({data:{company_id:company,document_type:type,series:serie}});
  });
  afterEach(async () => {
    if (!company || !db) return;
    const rows = await db.invoice.findMany({where:{company_id:company},select:{id:true}});
    const boss = queue.boss;
    for (const {id} of rows) for (const name of ['sunat-invoice-queue','sunat-invoice-dlq']) {
      const jobs = await boss.findJobs(name,{data:{invoice_id:id}}); if(jobs.length)await boss.deleteJob(name,jobs.map((job:any)=>job.id));
    }
    await db.invoiceCreationRequest.deleteMany({where:{company_id:company}});
    await db.invoice.deleteMany({where:{company_id:company,referenced_invoice_id:{not:null}}});
    await db.invoice.deleteMany({where:{company_id:company}});
    await db.invoiceSeries.deleteMany({where:{company_id:company}});
    await db.inventoryProduct.deleteMany({where:{company_id:company}});
    await db.inventoryWarehouse.deleteMany({where:{company_id:company}});
    await db.user.deleteMany({where:{company_id:company}});
    await db.company.delete({where:{id:company}}); company='';
  });
  afterAll(async()=>{if(app)await app.close();if(db)await db.$disconnect();if(databaseName){const admin=new Client({connectionString:url});await admin.connect();try{await admin.query(`DROP DATABASE "${databaseName}" WITH (FORCE)`);}finally{await admin.end();}}for(const [key,value] of Object.entries(original)) {if(value===undefined)delete process.env[key];else process.env[key]=value;}});
  function bodyFor(tipo:string, route:string, amount:number, total=false) {
    const input = {tipo_comprobante:tipo,serie:tipo==='07'?'FC01':'FD01',fecha_emision:today(),forma_pago:'Contado',customer_identity_type:'6',customer_identity_number:'20100070970',customer_legal_name:'Cliente',documento_afectado:'F001-00000001',codigo_motivo_nota:tipo==='08'?'02':total?'06':'04',items:[{codigo:'SERV',descripcion:'Servicio',cantidad:1,precioUnitario:amount,unidad:'NIU',afectacion:'10'}]};
    return route==='pantalla'?input:translate(input,{ruc:'20000000001',razonSocial:'Emisor HTTP local'},1).dto;
  }
  function post(route:string, body:any, key=randomUUID()) {return request(app.getHttpServer()).post(`/api/v1/invoices${route==='pantalla'?'/emitir':''}`).set('Authorization',`Bearer ${token}`).set('Idempotency-Key',key).send(body);}
  it.each(cases)('$tipo $route: parcial, total restante, snapshot, reintento y exceso',async({tipo,route})=>{
    const body=bodyFor(tipo,route,35.4);expect(body).not.toHaveProperty('saldoNotaCalculado');
    const key=randomUUID();const first=await post(route,body,key);expect(first.status).toBe(route==='pantalla'?201:202);
    expect((await post(route,body,key)).body.id).toBe(first.body.id);
    const stored=await db.invoice.findUniqueOrThrow({where:{id:first.body.id}});
    expect(stored.payload_ubl.m1NoteBalance).toEqual({antes:118,importe:35.4,restante:82.6});
    const second=await post(route,bodyFor(tipo,route,82.6,true));expect(second.status).toBe(route==='pantalla'?201:202);
    expect((await db.invoice.findUniqueOrThrow({where:{id:second.body.id}})).payload_ubl.m1NoteBalance).toEqual({antes:82.6,importe:82.6,restante:0});
    expect((await post(route,bodyFor(tipo,route,0.01))).status).toBe(409);
    expect(await db.invoice.count({where:{company_id:company,tipo_comprobante:tipo}})).toBe(2);
    expect((await db.invoiceSeries.findFirstOrThrow({where:{company_id:company,document_type:tipo}})).current_correlative).toBe(2);
  });
  it.each(cases)('$tipo $route: total inicial por HTTP sin saldo calculado en el cuerpo',async({tipo,route})=>{
    const response=await post(route,bodyFor(tipo,route,118,true));expect(response.status).toBe(route==='pantalla'?201:202);
    expect((await db.invoice.findUniqueOrThrow({where:{id:response.body.id}})).payload_ubl.m1NoteBalance).toEqual({antes:118,importe:118,restante:0});
  });
  it.each(cases)('$tipo $route: preparación del build con firma, XSD y XSL reales, sin transporte', async ({tipo, route}) => {
    const response = await post(route, bodyFor(tipo, route, 10));
    expect(response.status).toBe(route === 'pantalla' ? 201 : 202);
    let prepared;
    try { prepared = await consumer.preparar(response.body.id); }
    catch (error) {
      // Solo fixtures locales: ejecutar sin el catch sanitizado del protocolo
      // permite ver el error real de Python/libxslt en stderr si vuelve a fallar.
      const failed = await db.invoice.findUniqueOrThrow({ where: { id: response.body.id } });
      const diagnostic = spawnSync(process.env.SUNAT_SFS_PYTHON ?? 'python3', ['-c',
        "import json,sys; sys.path.insert(0,'scripts/m1'); from validate_sfs import validar; print(json.dumps(validar(json.load(sys.stdin))))"],
      { input: JSON.stringify({ xml: failed.xml_storage_url, tipo }), encoding: 'utf8', timeout: 20000,
        env: { ...process.env, PYTHONDONTWRITEBYTECODE: '1' } });
      throw new Error(`Preparación local ${tipo}: ${String(error)}; stderr del validador: ${diagnostic.stderr}`, { cause: error });
    }
    expect(prepared).toMatchObject({ firmado: true, bloqueoXsl: null, omitidaPorDemo: false });
    const stored = await db.invoice.findUniqueOrThrow({ where: { id: response.body.id } });
    expect(stored.xml_storage_url).toContain('<ds:Signature');
    expect(stored.xml_hash_sha256).toMatch(/^[a-f0-9]{64}$/);
    expect(stored.payload_ubl.m1NoteBalance).toEqual({ antes: 118, importe: 10, restante: 108 });
  });
  it.each(['07', '08'])('%s: historial conserva fallo real de arranque y permite preparar al recuperarse', async tipo => {
    const response = await post('pantalla', bodyFor(tipo, 'pantalla', 10));
    expect(response.status).toBe(201);
    const python = process.env.SUNAT_SFS_PYTHON;
    try {
      process.env.SUNAT_SFS_PYTHON = '/no-existe/python-sfs-prueba';
      await expect(consumer.procesar({ invoice_id: response.body.id })).rejects.toMatchObject({ name: 'ErrorValidacionBloqueada' });
      const history = await db.transactionHistory.findFirstOrThrow({ where: {
        invoice_id: response.body.id, codigo_error: 'M1_PREPARATION_INFRAESTRUCTURA',
      } });
      const cause = JSON.parse(history.mensaje_error);
      expect(cause).toMatchObject({ etapa: 'VALIDACION_LOCAL', recuperable: true,
        causa: 'No se pudo completar la preparación local; revise la infraestructura y reintente.',
        detalleDiagnostico: { claseError: 'ErrorValidacionBloqueada', motivo: 'Ejecutor Python SFS no disponible' } });
      expect(JSON.stringify(cause)).not.toContain('/no-existe');
      expect((await db.invoice.findUniqueOrThrow({ where: { id: response.body.id } })).estado).toBe('ERROR_RED');
    } finally { if (python === undefined) delete process.env.SUNAT_SFS_PYTHON; else process.env.SUNAT_SFS_PYTHON = python; }
    expect(await consumer.preparar(response.body.id)).toMatchObject({ firmado: true, bloqueoXsl: null, omitidaPorDemo: false });
  });
  it.each(['pantalla','fiscal'])('%s: rechaza saldo falsificado y campos arbitrarios sin numerar',async route=>{
    for(const field of ['saldoNotaCalculado','campoNoDeclarado']) {
      const response=await post(route,{...bodyFor('08',route,35.4),[field]:{antes:999,importe:1,restante:998}});
      expect(response.status).toBe(400);expect(JSON.stringify(response.body)).toContain(field);
    }
    expect(await db.invoice.count({where:{company_id:company}})).toBe(1);
    expect((await db.invoiceSeries.findMany({where:{company_id:company}})).every((s:any)=>s.current_correlative===0)).toBe(true);
  });
});
