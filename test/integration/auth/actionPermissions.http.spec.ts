import request from 'supertest';
import { AuthController } from '../../../src/modules/auth/infrastructure/controllers/authController';
import { InvoicesController } from '../../../src/modules/invoices/infrastructure/controllers/invoicesController';
import { InvoiceForcedResendController } from '../../../src/modules/invoices/infrastructure/controllers/invoiceForcedResendController';
import { InvoiceBridgeReprocessController } from '../../../src/modules/invoices/infrastructure/controllers/invoiceBridgeReprocessController';
import { InvoiceQueryController } from '../../../src/modules/invoices/infrastructure/controllers/invoiceQueryController';
import { AtomicInvoiceCreationService } from '../../../src/modules/invoices/application/services/atomicInvoiceCreationService';
import { InvoiceForcedResendService } from '../../../src/modules/invoices/application/services/invoiceForcedResendService';
import { InvoiceBridgeCoordinatorService } from '../../../src/modules/invoices/application/services/invoiceBridgeCoordinatorService';
import { InvoiceQueryService } from '../../../src/modules/invoices/application/services/invoiceQueryService';
import { WarehouseAccessService } from '../../../src/modules/auth/application/services/warehouseAccessService';
import { permissionsHttpApp,permissionsPrisma } from '../../fixtures/authPermissionsHttpHarness';
import { fechaFiscalLima } from '../../../src/modules/invoices/fiscalDate';
import type { INestApplication } from '@nestjs/common';

let app:INestApplication;let db:ReturnType<typeof permissionsPrisma>;
const creation={create:jest.fn(async()=>({id:'i',estado:'PENDIENTE',created_at:new Date()})),emitir:jest.fn(async()=>({numero:'F001-1'}))};
const forced={autorizar:jest.fn(async()=>({ok:true}))},bridge={reprocesar:jest.fn(async()=>({ok:true}))},queries={resolverDlqAceptado:jest.fn(async()=>({ok:true}))};
beforeAll(async()=>{db=permissionsPrisma();({app}=await permissionsHttpApp([AuthController,InvoicesController,InvoiceForcedResendController,InvoiceBridgeReprocessController,InvoiceQueryController],db.prisma,[
 {provide:AtomicInvoiceCreationService,useValue:creation},{provide:WarehouseAccessService,useValue:{assertWarehouse:jest.fn(async()=>undefined)}},
 {provide:InvoiceForcedResendService,useValue:forced},{provide:InvoiceBridgeCoordinatorService,useValue:bridge},{provide:InvoiceQueryService,useValue:queries},
]));});
afterAll(async()=>app?.close());beforeEach(()=>{db.actions.length=0;jest.clearAllMocks();});
const auth=(role='operator')=>`Bearer ${role}`;
// Los cuerpos válidos conservan los DTO de producción; se aísla solo el servicio de emisión.
const emitir=(fecha:any=fechaFiscalLima())=>({tipo_comprobante:'01',serie:'F001',fecha_emision:fecha,forma_pago:'Contado',customer_identity_type:'6',customer_identity_number:'20100070970',customer_legal_name:'Cliente',items:[{codigo:'P',descripcion:'Producto',unidad:'NIU',cantidad:1,precioUnitario:118,afectacion:'10'}]});
const fiscal=()=>({ruc_emisor:'20601234567',tipo_comprobante:'01',serie:'F001',correlativo:1,monto_total:118,fecha_emision:fechaFiscalLima(),payload_ubl:{}});
it('me entrega cuatro acciones efectivas sin permitir administrar a otro rol',async()=>{
 const response=await request(app.getHttpServer()).get('/api/v1/auth/action-permissions/me').set('Authorization',auth()).expect(200);
 expect(response.body).toHaveLength(4);expect(response.body.find(r=>r.actionCode==='INVOICE_EDIT_ISSUE_DATE').allowed).toBe(false);
 await request(app.getHttpServer()).get('/api/v1/auth/action-permissions').set('Authorization',auth()).expect(403);
 await request(app.getHttpServer()).put('/api/v1/auth/action-permissions').set('Authorization',auth()).send([]).expect(403);
 await request(app.getHttpServer()).get('/api/v1/auth/action-permissions/me').expect(401);
});
it('ADMIN configura la matriz solo en su empresa y rechaza allowed no booleano',async()=>{
 const response=await request(app.getHttpServer()).get('/api/v1/auth/action-permissions').set('Authorization',auth('admin')).expect(200);expect(response.body).toHaveLength(20);
 await request(app.getHttpServer()).put('/api/v1/auth/action-permissions').set('Authorization',auth('admin')).send([{role:'OPERADOR_FACTURACION',actionCode:'INVOICE_EDIT_ISSUE_DATE',allowed:true,company_id:'otra'}]).expect(200);
 expect(db.actions[0].company_id).toBe('empresa');
 const other=await request(app.getHttpServer()).get('/api/v1/auth/action-permissions/me').set('Authorization',auth('other')).expect(200);
 expect(other.body.find(r=>r.actionCode==='INVOICE_EDIT_ISSUE_DATE').allowed).toBe(false);
 await request(app.getHttpServer()).put('/api/v1/auth/action-permissions').set('Authorization',auth('admin')).send([{role:'ADMIN',actionCode:'INVOICE_FORCE_RESEND',allowed:'false'}]).expect(400);
});
it.each(['/api/v1/invoices/emitir','/api/v1/invoices'])('%s rechaza fecha distinta antes de crear o reservar y conserva hoy',async path=>{
 const body=path.endsWith('/emitir')?emitir():fiscal();body.fecha_emision='2020-01-01';
 const denied=await request(app.getHttpServer()).post(path).set('Authorization',auth()).send(body).expect(403);
 expect(denied.body).toMatchObject({code:'ACTION_PERMISSION_DENIED',action:'INVOICE_EDIT_ISSUE_DATE'});expect(creation.create).not.toHaveBeenCalled();expect(creation.emitir).not.toHaveBeenCalled();
 body.fecha_emision=fechaFiscalLima();await request(app.getHttpServer()).post(path).set('Authorization',auth()).send(body).expect(path.endsWith('/emitir')?201:202);
});
it('fecha omitida no exige acción y una autorización explícita permite fecha distinta',async()=>{
 const body=emitir();delete (body as any).fecha_emision;
 await request(app.getHttpServer()).post('/api/v1/invoices/emitir').set('Authorization',auth()).send(body).expect(201);
 db.actions.push({company_id:'empresa',role:'OPERADOR_FACTURACION',action_code:'INVOICE_EDIT_ISSUE_DATE',allowed:true});
 await request(app.getHttpServer()).post('/api/v1/invoices/emitir').set('Authorization',auth()).send(emitir('2020-01-01')).expect(201);
});
it.each([
 ['forzar-reenvio','INVOICE_FORCE_RESEND','admin'],['resolver-dlq','INVOICE_RESOLVE_DLQ','operator'],['reprocesar-puente','INVOICE_REPROCESS_BRIDGE','admin'],
])('%s requiere la acción además del rol vigente',async(path,action,role)=>{
 await request(app.getHttpServer()).post(`/api/v1/invoices/i/${path}`).set('Authorization',auth(role)).send({}).expect(path==='resolver-dlq'?201:200);
 db.actions.push({company_id:'empresa',role:role==='admin'?'ADMIN':'OPERADOR_FACTURACION',action_code:action,allowed:false});
 await request(app.getHttpServer()).post(`/api/v1/invoices/i/${path}`).set('Authorization',auth(role)).send({}).expect(403);
 db.actions.push({company_id:'empresa',role:'AUDITOR',action_code:action,allowed:true});
 await request(app.getHttpServer()).post(`/api/v1/invoices/i/${path}`).set('Authorization',auth('auditor')).send({}).expect(403);
});
