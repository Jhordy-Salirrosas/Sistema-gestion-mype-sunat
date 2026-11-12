import { Ple12_1FlatFileWriterAdapter } from '../../../src/modules/inventory/infrastructure/adapters/ple12_1FlatFileWriterAdapter';
import { Ple13_1FlatFileWriterAdapter } from '../../../src/modules/inventory/infrastructure/adapters/ple13_1FlatFileWriterAdapter';
import { PleStructureValidatorService } from '../../../src/modules/inventory/infrastructure/adapters/pleStructureValidatorService';
describe.each([['12.1',Ple12_1FlatFileWriterAdapter],['13.1',Ple13_1FlatFileWriterAdapter]] as const)('8E E1 PLE %s',(_tipo,Adapter)=>{
 it.each([['FC01','FC01-00000014','FC01','00000014'],['FC01','00000014','FC01','00000014'],[null,'FC01-00000014','-','FC01-00000014'],['FC01','OTRA-123','FC01','OTRA-123'],[null,null,'-','-']])('serie %s / número %s, sin alterar el movimiento',(serie,numero,expectedSerie,expectedNumero)=>{
  const input={periodYearMonth:'20261100',cuo:'M1',entryNumber:'M1',establishmentCode:'0000',typeCode:'01',sku:'CEM-001',documentDate:new Date('2026-11-11T12:00:00Z'),documentTypeCode:'07',documentSerial:serie,documentNumber:numero,operationTypeCode:'05',description:'Cemento',unitCode:'NIU',direction:'ENTRADA',quantity:1,unitCost:10,totalCost:10,resultingStock:1,resultingAverageCost:10,resultingTotalValue:10,valuationMethodCode:'2'};
  const before=JSON.stringify(input);const result=new Adapter(new PleStructureValidatorService()).generate('20000000001',2026,[input] as never);const fields=result.content.split('|');expect(fields[10]).toBe(expectedSerie);expect(fields[11]).toBe(expectedNumero);expect(JSON.stringify(input)).toBe(before);
 });
});
