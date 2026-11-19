import { CheckCircle2, CircleAlert, CircleX, Clock3, Ban, WifiOff, CircleHelp } from 'lucide-react';
import { Badge } from '@/components/ui';
import { clasificarBandeja, ETIQUETAS_BANDEJA, type EstadoBandeja } from '../lib/invoiceBandejaState';
import { lecturaRechazo, type ResultadoPresentacion } from '../lib/invoiceResultPresentation';
const ESTILOS:Record<EstadoBandeja,string>={
 ACEPTADO:'border-emerald-500/40 bg-emerald-100 text-emerald-900',OBSERVADO:'border-amber-500/40 bg-amber-100 text-amber-900',
 RECHAZADO:'border-destructive/40 bg-red-100 text-red-900',PREPARACION_LOCAL:'border-amber-500/40 bg-amber-100 text-amber-900',
 SIN_CONFIRMAR:'border-amber-500/40 bg-amber-100 text-amber-900',ERROR_RED:'border-destructive/40 bg-red-100 text-red-900',
 EN_COLA:'border-blue-500/40 bg-blue-100 text-blue-900',ANULADO:'border-slate-500 bg-slate-100 text-slate-800',NO_DETERMINADO:'border-slate-500 bg-slate-100 text-slate-800',
};
const ICONOS = { ACEPTADO: CheckCircle2, OBSERVADO: CircleAlert, RECHAZADO: CircleX, PREPARACION_LOCAL: CircleAlert, SIN_CONFIRMAR: CircleHelp, ERROR_RED: WifiOff, EN_COLA: Clock3, ANULADO: Ban, NO_DETERMINADO: CircleHelp };
interface InvoiceStatusBadgeProps {estado:string;estadoBackend?:string;resultado?:ResultadoPresentacion;codigo?:string}
export const InvoiceStatusBadge=({estado,estadoBackend,codigo,resultado}:InvoiceStatusBadgeProps)=>{
 const categoria=clasificarBandeja({estado,estadoBackend,resultadoPresentacion:resultado});
 const Icono = ICONOS[categoria];
 const codigoVisible=resultado?.codigo ?? codigo;
 const efectoLocal=['BRIDGE_PENDING','RA_REVERSAL_PENDING','RA_REVERSAL_DONE'].includes(resultado?.origen ?? '') ? lecturaRechazo(resultado).etiqueta : null;
 return <Badge variant="outline" className={`m1-status max-w-full whitespace-normal font-medium ${ESTILOS[categoria]}`} aria-label={ETIQUETAS_BANDEJA[categoria]}>
  <Icono aria-hidden="true" className="h-4 w-4 shrink-0" />{ETIQUETAS_BANDEJA[categoria]}{efectoLocal && <span aria-label={efectoLocal}>{` · ${efectoLocal}`}</span>}
  {categoria!=='SIN_CONFIRMAR' && codigoVisible && codigoVisible!=='0' ? ` · ${codigoVisible}` : ''}
 </Badge>;
};
