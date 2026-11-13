import { ConflictException } from '@nestjs/common';
import { Prisma } from '../../../../generated/client/client';

/** Proyección de frontera solo lectura: no importa ni invoca servicios del módulo M1. */
export async function asegurarSinPendientesM1(tx: Prisma.TransactionClient, companyId: string, product: {id:string;sku:string}): Promise<void> {
  const docs = await tx.invoice.findMany({ where: { company_id: companyId, OR: [
    { items: { some: { item_code: product.sku } } },
    { history: { some: { codigo_error: 'M1_BRIDGE_INVENTORY_OMITTED', mensaje_error: { contains: JSON.stringify({sku:product.sku}).slice(1,-1) } } } },
  ] }, select: { id:true,serie:true,correlativo:true,estado:true,tipo_comprobante:true,credit_debit_reason_code:true,payload_ubl:true,
    items:{where:{item_code:product.sku},select:{quantity:true}},history:{where:{codigo_error:{in:['M1_BRIDGE_INVENTORY_OMITTED','M1_BRIDGE_INVENTORY_RESOLVED']}},orderBy:{created_at:'asc'},select:{codigo_error:true,mensaje_error:true}} } });
  const movements = await tx.inventoryMovement.findMany({ where: { company_id:companyId,product_id:product.id,source_reference_id:{in:docs.map(d=>`${d.serie}-${String(d.correlativo).padStart(8,'0')}`)} },select:{source_reference_id:true,operation_type_code:true,quantity:true} });
  for (const doc of docs) {
    let omission = false;
    for (const event of doc.history) {
      try { const data=JSON.parse(event.mensaje_error ?? 'null');
        if(data?.sku===product.sku) omission=event.codigo_error==='M1_BRIDGE_INVENTORY_OMITTED';
      } catch { /* El texto legado no acredita SKU ni una resolución. */ }
    }
    const payload=doc.payload_ubl as Record<string,any> | null;
    const fiscalVigente=!['RECHAZADO','ANULADO'].includes(doc.estado);
    const physical=doc.tipo_comprobante==='01'||doc.tipo_comprobante==='03'||(doc.tipo_comprobante==='07'&&['01','02','06','07'].includes(doc.credit_debit_reason_code ?? '')&&(doc.credit_debit_reason_code!=='02'||payload?.politicaDevolucionFisica02===1));
    const qty=doc.items.reduce((s,l)=>s.plus(l.quantity),new Prisma.Decimal(0));
    const numero=`${doc.serie}-${String(doc.correlativo).padStart(8,'0')}`;
    const movement=movements.find(m=>m.source_reference_id===numero&&m.operation_type_code===(doc.tipo_comprobante==='07'?'05':'01'));
    const pending=physical&&fiscalVigente&&payload?.m1InventorySnapshot?.[product.sku]===true&&qty.greaterThan(0)&&(!movement||!qty.equals(movement.quantity));
    if(omission||pending) throw new ConflictException({code:'PRODUCTO_CON_PENDIENTES_M1',message:`No se puede cambiar producto/servicio de ${product.sku}: ${numero} tiene una descarga u omisión pendiente de revisión en M1.`});
  }
}
