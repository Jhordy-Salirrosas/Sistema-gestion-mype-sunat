import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { AFECTACIONES_GRATUITAS } from '../../../src/modules/invoices/sunatCatalogs';
import { base, harness } from '../../fixtures/noteCreationHarness';
import { traducirEmision } from '../../../src/modules/invoices/application/services/emitirComprobanteAdapter';
import { fiscalToEmission } from '../../../src/modules/invoices/application/services/creationGuards';
import { CreateInvoiceDto } from '../../../src/modules/invoices/application/dto/createInvoiceDto';
import { UblGeneratorService } from '../../../src/modules/invoices/ublGeneratorService';
const issuer = { ruc:'20000000001', razonSocial:'Emisor ficticio',codigoLocalAnexo:'0000',direccion:'Domicilio ficticio',ubigeo:'150101',departamento:'LIMA',provincia:'LIMA',distrito:'LIMA' };
const free = (afectacion='11') => ({...base(),items:[{codigo:'SERV',descripcion:'Bien',cantidad:2,precioUnitario:0,valorUnitario:100,afectacion,unidad:'NIU'}]});
const fiscal = (dto:any) => traducirEmision(dto,issuer,1).dto;
const input = (dto:any, ruta:string) => ruta==='pantalla'?dto:fiscalToEmission(fiscal(dto));
describe.each(['pantalla','fiscal'])('8D gratuidad: %s', ruta=>{
 it.each(AFECTACIONES_GRATUITAS)('admite %s sin cambiar el maestro ni cobrar la referencia',async codigo=>{
  const h=harness();const result=await h.run(input(free(codigo),ruta));expect(result.items[0]).toMatchObject({afectacion:codigo,precioUnitario:0,valorUnitario:100});expect(h.product.tax_affectation).toBe('10');
  const d=fiscal(result);expect(d.monto_total).toBe(0);const xml=new UblGeneratorService().generateInvoiceXml(d.payload_ubl as never);expect(xml).toContain('<cbc:PriceTypeCode>02</cbc:PriceTypeCode>');expect(xml).toContain('languageLocaleID="1002"');expect(xml).toContain('<cbc:Name>GRA</cbc:Name>');expect(xml).toContain(`<cbc:Percent>${codigo.startsWith('1')?'18':'0'}.00</cbc:Percent>`);
 });
 it.each([0,-1,undefined])('rechaza referencia %s',async reference=>{const d=free();const incoming=ruta==='fiscal'?fiscalToEmission(fiscal(d)):d;incoming.items[0].valorUnitario=reference as never;await expect(harness().run(incoming)).rejects.toThrow();});
 it('no exige un precio oneroso configurado para una gratuita con referencia positiva',async()=>{const h=harness();h.product.sale_price=0;expect((await h.run(input(free(),ruta))).items[0]).toMatchObject({precioUnitario:0,valorUnitario:100});});
 it('rechaza gratuita con precio cobrado',async()=>{const d=free();d.items[0].precioUnitario=118;await expect(harness().run(input(d,ruta))).rejects.toThrow('precio cobrado cero');});
 it('no permite cambiar la afectación onerosa',async()=>{const d=free('20');d.items[0].precioUnitario=118;await expect(harness().run(input(d,ruta))).rejects.toThrow('No puede alterar');});
 it('conserva comprobante mixto',async()=>{const d=free();d.items.push({...d.items[0],afectacion:'10',precioUnitario:118});const r=await harness().run(input(d,ruta));expect(fiscal(r).monto_total).toBe(236);});
 it('rechaza onerosa en cero aunque el descuento la liquide en cero',async()=>{const d={...base(),items:[{...base().items[0],afectacion:'10',descuento:{codigo:'00',monto:100}}]};await expect(harness().run(input(d,ruta))).rejects.toThrow('total cero');});
});
it('contrato fiscal: cero solo para composición gratuita completa y referencias positivas',()=>{
 const d=fiscal(free());expect(validateSync(plainToInstance(CreateInvoiceDto,d))).toHaveLength(0);
 for(const p of [{...d,payload_ubl:{...d.payload_ubl,lineas:[]}},{...d,payload_ubl:{...d.payload_ubl,lineas:[{...d.payload_ubl.lineas![0],valorUnitario:0}]}},{...d,tipo_comprobante:'07'}, {...d,payload_ubl:{...d.payload_ubl,lineas:[{...d.payload_ubl.lineas![0],afectacion:'10'}]}}]) expect(validateSync(plainToInstance(CreateInvoiceDto,p)).some(e=>e.property==='monto_total')).toBe(true);
});
