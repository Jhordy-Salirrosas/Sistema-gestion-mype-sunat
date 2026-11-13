import { Test } from '@nestjs/testing';
import request from 'supertest';
import { Reflector } from '@nestjs/core';
import { ValidationPipe, ForbiddenException } from '@nestjs/common';
import { TOKEN_SERVICE_PORT } from '../../../src/modules/auth/domain/ports/tokenServicePort';
import { RolesGuard } from '../../../src/modules/auth/infrastructure/guards/rolesGuard';
import { InvoicesController } from '../../../src/modules/invoices/infrastructure/controllers/invoicesController';
import { WarehouseAccessService } from '../../../src/modules/auth/application/services/warehouseAccessService';
import { InvoiceQueryController } from '../../../src/modules/invoices/infrastructure/controllers/invoiceQueryController';
import { InvoiceSunatConsultController } from '../../../src/modules/invoices/infrastructure/controllers/invoiceSunatConsultController';
import { InvoiceDetractionController } from '../../../src/modules/invoices/infrastructure/controllers/invoiceDetractionController';
import { AtomicInvoiceCreationService } from '../../../src/modules/invoices/application/services/atomicInvoiceCreationService';
import { traducirEmision } from '../../../src/modules/invoices/application/services/emitirComprobanteAdapter';
import { issuer8d } from '../../fixtures/8dFiscalHarness';
const mutations = [[InvoicesController,'create'],[InvoicesController,'emitir'],[InvoiceQueryController,'notaCredito'],[InvoiceQueryController,'notaDebito'],[InvoiceQueryController,'consultarAgregado'],[InvoiceSunatConsultController,'consultar'],[InvoiceDetractionController,'deposit']] as const;
it.each(mutations)('protege %s.%s con los roles operativos', (controller, method) => {
 const guard=new RolesGuard(new Reflector());
 for(const role of ['ADMIN','OPERADOR_FACTURACION','AUDITOR','CONTADOR']) {
  const ctx={getHandler:()=>controller.prototype[method],getClass:()=>controller,switchToHttp:()=>({getRequest:()=>({user:{role}})})} as never;
  if(['ADMIN','OPERADOR_FACTURACION'].includes(role))expect(guard.canActivate(ctx)).toBe(true);else expect(()=>guard.canActivate(ctx)).toThrow(ForbiddenException);
 }
});
it('el auditor conserva lectura y vista previa de baja',()=>{
 const guard=new RolesGuard(new Reflector());
 for(const method of ['listar','detalle','vistaSeleccionBaja']) {
  const handler=InvoiceQueryController.prototype[method];expect(handler).toBeDefined();
  expect(guard.canActivate({getHandler:()=>handler,getClass:()=>InvoiceQueryController,switchToHttp:()=>({getRequest:()=>({user:{role:'AUDITOR'}})})} as never)).toBe(true);
 }
});
const dto={tipo_comprobante:'01',serie:'F001',fecha_emision:'2026-11-12',forma_pago:'Contado',customer_identity_type:'6',customer_identity_number:'20100070970',customer_legal_name:'Cliente ficticio',items:[{descripcion:'Bien ficticio',cantidad:1,unidad:'NIU',afectacion:'10',precioUnitario:118}]};
it.each(['ADMIN','OPERADOR_FACTURACION','AUDITOR'])('HTTP ambas creaciones para %s',async role=>{
 const service={emitir:jest.fn(async()=>({id:'fake',estado:'EN_COLA'})),create:jest.fn(async()=>({id:'fake',estado:'EN_COLA'}))};
 const module=await Test.createTestingModule({controllers:[InvoicesController],providers:[{provide:AtomicInvoiceCreationService,useValue:service},{provide:WarehouseAccessService,useValue:{assertWarehouse:jest.fn()}},{provide:TOKEN_SERVICE_PORT,useValue:{verifyToken:()=>({sub:'test',companyId:'fake',role})}}]}).compile();
 const app=module.createNestApplication();app.useLogger(false);app.useGlobalPipes(new ValidationPipe({transform:true,whitelist:true,forbidNonWhitelisted:true}));await app.init();
 try {
  const fiscal=traducirEmision(dto as never,issuer8d,1).dto;
  await request(app.getHttpServer()).post('/api/v1/invoices/emitir').set('Authorization','Bearer fake').send(dto).expect(role==='AUDITOR'?403:201);
  await request(app.getHttpServer()).post('/api/v1/invoices').set('Authorization','Bearer fake').send(fiscal).expect(role==='AUDITOR'?403:202);
  expect(service.emitir).toHaveBeenCalledTimes(role==='AUDITOR'?0:1);expect(service.create).toHaveBeenCalledTimes(role==='AUDITOR'?0:1);
 }finally{await app.close();}
});

it.each(['ADMIN','OPERADOR_FACTURACION','AUDITOR'])('HTTP notas de crédito/débito para %s',async role=>{
 const calls={autorizarCredito:jest.fn(async()=>({ok:true})),autorizarDebito:jest.fn(async()=>({ok:true}))};
 const tokens=Reflect.getMetadata('design:paramtypes',InvoiceQueryController) as Function[];
 const providers=tokens.map(provide=>({provide,useValue:calls}));
 const module=await Test.createTestingModule({controllers:[InvoiceQueryController],providers:[...providers,{provide:TOKEN_SERVICE_PORT,useValue:{verifyToken:()=>({sub:'test',companyId:'fake',role})}}]}).compile();
 const app=module.createNestApplication();app.useLogger(false);await app.init();
 try{
  for(const suffix of ['notas-credito','notas-debito'])await request(app.getHttpServer()).post('/api/v1/invoices/fake/'+suffix).set('Authorization','Bearer fake').send({motivo:'06'}).expect(role==='AUDITOR'?403:201);
  expect(calls.autorizarCredito).toHaveBeenCalledTimes(role==='AUDITOR'?0:1);expect(calls.autorizarDebito).toHaveBeenCalledTimes(role==='AUDITOR'?0:1);
 }finally{await app.close();}
});
import { InvoiceDownloadService } from '../../../src/modules/invoices/application/services/invoiceDownloadService';
it('lectura auditora no firma ni persiste XML ausente',async()=>{
 const service=Object.create(InvoiceDownloadService.prototype);service.cargar=jest.fn(async()=>({xml_storage_url:null}));service.xml=jest.fn();
 await expect(service.descargar('c','i','xml',undefined,false)).rejects.toThrow('no regenera ni persiste');expect(service.xml).not.toHaveBeenCalled();
});
it('lectura auditora conserva descarga de XML firmado guardado',async()=>{
 const service=Object.create(InvoiceDownloadService.prototype);service.cargar=jest.fn(async()=>({xml_storage_url:'<?xml version="1.0"?><Invoice/>'}));service.xml=jest.fn(async()=>({contenido:'guardado'}));
 expect(await service.descargar('c','i','xml',undefined,false)).toEqual({contenido:'guardado'});
});
