import type { ComprobanteDemo } from '@/modules/invoices/data/invoiceDemoTypes';
import type { Invoice } from '@/modules/invoices/types/invoice.types';
/** Contrato normalizado completo del GET de detalle para los dobles del visor. */
export function invoiceDetailFromDemo(c: ComprobanteDemo): Invoice {
 return {id:c.id,numero:c.numero??`${c.serie}-${String(c.correlativo).padStart(8,'0')}`,serie:c.serie,correlativo:c.correlativo,clienteRuc:c.clienteRuc,clienteRazonSocial:c.clienteRazonSocial,fechaEmision:c.fechaEmision,moneda:c.moneda,subtotal:c.baseImponible,igv:c.igv,total:c.totalNeto,cdrStatus:'EN_COLA_OUTBOX',estadoBackend:c.estadoBackend??c.estado,tipoComprobante:c.tipo,cdrCodigo:c.cdrCodigo,cdrMensaje:c.cdrDescripcion,resultadoPresentacion:c.resultadoPresentacion,tieneCdr:c.tieneCdr,formaPago:c.formaPago,cuotas:c.cuotas,historial:[] };
}
