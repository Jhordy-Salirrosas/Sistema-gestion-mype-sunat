import axios from 'axios';

const mensajes: Record<string, string> = {
  ISSUER_RUC_INVALID: 'El RUC emisor debe tener exactamente 11 dígitos o quedar vacío para limpiar.',
  ISSUER_SOL_RUC_MISMATCH: 'El RUC emisor no coincide con el usuario SOL configurado.',
  CONFIG_INPUT_INVALID: 'Revise los campos y sus longitudes.',
  CONFIG_ENV_INVALID: 'Seleccione un ambiente válido.',
  CONFIG_CERT_INVALID: 'El certificado o su contraseña no son válidos. Revise el archivo PKCS#12, la vigencia y el RUC.',
  ISSUER_SOL_GROUP_INCOMPLETE: 'Para configurar SOL por primera vez, ingrese usuario y contraseña juntos.',
  ISSUER_CERT_GROUP_INCOMPLETE: 'Para configurar el certificado por primera vez, cargue el archivo y su contraseña juntos.',
  CONFIG_SAVE_FAILED: 'No se pudo guardar la configuración. Intente nuevamente.',
};
export function invoiceConfigError(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const status = error.response?.status;
    const message: unknown = error.response?.data?.message;
    const codigo = Array.isArray(message) ? message.join('; ') : typeof message === 'string' ? message : '';
    const detalle = mensajes[codigo] ?? codigo;
    const titulo = status === 401 ? 'La sesión ha caducado. Inicie sesión nuevamente.'
      : status === 403 ? 'Solo un administrador puede guardar esta configuración.'
      : status === 400 ? 'No se pudo guardar: revise la configuración.' : 'No se pudo completar la solicitud.';
    return detalle ? `${titulo} ${detalle}` : titulo;
  }
  return error instanceof Error ? error.message : 'No se pudo completar la solicitud.';
}
