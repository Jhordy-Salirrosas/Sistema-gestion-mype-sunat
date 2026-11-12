import { Test } from '@nestjs/testing';
import { BadRequestException, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { InvoiceConfigController } from '../../../src/modules/invoices/infrastructure/controllers/invoiceConfigController';
import { InvoiceConfigService } from '../../../src/modules/invoices/application/services/invoiceConfigService';
import { InvoiceSeriesService } from '../../../src/modules/invoices/application/services/invoiceSeriesService';
import { TOKEN_SERVICE_PORT } from '../../../src/modules/auth/domain/ports/tokenServicePort';
import { construirWhere, normalizarPaginacion } from '../../../src/modules/invoices/application/services/invoiceQueryFilters';
it.each(['estado','tipo','serie','desde','hasta','puente_pendiente'])('rechaza filtro no escalar %s con 400', key=>{
 for(const value of [['01','03'],{},null,123])expect(()=>construirWhere('c',{[key]:value} as never)).toThrow(BadRequestException);
});
it.each([['1','20'],['2','30']])('conserva paginado válido %s/%s',(page,size)=>{expect(normalizarPaginacion(page,size)).toMatchObject({page:Number(page),page_size:Number(size)});});
it('rechaza paginado repetido con 400',()=>{expect(()=>normalizarPaginacion(['1','2'] as never,'20')).toThrow(BadRequestException);});
it('HTTP series devuelve 400 para entradas previsibles sin invocar persistencia',async()=>{
 const asegurarSerie=jest.fn(async()=>({}));
 const module=await Test.createTestingModule({controllers:[InvoiceConfigController],providers:[{provide:InvoiceConfigService,useValue:{}},{provide:InvoiceSeriesService,useValue:{asegurarSerie}},{provide:TOKEN_SERVICE_PORT,useValue:{verifyToken:()=>({role:'ADMIN',companyId:'test'})}}]}).compile();
 const app=module.createNestApplication();app.useLogger(false);app.useGlobalPipes(new ValidationPipe({transform:true,whitelist:true,forbidNonWhitelisted:true}));await app.init();
 try{
  for(const body of [{document_type:'01',series:123},{document_type:1,series:'F001'},{document_type:'01',series:'F001',correlativo_inicial:'1'}]){
   const r=await request(app.getHttpServer()).post('/api/v1/invoices/series').set('Authorization','Bearer test').send(body).expect(400);expect(r.body.message).toBeDefined();
  }
  expect(asegurarSerie).not.toHaveBeenCalled();
  await request(app.getHttpServer()).post('/api/v1/invoices/series').set('Authorization','Bearer test').send({document_type:'01',series:'F001',correlativo_inicial:0}).expect(201);
  expect(asegurarSerie).toHaveBeenCalledTimes(1);
 }finally{await app.close();}
});
