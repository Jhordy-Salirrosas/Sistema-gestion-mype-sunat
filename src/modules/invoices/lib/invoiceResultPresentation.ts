export interface ResultadoPresentacion {
  origen: 'VALIDACION_LOCAL' | 'SUNAT' | 'NO_DETERMINADO' | 'TRANSPORTE_INCIERTO' | 'PREPARACION_LOCAL';
  categoria?: string;
  etapa?: string;
  recuperable?: boolean;
  codigo: string | null;
  motivo: string | null;
}
/** Lectura visual separada del estado fiscal persistido. */
export function lecturaRechazo(resultado?: ResultadoPresentacion) {
  if (resultado?.origen === 'PREPARACION_LOCAL') return {
    etiqueta: 'Bloqueado en preparación local',
    lectura: resultado.recuperable ? 'Preparación local pendiente: revise certificado, configuración o infraestructura y reintente.' : 'Preparación local bloqueada por datos inválidos; revise los datos fiscales.',
    sinCdr: 'Sin CDR: bloqueo en preparación local',
    codigo: resultado.codigo ?? 'Preparación local',
    motivo: resultado.motivo ?? 'Revise la preparación local del comprobante.',
  };
  if (resultado?.origen === 'VALIDACION_LOCAL') return {
    etiqueta: 'Bloqueado por validación local',
    lectura: 'La validación local bloqueó el comprobante antes de enviarlo a SUNAT.',
    sinCdr: 'Sin CDR: bloqueo previo al envío',
    codigo: resultado.codigo ? `Regla ${resultado.codigo}` : 'Validación local',
    motivo: resultado.motivo ?? 'Revise el XML y los datos fiscales antes de intentar el envío.',
  };
  if (resultado?.origen === 'SUNAT') return {
    etiqueta: 'Rechazado por SUNAT', lectura: 'SUNAT respondió con rechazo del comprobante.',
    sinCdr: 'Sin CDR: SUNAT respondió mediante SOAP Fault',
    codigo: resultado.codigo ? `Código ${resultado.codigo}` : 'Rechazo de SUNAT',
    motivo: resultado.motivo ?? 'Rechazo comunicado por SUNAT.',
  };
  return { etiqueta: 'Rechazado (origen no confirmado)', lectura: 'El sistema registró un rechazo; no hay evidencia suficiente para atribuirlo a SUNAT.',
    sinCdr: 'Sin CDR; origen del rechazo no confirmado', codigo: 'Origen no confirmado',
    motivo: resultado?.motivo ?? 'No hay motivo con origen confirmado registrado.' };
}

/** La falta de confirmación no demuestra que SUNAT no recibiera el envío. */
export const LECTURA_INCERTIDUMBRE = 'Incertidumbre de transporte: no hay un resultado concluyente. Consultar antes de reenviar; SUNAT pudo recibir el comprobante.';
export function lecturaIncertidumbre(resultado?: ResultadoPresentacion) {
  return resultado?.origen === 'TRANSPORTE_INCIERTO' ? resultado.motivo ?? LECTURA_INCERTIDUMBRE : LECTURA_INCERTIDUMBRE;
}
