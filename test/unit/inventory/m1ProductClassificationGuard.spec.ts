import {asegurarSinPendientesM1} from '../../../src/modules/inventory/application/services/m1ProductClassificationGuard';
import {bloquearClasificacionProductos} from '../../../src/common/productClassificationLock';
import {InventoryStocksController} from '../../../src/modules/inventory/infrastructure/controllers/inventoryStocksController';
const row=()=>({id:'doc',serie:'F001',correlativo:1,estado:'ACEPTADO',tipo_comprobante:'01',credit_debit_reason_code:null as string|null,payload_ubl:{m1InventorySnapshot:{SKU:true}} as any,items:[{quantity:2}],history:[] as any[]});
function harness(docs:any[]=[row()],movements:any[]=[]){const db={invoice:{findMany:jest.fn(async()=>docs)},inventoryMovement:{findMany:jest.fn(async()=>movements)}};return {db,run:()=>asegurarSinPendientesM1(db as never,'c',{id:'p',sku:'SKU'})};}
it.each(['01','03'])('descarga física pendiente %s rechaza con código, documento y SKU',async tipo=>{
 const d=row();d.tipo_comprobante=tipo;const h=harness([d]);await expect(h.run()).rejects.toMatchObject({response:{code:'PRODUCTO_CON_PENDIENTES_M1',message:expect.stringContaining('F001-00000001')}});
 expect(h.db.invoice.findMany).toHaveBeenCalledWith(expect.objectContaining({where:expect.objectContaining({company_id:'c'})}));expect(h.db.inventoryMovement.findMany).toHaveBeenCalledWith(expect.objectContaining({where:expect.objectContaining({company_id:'c',product_id:'p'})}));
});
it.each([false,true])('movimiento registrado consistente=%s determina pendiente',async ok=>{
 const h=harness([row()],[{source_reference_id:'otra',operation_type_code:'01',quantity:2},{source_reference_id:'F001-00000001',operation_type_code:'02',quantity:2},{source_reference_id:'F001-00000001',operation_type_code:'01',quantity:ok?2:1}]);
 if(ok)await expect(h.run()).resolves.toBeUndefined();else await expect(h.run()).rejects.toThrow('pendiente');
});
it.each(['RECHAZADO','ANULADO','servicio','sin snapshot','payload null','sin cantidad','ND','NC descuento','NC02 histórica','sin motivo'])('%s no inventa una obligación física',async caso=>{
 const d=row();if(['RECHAZADO','ANULADO'].includes(caso))d.estado=caso;
 if(caso==='servicio')d.payload_ubl.m1InventorySnapshot.SKU=false;if(caso==='sin snapshot')d.payload_ubl={};if(caso==='payload null')d.payload_ubl=null;if(caso==='sin cantidad')d.items=[];
 if(caso==='ND')d.tipo_comprobante='08';if(caso.startsWith('NC')||caso==='sin motivo'){d.tipo_comprobante='07';d.credit_debit_reason_code=caso==='NC descuento'?'04':caso==='sin motivo'?null:'02';}
 await expect(harness([d]).run()).resolves.toBeUndefined();
});
it.each(['01','02','06','07'])('devolución física NC%s pendiente o acreditada',async motivo=>{
 const d=row();d.tipo_comprobante='07';d.credit_debit_reason_code=motivo;d.payload_ubl.politicaDevolucionFisica02=1;
 await expect(harness([d]).run()).rejects.toThrow('pendiente');
 await expect(harness([d],[{source_reference_id:'F001-00000001',operation_type_code:'05',quantity:2}]).run()).resolves.toBeUndefined();
});
it('omisiones y resoluciones por SKU se revisan incluso sin snapshot o en estado final',async()=>{
 const d=row();d.payload_ubl=null;d.estado='ANULADO';d.history=[{codigo_error:'M1_BRIDGE_INVENTORY_OMITTED',mensaje_error:null},{codigo_error:'M1_BRIDGE_INVENTORY_OMITTED',mensaje_error:'texto antiguo'},{codigo_error:'M1_BRIDGE_INVENTORY_OMITTED',mensaje_error:'{"sku":"OTRO"}'},{codigo_error:'M1_BRIDGE_INVENTORY_OMITTED',mensaje_error:'{"sku":"SKU"}'}];
 await expect(harness([d]).run()).rejects.toThrow('pendiente');d.history.push({codigo_error:'M1_BRIDGE_INVENTORY_RESOLVED',mensaje_error:'{"sku":"SKU"}'});await expect(harness([d]).run()).resolves.toBeUndefined();
});
it('sin documentos no bloquea; bloqueo común usa orden estable, quita duplicados y blancos',async()=>{
 await expect(harness([]).run()).resolves.toBeUndefined();const tx={$executeRaw:jest.fn()};await bloquearClasificacionProductos(tx as never,'c',['B',' A ','B','',' ']);expect(tx.$executeRaw.mock.calls.map(c=>c[1])).toEqual(['m1:product-classification:c:A','m1:product-classification:c:B']);
});
function controller(){const existing={id:'p',sku:'SKU',is_inventory:true};const db:any={inventoryProduct:{findFirst:jest.fn(async()=>existing),update:jest.fn(async({data}:any)=>({...existing,...data}))},invoice:{findMany:jest.fn(async()=>[])},inventoryMovement:{findMany:jest.fn(async()=>[])},$executeRaw:jest.fn()};db.$transaction=jest.fn(async(fn:any)=>fn(db));return {db,existing,ctrl:new InventoryStocksController({} as never,{} as never,{} as never,db)};}
it('PATCH sin reclasificación conserva los cambios comerciales y no consulta pendientes',async()=>{
 const h=controller();await h.ctrl.updateProduct('SKU',{description:' Nueva ',brand:'Marca',model:'Modelo',category:'Clase',manufacturer:'Fábrica',country_of_origin:'pe',barcode:'Code',hs_code:'123',warehouse_location:'A',attributes:{a:'b'}} as never,'c');expect(h.db.$transaction).not.toHaveBeenCalled();expect(h.db.invoice.findMany).not.toHaveBeenCalled();
});
it.each([{is_service:true},{is_inventory:false},{is_service:false}])('PATCH %j bloquea y revisa solo un cambio efectivo',async change=>{
 const h=controller();await h.ctrl.updateProduct('SKU',change,'c');expect(h.db.$transaction).toHaveBeenCalled();expect(h.db.invoice.findMany).toHaveBeenCalledTimes(change.is_service===false?0:1);
});
it('producto desaparecido bajo bloqueo no permite escribir',async()=>{
 const h=controller();h.db.inventoryProduct.findFirst.mockResolvedValueOnce(h.existing).mockResolvedValueOnce(null);await expect(h.ctrl.updateProduct('SKU',{is_inventory:false},'c')).rejects.toMatchObject({status:404});expect(h.db.inventoryProduct.update).not.toHaveBeenCalled();
});
it('la entrada del puente comparte la exclusión por SKU y omite códigos nulos',async()=>{
 const {InvoiceBridgeCoordinatorService}=await import('../../../src/modules/invoices/application/services/invoiceBridgeCoordinatorService');
 const tx={$executeRaw:jest.fn(),invoice:{findUnique:jest.fn(async()=>({estado:'ACEPTADO',company_id:'c',items:[{item_code:null},{item_code:'SKU'}]}))}};
 const db={$transaction:async(work:any)=>work(tx),invoice:{findFirst:async()=>({estado:'ACEPTADO'})}};
 const service=new InvoiceBridgeCoordinatorService(db as never,{} as never);jest.spyOn(service as any,'ejecutarExclusivo').mockResolvedValue({respuesta:{completo:true}});
 await expect(service.reprocesar('c','inv')).resolves.toMatchObject({completo:true});expect(tx.$executeRaw.mock.calls.map(c=>c[1])).toContain('m1:product-classification:c:SKU');
});
