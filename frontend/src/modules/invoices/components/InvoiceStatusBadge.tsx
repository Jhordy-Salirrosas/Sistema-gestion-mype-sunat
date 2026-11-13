import { Badge } from '@/components/ui';
import { clasificarBandeja, ETIQUETAS_BANDEJA, type EstadoBandeja } from '../lib/invoiceBandejaState';
import { lecturaRechazo, type ResultadoPresentacion } from '../lib/invoiceResultPresentation';
import type { EstadoCdrDemo } from '../data/invoiceDemoSchema';
const ESTILOS:Record<EstadoBandeja,string>={
 ACEPTADO:'border-emerald-500/40 bg-emerald-500/10 text-emerald-700',OBSERVADO:'border-amber-500/40 bg-amber-500/10 text-amber-700',
 RECHAZADO:'border-destructive/40 bg-destructive/10 text-destructive',PREPARACION_LOCAL:'border-amber-500/40 bg-amber-500/10 text-amber-700',
 SIN_CONFIRMAR:'border-amber-500/40 bg-amber-500/10 text-amber-700',ERROR_RED:'border-destructive/40 bg-destructive/10 text-destructive',
 EN_COLA:'border-blue-500/40 bg-blue-500/10 text-blue-700',ANULADO:'border-muted text-muted-foreground',NO_DETERMINADO:'border-muted text-muted-foreground',
};
interface InvoiceStatusBadgeProps {estado:EstadoCdrDemo;estadoBackend?:string;resultado?:ResultadoPresentacion;codigo?:string}
export const InvoiceStatusBadge=({estado,estadoBackend,codigo,resultado}:InvoiceStatusBadgeProps)=>{
 const categoria=clasificarBandeja({estado,estadoBackend,resultadoPresentacion:resultado});
 const codigoVisible=resultado?.codigo ?? codigo;
 const efectoLocal=['BRIDGE_PENDING','RA_REVERSAL_PENDING','RA_REVERSAL_DONE'].includes(resultado?.origen ?? '') ? lecturaRechazo(resultado).etiqueta : null;
 return <Badge variant="outline" className={`font-medium ${ESTILOS[categoria]}`} aria-label={ETIQUETAS_BANDEJA[categoria]}>
  {ETIQUETAS_BANDEJA[categoria]}{efectoLocal && <span aria-label={efectoLocal}>{` · ${efectoLocal}`}</span>}
  {categoria!=='SIN_CONFIRMAR' && codigoVisible && codigoVisible!=='0' ? ` · ${codigoVisible}` : ''}
 </Badge>;
};
