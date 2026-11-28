import { esTipoNota } from './invoiceEmitDraft';
import { problemasContenidoEmision } from './invoiceEmissionValidation';
import { documentoValidoParaTipo, mensajeErrorDocumento } from './invoiceEmitValidation';
import { problemaDeFechaEmision } from './invoiceEmitFecha';
import { problemaSpotMinimo, validarCronograma } from './invoiceDetraccion';
import { revisarGrilla } from './invoiceStockLinea';
import { erroresCamposLinea } from './invoiceLineFields';
import type { ItemBorrador } from './invoiceItems';
import type { DescuentoGlobal } from './invoiceDescuentoGlobal';
import type { ProductoBuscado } from './invoiceSearch';
export interface FormIssue { selector: string; mensaje: string; }
/** Solo reúne las validaciones existentes de la página; no calcula importes ni altera el contrato. */
export function invoiceFormIssues(v: {
 tipo:'01'|'03'|'07'|'08';serie:string;fecha:string;documento:string;nombre:string;items:readonly ItemBorrador[];
 descuento:DescuentoGlobal|null;productos:readonly ProductoBuscado[];detraccion:boolean;medioDetraccion:string;
 forma:'Contado'|'Credito';cuotas:readonly {monto:number;vencimiento:string}[];neto:number;
}):FormIssue[] {
 const out:FormIssue[]=[];
 const push=(selector:string,mensaje?:string|null)=>{if(mensaje&&!out.some(i=>i.selector===selector&&i.mensaje===mensaje))out.push({selector,mensaje});};
 if(!v.serie)push('#serie-cpe','Configure una serie activa para este tipo de comprobante.');
 push('[aria-label="Líneas del comprobante"]',problemaSpotMinimo(v.items,v.tipo));
 if(v.detraccion&&!v.medioDetraccion)push('[aria-label="Medio de pago de la detracción"]','Seleccione el medio de pago de la detracción.');
 push('#fecha-emision',problemaDeFechaEmision(v.fecha,undefined,v.tipo));
 if(!v.documento.trim())push('#doc-cliente',v.tipo==='01'?'La factura exige el RUC del cliente.':'Indique el documento del comprador.');
 else if(!documentoValidoParaTipo(v.tipo,v.documento.trim()))push('#doc-cliente',mensajeErrorDocumento(v.tipo));
 for(const mensaje of problemasContenidoEmision({tipo:v.tipo,clienteRazonSocial:v.nombre,items:v.items,descuentoGlobal:v.descuento})){
  if(mensaje.includes('razón social'))push(v.tipo==='03'?'#doc-cliente':'#razon-cliente',mensaje);
  else if(/descuento global/i.test(mensaje))push('[data-invoice-discount]',mensaje);
  else {
   const linea=/^Línea (\d+):/.exec(mensaje);
   const index=linea?Number(linea[1])-1:-1;
   const campos=index>=0?erroresCamposLinea(v.items[index],esTipoNota(v.tipo)):null;
   if(campos?.cantidad)push(`[aria-label="Cantidad de la línea ${index+1}"]`,campos.cantidad);
   else push('[aria-label="Líneas del comprobante"]',mensaje);
  }
 }
 for(const linea of revisarGrilla(v.items,v.productos,{nota:esTipoNota(v.tipo)}).lineas){if(linea.gravedad==='error')push(`[aria-label="Cantidad de la línea ${linea.indice+1}"]`,linea.mensaje);}
 if(v.forma==='Credito'){
  const cronograma=validarCronograma(v.cuotas,v.neto,v.fecha);
  for(const error of cronograma.errores)push('#emision-cuotas',error);
  if(!cronograma.cuadra&&!cronograma.errores.length)push('#emision-cuotas',`El cronograma no cuadra: las cuotas suman ${cronograma.suma.toFixed(2)} y el neto pendiente es ${cronograma.netoPendiente.toFixed(2)}.`);
 }
 return out;
}
