/**
 * Catálogo de códigos de respuesta y descripciones oficiales de SUNAT.
 * Transcrito de la hoja CodigosRetorno (Reglas de validación SUNAT).
 */

export const SUNAT_NON_RETRYABLE_EXCEPTION_CODES: ReadonlySet<string> = new Set([
  // Seguridad y credenciales
  '0101', '0102', '0103', '0104', '0105', '0106', '0111', '0112', '0113',
  // Formato y nombre del archivo o del ZIP
  '0151', '0156', '0157', '0158', '0159', '0160', '0161',
  // XML y firma
  '0300', '0301', '0303', '0304', '0305', '0306',
  // Reenvíos y duplicados
  '1032', '1033', '1034', '1035', '1036', '1049',
]);

export const SUNAT_RESPONSE_CODES: Record<string, string> = {
  '0': 'El comprobante fue aceptado',
  '0100': 'El sistema no puede responder su solicitud. Intente nuevamente o comuniquese con su Administrador',
  '0101': 'El encabezado de seguridad es incorrecto',
  '0102': 'Usuario o contrasena incorrectos',
  '0103': 'El Usuario ingresado no existe',
  '0104': 'La Clave ingresada es incorrecta',
  '0105': 'El Usuario no esta activo',
  '0106': 'El Usuario no es valido',
  '0109': 'El sistema no puede responder su solicitud. (El servicio de autenticacion no responde)',
  '0110': 'No se pudo obtener la informacion del tipo de usuario',
  '0111': 'No tiene el perfil para enviar comprobantes electronicos',
  '0112': 'El usuario debe ser secundario',
  '0113': 'El usuario no esta afiliado a Factura Electronica',
  '0151': 'El nombre del archivo ZIP es incorrecto',
  '0156': 'El archivo ZIP esta vacio',
  '0157': 'El archivo ZIP esta corrupto',
  '0158': 'El archivo ZIP contiene demasiados comprobantes para este tipo de envio',
  '0159': 'El nombre del archivo XML es incorrecto',
  '0160': 'El XML no cumple con el formato establecido',
  '0161': 'El nombre del archivo XML no coincide con el nombre del archivo ZIP',
  '0200': 'El comprobante fue rechazado por errores en su estructura',
  '0201': 'El comprobante ya fue informado con anterioridad',
  '0202': 'El comprobante no existe',
  '0204': 'El comprobante fue emitido en un entorno distinto al de produccion',
  '0300': 'No se encontro la raiz documento xml',
  '0301': 'El XML no contiene firmas digitales',
  '0303': 'El comprobante fue alterado despues de ser firmado',
  '0304': 'El certificado utilizado para firmar el XML esta vencido',
  '0305': 'El XML no corresponde a un comprobante electronico o no cumple con el formato',
  '0306': 'El XML no contiene el tag de la firma digital',
  '0400': 'El comprobante fue rechazado por reglas de validacion',
  '0401': 'El comprobante ya fue informado',
  '0402': 'La numeracion o nombre del documento ya ha sido enviado anteriormente',
  '0403': 'El comprobante fue dado de baja previamente',
  '0404': 'El comprobante fue rechazado por el OSE o PSE',
  '1032': 'El comprobante ya esta informado y se encuentra con estado anulado o rechazado',
  '1033': 'El comprobante fue registrado previamente con otros datos',
  '1034': 'Numero de RUC del nombre del archivo no coincide con el consignado en el contenido del archivo XML',
  '1035': 'Numero de Serie del nombre del archivo no coincide con el consignado en el contenido del archivo XML',
  '1036': 'Numero de documento en el nombre del archivo no coincide con el consignado en el contenido del XML',
  '1049': 'ID - Serie y Numero del archivo no coincide con el consignado en el contenido del XML',
  '2326': 'El certificado usado se encuentra de baja',
  '2335': 'El documento electronico ingresado ha sido alterado',
  '2600': 'El comprobante fue rechazado por inconsistencia en los montos',
  '4000': 'El documento ya fue presentado anteriormente',
  '4001': 'El numero de RUC del receptor no existe',
  '4002': 'Para el TaxTypeCode, esta usando un valor que no existe en el catalogo',
  '4031': 'Debe indicar el nombre comercial',
  '4398': 'El Numero de placa no se encuentra en las bases consultadas',
  '4399': 'No ha consignado el Numero de Constancia de Inscripcion Vehicular o Certificado de Habilitacion Vehicular o la TUC',
};

export function describeSunatCode(code: string): string | null {
  const direct = SUNAT_RESPONSE_CODES[code];
  if (direct) return direct;

  if (/^\d+$/.test(code) && code.length < 4 && Number(code) !== 0) {
    return SUNAT_RESPONSE_CODES[code.padStart(4, '0')] ?? null;
  }
  return null;
}
