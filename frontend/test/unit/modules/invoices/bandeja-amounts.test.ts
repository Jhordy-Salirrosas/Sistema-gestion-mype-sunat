import {expect,it,vi} from 'vitest';
import {derivarImportesBandeja,enriquecerImportesBandeja} from '@/modules/invoices/lib/invoiceBandejaAmounts';
import {aInvoice} from '@/modules/invoices/lib/invoiceMapper';
import {aComprobanteDemo} from '@/modules/invoices/lib/invoiceApiMapper';
const linea={codigo:'FLETE',descripcion:'Flete terrestre Lima - Trujillo',unidad:'NIU',cantidad:1,valor_unitario:950,precio_unitario:1121,afectacion:'20',icbper:0};
it('F001-52 exonerada conserva base 950, IGV 0 y total 950 ignorando el precio 1121',()=>{
 expect(derivarImportesBandeja({total:950,lineasOrigen:[linea]})).toEqual({base:950,igv:0,icbper:0,total:950,verificado:true});
});
it.each([['10',1121,950,171],['30',950,950,0],['40',950,950,0],['21',0,0,0],['31',0,0,0],['11',0,0,0]] as const)('respeta afectación %s', (afectacion,total,base,igv)=>{
 expect(derivarImportesBandeja({total,lineasOrigen:[{...linea,afectacion}]})).toMatchObject({base,igv,total,verificado:true});
});
it('ICBPER viene del dato, nunca del residual entre totales',()=>{
 const free={...linea,afectacion:'21',icbper:.5};expect(derivarImportesBandeja({total:.5,lineasOrigen:[free]})).toMatchObject({base:0,igv:0,icbper:.5,verificado:true});
 expect(derivarImportesBandeja({total:951,lineasOrigen:[linea]}).verificado).toBe(false);
});
it('descuentos de línea preservan IGV sobre su base y el importe neto',()=>{
 const line={...linea,afectacion:'10',valor_unitario:100,descuentos:[{codigo:'00',monto:10},{codigo:'01',monto:5}]};expect(derivarImportesBandeja({total:101.2,lineasOrigen:[line]})).toMatchObject({base:85,igv:16.2,verificado:true});
});
it.each([{}, {lineasOrigen:[]}, {lineasOrigen:[{...linea,cantidad:0}]},{lineasOrigen:[{...linea,cantidad:null}]},{lineasOrigen:[{...linea,valor_unitario:-1}]},{lineasOrigen:[{...linea,afectacion:null}]},{lineasOrigen:[{...linea,afectacion:'99'}]},{lineasOrigen:[{...linea,icbper:-1}]},{lineasOrigen:[{...linea,descuentos:[{codigo:'99',monto:1}]}]},{lineasOrigen:[{...linea,descuentos:[{codigo:null,monto:1}]}]},{lineasOrigen:[{...linea,descuentos:[{codigo:'00',monto:null}]}]},{lineasOrigen:[{...linea,descuentos:[{codigo:'00',monto:951}]}]},{lineasOrigen:[{...linea,afectacion:'21',descuentos:[{codigo:'00',monto:1}]}]}])('señala un desglose no verificable: %j',input=>{
 expect(derivarImportesBandeja({total:950,...input} as never).verificado).toBe(false);
});
it('dato ICBPER ausente en una línea admite el cero legado sin inventar impuestos',()=>{
 expect(derivarImportesBandeja({total:950,lineasOrigen:[{...linea,icbper:undefined}]})).toMatchObject({icbper:0,verificado:true});
});
it('enriquecimiento conserva orden, acota concurrencia y señala lectura fallida',async()=>{
 const rows=Array.from({length:9},(_,i)=>({id:String(i),total:950}));let active=0,max=0;
 const leer=vi.fn(async(id:string)=>{active++;max=Math.max(max,active);await Promise.resolve();active--;if(id==='8')throw Error('Sin detalle');return {id,total:950,lineasOrigen:[linea]} as never;});
 const result=await enriquecerImportesBandeja(rows as never,leer);expect(result.map(x=>x.id)).toEqual(rows.map(x=>x.id));expect(max).toBe(4);expect(result[0].importesBandeja?.verificado).toBe(true);expect(result[8].importesBandeja?.verificado).toBe(false);
 expect(await enriquecerImportesBandeja([],leer)).toEqual([]);
});
it('el modelo de fila transporta el mismo desglose verificado al KPI y a la tabla',()=>{
 const normal=aInvoice({id:'52',serie:'F001',correlativo:52,numero:'F001-00000052',tipo_comprobante:'01',fecha_emision:'2026-11-12',estado:'ERROR_RED',monto_total:950,base_imponible:0,total_igv:0,moneda:'PEN',cliente_documento:'20100070970',cliente_nombre:'Cliente',cdr_codigo:null});
 const c=aComprobanteDemo({...normal,importesBandeja:derivarImportesBandeja({total:950,lineasOrigen:[linea]}),tieneCdr:false});expect(c).toMatchObject({baseImponible:950,igv:0,totalNeto:950,tieneCdr:false});
});

it('un detalle de otro documento no se mezcla con la fila',async()=>{
 const [r]=await enriquecerImportesBandeja([{id:'52',total:950}] as never,async()=>({id:'otro',total:118,lineasOrigen:[linea]}) as never);expect(r.importesBandeja).toMatchObject({total:950,verificado:false});
});
