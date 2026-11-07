/**
 * Configuración de Facturación Electrónica (TA-61).
 *
 * Los datos que un contribuyente puede configurar sin volver a la SUNAT: su
 * razón social y dirección (que van impresas en cada comprobante), las series
 * disponibles por tipo y el ambiente (beta o producción).
 *
 * Aquí NO se edita el RUC: es la identidad fiscal de la empresa y cambiarlo
 * invalidaría todos los comprobantes ya emitidos. Se muestra y se deja de solo
 * lectura.
 */

/** Ambiente de SUNAT: beta (pruebas) o producción. */
export type AmbienteFe = 'beta' | 'produccion';

/** Configuración editable de facturación. */
export interface ConfiguracionFe {
  ruc: string;
  razonSocial: string;
  nombreComercial: string;
  direccion: string;
  ubigeo: string;
  ambiente: AmbienteFe;
  /** Correo que recibe copia de cada comprobante emitido. */
  correoCopia?: string;
  /** Cuenta del Banco de la Nación por defecto para la detracción. */
  cuentaBancoNacion?: string;
}

/** Serie de comprobante disponible para la empresa. */
export interface SerieFe {
  /** Código de la serie: F001, B001, FC01... */
  serie: string;
  /** Tipo del Catálogo 01 al que corresponde. */
  tipoComprobante: string;
  /** Siguiente correlativo libre, si el backend lo conoce. */
  siguienteCorrelativo?: number;
  /** ¿Está activa para emitir? */
  activa: boolean;
}

/** Resultado de validar la configuración. */
export interface ErroresConfiguracion {
  [campo: string]: string | undefined;
}

/** Códigos que admite el campo ubigeo: 6 dígitos (INEI). */
const UBIGEO = /^\d{6}$/;

/** Correo con una forma razonable; no se pretende validar el RFC completo. */
const CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Cuenta del Banco de la Nación: solo dígitos. */
const CUENTA_BN = /^\d{6,20}$/;

/**
 * Valida la configuración antes de enviarla.
 *
 * Se valida en el navegador para no mandar datos que el backend va a rechazar,
 * pero el backend vuelve a validar: esta capa es comodidad, no seguridad.
 */
export const validarConfiguracion = (
  config: ConfiguracionFe,
): ErroresConfiguracion => {
  const errores: ErroresConfiguracion = {};

  if (!config.razonSocial.trim()) {
    errores.razonSocial = 'La razón social es obligatoria.';
  } else if (config.razonSocial.trim().length < 3) {
    errores.razonSocial = 'La razón social es demasiado corta.';
  }

  if (!config.direccion.trim()) {
    errores.direccion = 'La dirección fiscal es obligatoria.';
  }

  // El ubigeo deja de ser opcional: sin él, el XML no puede llevar
  // `RegistrationAddress` y la dirección impresa no coincide con el domicilio
  // fiscal declarado.
  if (!config.ubigeo.trim()) {
    errores.ubigeo = 'El ubigeo es obligatorio.';
  } else if (!UBIGEO.test(config.ubigeo.trim())) {
    errores.ubigeo = 'El ubigeo debe tener 6 dígitos (código INEI).';
  }

  if (config.correoCopia && !CORREO.test(config.correoCopia.trim())) {
    errores.correoCopia = 'El correo no tiene un formato válido.';
  }

  if (
    config.cuentaBancoNacion &&
    !CUENTA_BN.test(config.cuentaBancoNacion.replace(/\D/g, ''))
  ) {
    errores.cuentaBancoNacion =
      'La cuenta del Banco de la Nación debe tener entre 6 y 20 dígitos.';
  }

  if (config.ambiente === 'produccion' && !config.cuentaBancoNacion) {
    // En producción, una factura con detracción sin cuenta impresa obliga al
    // cliente a llamar para saber dónde depositar.
    errores.cuentaBancoNacion =
      'En producción indique la cuenta del Banco de la Nación: la necesitan los comprobantes con detracción.';
  }

  return errores;
};

/** ¿Hay algún error? */
export const tieneErrores = (errores: ErroresConfiguracion): boolean =>
  Object.values(errores).some((error) => Boolean(error));

/** Configuración por defecto para el formulario. */
export const configuracionVacia = (ruc: string): ConfiguracionFe => ({
  ruc,
  razonSocial: '',
  nombreComercial: '',
  direccion: '',
  ubigeo: '',
  ambiente: 'beta',
  correoCopia: '',
  cuentaBancoNacion: '',
});

/** ¿La serie corresponde al tipo de comprobante? */
export const serieCoherente = (tipo: string, serie: string): boolean => {
  const s = serie.toUpperCase();
  if (s.length !== 4) return false;

  if (tipo === '01') return s.startsWith('F') && !s.startsWith('FC') && !s.startsWith('FD');
  if (tipo === '03') return s.startsWith('B') && !s.startsWith('BC') && !s.startsWith('BD');
  if (tipo === '07') return s.startsWith('FC') || s.startsWith('BC');
  if (tipo === '08') return s.startsWith('FD') || s.startsWith('BD');
  return false;
};

/** Nombre legible del tipo del Catálogo 01. */
export const nombreTipo = (tipo: string): string => {
  const nombres: Record<string, string> = {
    '01': 'Factura',
    '03': 'Boleta de venta',
    '07': 'Nota de crédito',
    '08': 'Nota de débito',
  };
  return nombres[tipo] ?? `Tipo ${tipo}`;
};

/** Aviso que se muestra al cambiar de ambiente. */
export const avisoAmbiente = (ambiente: AmbienteFe): string =>
  ambiente === 'produccion'
    ? 'Los comprobantes que emita con este ambiente tienen validez tributaria real y no se pueden borrar: solo anular con una nota de crédito.'
    : 'En ambiente beta los comprobantes se envían al servidor de pruebas de SUNAT y no tienen validez tributaria.';
