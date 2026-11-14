import { omisionesPendientes, BRIDGE_OMITTED } from './invoiceBridgeOmission';
import { classifyResponseCode } from '../../../sunat/soap/cdr-classifier';

export interface ResultadoPresentacion {
  origen: 'VALIDACION_LOCAL' | 'SUNAT' | 'NO_DETERMINADO' | 'TRANSPORTE_INCIERTO' | 'PREPARACION_LOCAL' | 'RA_REVERSAL_PENDING' | 'RA_REVERSAL_DONE' | 'BRIDGE_PENDING';
  categoria?: string;
  etapa?: string;
  recuperable?: boolean;
  codigo: string | null;
  motivo: string | null;
}
export interface EventoPresentacion {
  estado_nuevo: string;
  codigo_error: string | null;
  mensaje_error: string | null;
  created_at?: Date;
}
/** Solo lectura. Un código SUNAT también puede surgir del XSL local: no basta por sí solo. */
export function presentarResultado(estado: string, cdr: { codigo: string | null; descripcion: string | null } | null,
  history: readonly EventoPresentacion[] = [], transportUncertain?: boolean | null): ResultadoPresentacion | undefined {
  if (transportUncertain && ['ENVIADO', 'ERROR_RED', 'EN_COLA', 'PENDIENTE', 'PROCESANDO'].includes(estado)) {
    const consultas = history.filter(e => e.codigo_error === 'M1_TRANSPORT_UNCERTAIN');
    const ultima = [...consultas].sort((a, b) => (b.created_at?.getTime() ?? 0) - (a.created_at?.getTime() ?? 0))[0];
    return { origen: 'TRANSPORTE_INCIERTO', codigo: 'M1_TRANSPORT_UNCERTAIN',
      motivo: ultima?.mensaje_error ?? 'Incertidumbre de transporte: no hay resultado concluyente; consultar antes de reenviar.' };
  }
  if (['ACEPTADO','OBSERVADO'].includes(estado) && omisionesPendientes(history).length) return { origen: 'BRIDGE_PENDING', codigo: BRIDGE_OMITTED, motivo: `${estado} con puente pendiente: descarga omitida por clasificación como servicio. SKU: ${omisionesPendientes(history).join(', ')}.` };
  const rc = history.some(e => e.codigo_error?.startsWith('M1_RC_REVERSAL_'));
  const prefijoReversion = rc ? 'M1_RC' : 'M1_RA';
  if (estado === 'ANULADO' && history.some(e => e.codigo_error === `${prefijoReversion}_REVERSAL_DONE`)) return { origen: 'RA_REVERSAL_DONE', codigo: `${prefijoReversion}_REVERSAL_DONE`, motivo: 'ANULADO con reversión local completada.' };
  if (estado === 'ANULADO' && history.some(e => e.codigo_error === `${prefijoReversion}_REVERSAL_PENDING`)) return { origen: 'RA_REVERSAL_PENDING', codigo: `${prefijoReversion}_REVERSAL_PENDING`, motivo: `ANULADO con reversión pendiente. ${rc ? 'El RC fue aceptado' : 'La RA fue aceptada'}; faltan efectos locales del puente.` };
  if (estado === 'ERROR_RED') {
    const evento = history.map((e, i) => ({ e, i })).sort((a, b) =>
      (b.e.created_at?.getTime() ?? b.i) - (a.e.created_at?.getTime() ?? a.i))
      .find(({ e }) => e.codigo_error && e.codigo_error !== 'M1_NOTE_DESCRIPTION_COMPLETED' && !/^(Rescate manual |Reintento manual )/.test(e.mensaje_error ?? ''))?.e;
    if (evento?.codigo_error?.startsWith('M1_PREPARATION_')) {
      try {
        const causa = JSON.parse(evento.mensaje_error ?? '{}');
        return { origen: 'PREPARACION_LOCAL', codigo: evento.codigo_error,
          motivo: 'Bloqueado en preparación local: ' + (causa.causa ?? 'Revise la preparación del documento.'),
          categoria: causa.categoria, etapa: causa.etapa, recuperable: causa.recuperable };
      } catch { /* Evidencia mal formada no se atribuye a SUNAT. */ }
    }
  }
  if (estado !== 'RECHAZADO') return undefined;
  if (cdr?.codigo && classifyResponseCode(cdr.codigo).status === 'RECHAZADO') {
    return { origen: 'SUNAT', codigo: cdr.codigo, motivo: cdr.descripcion };
  }
  const eventos = history.map((evento, indice) => ({ evento, indice })).sort((a, b) =>
    (b.evento.created_at?.getTime() ?? b.indice) - (a.evento.created_at?.getTime() ?? a.indice));
  for (const { evento } of eventos) {
    if (evento.estado_nuevo !== 'RECHAZADO') continue;
    const mensaje = evento.mensaje_error ?? '';
    if (/^(Rescate manual |Reintento manual )/.test(mensaje)) continue;
    if (mensaje.startsWith('Bloqueado antes de enviar por la validación XSL:') || mensaje.startsWith('Validación XSL local:')) {
      return { origen: 'VALIDACION_LOCAL', codigo: evento.codigo_error, motivo: mensaje };
    }
    if (mensaje.startsWith('SOAP Fault del billService') && evento.codigo_error && classifyResponseCode(evento.codigo_error).status === 'RECHAZADO') {
      return { origen: 'SUNAT', codigo: evento.codigo_error, motivo: mensaje };
    }
    // Una decisión posterior no reconocida impide adjudicar el rechazo a una anterior.
    return { origen: 'NO_DETERMINADO', codigo: evento.codigo_error, motivo: evento.mensaje_error };
  }
  return { origen: 'NO_DETERMINADO', codigo: null, motivo: null };
}
