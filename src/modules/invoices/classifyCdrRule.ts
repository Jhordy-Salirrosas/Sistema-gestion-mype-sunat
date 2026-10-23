/**
 * Clasificación de los códigos de respuesta del CDR de SUNAT (M1).
 *
 * SUNAT devuelve un CDR (Constancia de Recepción) por cada envío. El código
 * `0` significa aceptación; los códigos `2xxx`/`3xxx` son observaciones y los
 * `1xxx`/`01xx` rechazos. Esta tabla traduce el código a la acción que debe
 * tomar el sistema (reintentar, corregir o dar por perdido el comprobante).
 */

/** Acción que debe ejecutar el sistema ante un CDR. */
export type AccionCdr = 'ACEPTADO' | 'OBSERVADO' | 'RECHAZADO' | 'REINTENTAR';

/** Clasificación resuelta de un código de respuesta. */
export interface ClasificacionCdr {
  codigo: string;
  descripcion: string;
  accion: AccionCdr;
  /** `true` si el comprobante tributariamente no tiene efecto. */
  anulaComprobante: boolean;
  /** `true` si el contribuyente debe corregir el XML y reenviar. */
  requiereCorreccion: boolean;
}

interface ReglaCdr {
  descripcion: string;
  accion: AccionCdr;
}

/** Reglas explícitas para los códigos más frecuentes en producción. */
const REGLAS: Record<string, ReglaCdr> = {
  '0': { descripcion: 'El comprobante fue aceptado', accion: 'ACEPTADO' },
  '1033': {
    descripcion: 'El comprobante fue registrado previamente como rechazado',
    accion: 'RECHAZADO',
  },
  '1032': {
    descripcion: 'El comprobante fue registrado previamente con otro estado',
    accion: 'RECHAZADO',
  },
  '2017': {
    descripcion: 'El número de documento de identidad del receptor no existe',
    accion: 'RECHAZADO',
  },
  '2022': {
    descripcion: 'El número de RUC del receptor coincide con el del emisor',
    accion: 'RECHAZADO',
  },
  '2335': {
    descripcion: 'El comprobante fue emitido fuera del plazo permitido (3 días)',
    accion: 'RECHAZADO',
  },
  '2800': {
    descripcion: 'El comprobante ya fue informado en un resumen',
    accion: 'OBSERVADO',
  },
  '3267': {
    descripcion: 'La cuota no cumple con el redondeo a dos decimales',
    accion: 'OBSERVADO',
  },
  '3270': {
    descripcion: 'El campo importe total con IGV presenta diferencia',
    accion: 'OBSERVADO',
  },
  '4000': {
    descripcion: 'El documento presenta un error en el XML',
    accion: 'RECHAZADO',
  },
  '4195': {
    descripcion: 'La fecha de emisión no está dentro del periodo informado',
    accion: 'RECHAZADO',
  },
  '5000': {
    descripcion: 'Error interno de SUNAT, reintentar el envío',
    accion: 'REINTENTAR',
  },
};

/**
 * Clasifica un código de respuesta del CDR.
 *
 * Los códigos desconocidos se tratan de forma conservadora: si empiezan con
 * `1`/`2` y no están en la tabla se considera observación; el resto, rechazo.
 * Nunca se devuelve `ACEPTADO` para un código distinto de `0`.
 */
export const classifyCdrRule = (codigo: string | number): ClasificacionCdr => {
  const clave = String(codigo ?? '').trim();

  if (clave === '' || clave === '0') {
    return {
      codigo: clave || '0',
      descripcion: REGLAS['0'].descripcion,
      accion: 'ACEPTADO',
      anulaComprobante: false,
      requiereCorreccion: false,
    };
  }

  const regla = REGLAS[clave];

  if (regla) {
    return {
      codigo: clave,
      descripcion: regla.descripcion,
      accion: regla.accion,
      anulaComprobante: regla.accion === 'RECHAZADO',
      requiereCorreccion: regla.accion !== 'REINTENTAR',
    };
  }

  // Códigos de observación documentados por SUNAT: prefijos 2xxx y 3xxx.
  const esObservacion = /^[23]\d{3}$/.test(clave);

  return {
    codigo: clave,
    descripcion: esObservacion
      ? `Observación ${clave} no catalogada: revise el detalle del CDR`
      : `Código de respuesta ${clave} no catalogado: el comprobante fue rechazado`,
    accion: esObservacion ? 'OBSERVADO' : 'RECHAZADO',
    anulaComprobante: !esObservacion,
    requiereCorreccion: true,
  };
};

/** Indica si el CDR implica que el comprobante debe reenviarse. */
export const debeReintentar = (codigo: string | number): boolean =>
  classifyCdrRule(codigo).accion === 'REINTENTAR';

/** Indica si el comprobante quedó con efecto tributario. */
export const esAceptado = (codigo: string | number): boolean => {
  const accion = classifyCdrRule(codigo).accion;
  return accion === 'ACEPTADO' || accion === 'OBSERVADO';
};

/** Mapea la acción del CDR al estado interno del comprobante. */
export const estadoPorAccion = (accion: AccionCdr): string => {
  switch (accion) {
    case 'ACEPTADO':
      return 'ACEPTADO';
    case 'OBSERVADO':
      return 'ACEPTADO_OBSERVADO';
    case 'REINTENTAR':
      return 'EN_COLA';
    default:
      return 'RECHAZADO';
  }
};
