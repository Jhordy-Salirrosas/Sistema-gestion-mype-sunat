import { multiplyMoney, round2 } from './invoiceTaxes';
import type { Invoice } from '../types/invoice.types';
export interface ImportesBandeja { base:number; igv:number; icbper:number; total:number; verificado:boolean }
const numero = (n: unknown): n is number => typeof n==='number' && Number.isFinite(n) && n>=0;
/** Todos los importes calculados provienen de las líneas del mismo payload. Precio no determina IGV. */
export function derivarImportesBandeja(detalle: Pick<Invoice,'lineasOrigen'|'total'>): ImportesBandeja {
 const desconocido={base:0,igv:0,icbper:0,total:detalle.total,verificado:false};
 const lineas=detalle.lineasOrigen;
 if (!lineas?.length) return desconocido;
 let base=0,igv=0,icbper=0;
 for (const l of lineas) {
  if (!numero(l.cantidad) || l.cantidad===0 || !numero(l.valor_unitario) || !l.afectacion || !/^(10|1[1-7]|2[01]|3[0-7]|40)$/.test(l.afectacion) || !numero(l.icbper ?? 0)) return desconocido;
  const gratuita=/^(1[1-7]|21|3[1-7])$/.test(l.afectacion);
  const bruto=gratuita ? 0 : multiplyMoney(l.cantidad,l.valor_unitario);
  let descuentoBase=0,descuentoTotal=0;
  for (const d of l.descuentos ?? []) {
   if (gratuita || !numero(d.monto) || !['00','01'].includes(d.codigo ?? '')) return desconocido;
   if(d.codigo==='00') descuentoBase+=d.monto; else descuentoTotal+=d.monto;
  }
  if(descuentoBase+descuentoTotal>bruto) return desconocido;
  const neto=round2(bruto-descuentoBase);
  base+=round2(neto-descuentoTotal);
  igv+=l.afectacion==='10' ? multiplyMoney(neto,.18) : 0;
  icbper+=l.icbper ?? 0;
 }
 const result={base:round2(base),igv:round2(igv),icbper:round2(icbper),total:round2(base+igv+icbper),verificado:true};
 return result.total===round2(detalle.total) ? result : desconocido;
}
/** Lecturas acotadas; un detalle fallido nunca deja un desglose inventado. */
export async function enriquecerImportesBandeja(filas: Invoice[], leer:(id:string)=>Promise<Invoice>):Promise<Invoice[]> {
 const resultado:Invoice[]=[];
 for(let i=0;i<filas.length;i+=4){
  resultado.push(...await Promise.all(filas.slice(i,i+4).map(async fila=>{
   try {
    const detalle=await leer(fila.id);
    if(detalle.id!==fila.id) throw new Error('El detalle no corresponde al comprobante');
    return {...fila,importesBandeja:derivarImportesBandeja(detalle)};
   } catch {return {...fila,importesBandeja:{base:0,igv:0,icbper:0,total:fila.total,verificado:false}};}
  })));
 }
 return resultado;
}
