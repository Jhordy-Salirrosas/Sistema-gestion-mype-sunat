import { classifyResponseCode } from '../../../sunat/soap/cdr-classifier';

export interface ResultadoPresentacion {
  origen: 'VALIDACION_LOCAL' | 'SUNAT' | 'NO_DETERMINADO';
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
  history: readonly EventoPresentacion[] = []): ResultadoPresentacion | undefined {
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
