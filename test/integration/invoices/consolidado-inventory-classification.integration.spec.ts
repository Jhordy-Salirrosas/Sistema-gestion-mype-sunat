import {randomUUID} from 'node:crypto';
import {PrismaService} from '../../../src/database/prismaService';
import {InventoryStocksController} from '../../../src/modules/inventory/infrastructure/controllers/inventoryStocksController';
import {bloquearClasificacionProductos} from '../../../src/common/productClassificationLock';
const url=process.env.TEST_DATABASE_URL;
(url?describe:describe.skip)('clasificación Inventario/M1 en PostgreSQL aislado',()=>{
 let db:PrismaService,c:string,p:string,w:string;const old=process.env.DATABASE_URL;
 beforeAll(async()=>{
  if(!url||!['localhost','127.0.0.1'].includes(new URL(url).hostname))throw new Error('Solo base local');process.env.DATABASE_URL=url;db=new PrismaService();await db.$connect();c=randomUUID();
  await db.company.create({data:{id:c,ruc:'2'+Date.now().toString().slice(-10),legal_name:'Consolidado ficticio',sol_user:'fake',sol_pass_encrypted:'fake'}});
  p=(await db.inventoryProduct.create({data:{company_id:c,sku:'SKU',description:'Producto',is_inventory:true}})).id;
  w=(await db.inventoryWarehouse.create({data:{company_id:c,warehouse_code:'ALM-01',description:'Local'}})).id;
 });
 beforeEach(async()=>{await db.transactionHistory.deleteMany({where:{company_id:c}});await db.inventoryMovement.deleteMany({where:{company_id:c}});await db.invoice.deleteMany({where:{company_id:c}});await db.inventoryProduct.update({where:{id:p},data:{is_inventory:true,is_service:false}});});
 afterAll(async()=>{if(db){await db.transactionHistory.deleteMany({where:{company_id:c}});await db.inventoryMovement.deleteMany({where:{company_id:c}});await db.invoice.deleteMany({where:{company_id:c}});await db.inventoryProduct.delete({where:{id:p}});await db.inventoryWarehouse.delete({where:{id:w}});await db.company.delete({where:{id:c}});await db.$disconnect();}if(old===undefined)delete process.env.DATABASE_URL;else process.env.DATABASE_URL=old;});
 const ctrl=()=>new InventoryStocksController({} as never,{} as never,{} as never,db);
 const invoice=()=>db.invoice.create({data:{company_id:c,ruc_emisor:'20100070970',tipo_comprobante:'01',serie:'F001',correlativo:1,estado:'ACEPTADO',monto_total:236,fecha_emision:new Date(),payload_ubl:{m1InventorySnapshot:{SKU:true}},items:{create:[{item_order:1,item_code:'SKU',description:'Producto',quantity:2,unit_value:100,unit_price:118,igv_amount:36,total_amount:236,igv_affectation_type:'10'}]}}});
 it('descarga pendiente impide producto→servicio y no altera el producto',async()=>{await invoice();await expect(ctrl().updateProduct('SKU',{is_service:true},c)).rejects.toMatchObject({response:{code:'PRODUCTO_CON_PENDIENTES_M1'}});expect((await db.inventoryProduct.findUniqueOrThrow({where:{id:p}})).is_inventory).toBe(true);});
 it('omisión pendiente impide servicio→producto; resolución acreditada permite el cambio',async()=>{
  const doc=await invoice();await db.inventoryProduct.update({where:{id:p},data:{is_inventory:false,is_service:true}});await db.invoice.update({where:{id:doc.id},data:{payload_ubl:{}}});
  const data={company_id:c,invoice_id:doc.id,estado_nuevo:'ACEPTADO' as const,mensaje_error:'{"sku":"SKU"}'};
  await db.transactionHistory.create({data:{...data,codigo_error:'M1_BRIDGE_INVENTORY_OMITTED'}});
  await expect(ctrl().updateProduct('SKU',{is_inventory:true},c)).rejects.toMatchObject({status:409});
  await db.transactionHistory.create({data:{...data,codigo_error:'M1_BRIDGE_INVENTORY_RESOLVED',created_at:new Date(Date.now()+1000)}});
  await expect(ctrl().updateProduct('SKU',{is_inventory:true},c)).resolves.toMatchObject({is_inventory:true});
 });
 it('sin pendientes conserva el comportamiento del PATCH',async()=>{await expect(ctrl().updateProduct('SKU',{is_service:true,description:'Servicio'},c)).resolves.toMatchObject({is_inventory:false,description:'Servicio'});});
 it('un alta M1 bajo la misma exclusión se confirma antes de evaluar la reclasificación',async()=>{
  let locked!:()=>void,release!:()=>void;const ready=new Promise<void>(r=>locked=r);const gate=new Promise<void>(r=>release=r);
  const create=db.$transaction(async tx=>{await bloquearClasificacionProductos(tx,c,['SKU']);locked();await gate;return tx.invoice.create({data:{company_id:c,ruc_emisor:'20100070970',tipo_comprobante:'01',serie:'F001',correlativo:1,estado:'PENDIENTE',monto_total:236,fecha_emision:new Date(),payload_ubl:{m1InventorySnapshot:{SKU:true}},items:{create:[{item_order:1,item_code:'SKU',description:'Producto',quantity:2,unit_value:100,unit_price:118,igv_amount:36,total_amount:236,igv_affectation_type:'10'}]}}});});
  await ready;const patch=expect(ctrl().updateProduct('SKU',{is_service:true},c)).rejects.toMatchObject({status:409});release();await create;await patch;
 });
});
