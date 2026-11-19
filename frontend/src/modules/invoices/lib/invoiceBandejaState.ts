import type { ResultadoPresentacion } from './invoiceResultPresentation';
export type EstadoBandeja = 'ACEPTADO' | 'OBSERVADO' | 'RECHAZADO' | 'PREPARACION_LOCAL' | 'SIN_CONFIRMAR' | 'ERROR_RED' | 'EN_COLA' | 'ANULADO' | 'NO_DETERMINADO';
interface Evidencia { estado: string; estadoBackend?: string; resultadoPresentacion?: ResultadoPresentacion; ultimoErrorCodigo?: string }
/** La categoría de bandeja es una lectura; no modifica el estado fiscal. */
export function clasificarBandeja(c: Evidencia): EstadoBandeja {
 const r=c.resultadoPresentacion;
 if (r?.origen==='PREPARACION_LOCAL' || r?.origen==='VALIDACION_LOCAL' || (r?.codigo ?? c.ultimoErrorCodigo ?? '').startsWith('M1_PREPARATION_')) return 'PREPARACION_LOCAL';
 if (r?.origen==='RA_REVERSAL_PENDING' || r?.origen==='RA_REVERSAL_DONE') return 'ANULADO';
 if (r?.origen==='TRANSPORTE_INCIERTO') return 'SIN_CONFIRMAR';
 const estado=c.estadoBackend ?? c.estado;
 if (estado==='ANULADO') return 'ANULADO';
 if (estado==='ACEPTADO' || estado==='OBSERVADO' || estado==='ERROR_RED') return estado;
 if (estado==='RECHAZADO') return r?.origen==='SUNAT' ? 'RECHAZADO' : 'NO_DETERMINADO';
 return estado==='SIN_CONFIRMAR' ? 'SIN_CONFIRMAR' : 'EN_COLA';
}
export const ETIQUETAS_BANDEJA: Record<EstadoBandeja,string> = {
 ACEPTADO:'Aceptada', OBSERVADO:'Aceptada con observación', RECHAZADO:'Rechazada',
 PREPARACION_LOCAL:'Bloqueada en preparación local', SIN_CONFIRMAR:'Sin confirmación',
 ERROR_RED:'Interrumpida por conexión', EN_COLA:'En proceso', ANULADO:'Anulada',
 NO_DETERMINADO:'Sin resultado confirmado',
};
export function consultarSunatAporta(c: Evidencia & {serie:string;tieneCdr?:boolean}): boolean {
 return !c.serie.toUpperCase().startsWith('B') && c.tieneCdr===false && ['SIN_CONFIRMAR','ERROR_RED','EN_COLA'].includes(clasificarBandeja(c)) && (clasificarBandeja(c)!=='EN_COLA' || (c.estadoBackend ?? c.estado)==='ENVIADO');
}
