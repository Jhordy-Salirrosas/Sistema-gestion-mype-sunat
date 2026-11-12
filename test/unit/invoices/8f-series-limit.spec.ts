import { InvoiceConfigController } from '../../../src/modules/invoices/infrastructure/controllers/invoiceConfigController';
import { validarSerieNoAgotada } from '../../../src/modules/invoices/application/services/invoiceSeriesService';
import { validate } from 'class-validator';
import { AltaSerieDto } from '../../../src/modules/invoices/application/dto/altaSerieDto';
it('vista previa no anuncia un noveno dígito',async()=>{
 const c=new InvoiceConfigController({} as never,{listar:async()=>[{document_type:'01',series:'F001',current_correlative:99999999,is_active:true}]} as never);
 await expect(c.siguienteCorrelativo('c','01','F001')).rejects.toThrow('SERIE_AGOTADA');
});
it('permite la última vista previa válida',async()=>{
 const c=new InvoiceConfigController({} as never,{listar:async()=>[{document_type:'01',series:'F001',current_correlative:99999998,is_active:true}]} as never);
 expect(await c.siguienteCorrelativo('c','01','F001')).toMatchObject({siguiente:99999999});expect(()=>validarSerieNoAgotada(99999998)).not.toThrow();
});
it('DTO rechaza inicial de nueve dígitos',async()=>{
 const dto=Object.assign(new AltaSerieDto(),{document_type:'01',series:'F001',correlativo_inicial:100000000});
 expect(await validate(dto)).toEqual(expect.arrayContaining([expect.objectContaining({property:'correlativo_inicial'})]));
});
