import { MOTIVOS_NC, MOTIVOS_ND } from './invoiceEmitValidation';

/** Los códigos de motivo se interpretan dentro del catálogo de cada tipo. */
export function descripcionMotivoNota(tipo: string, codigo: string): string {
  const catalogo = tipo === '07' ? MOTIVOS_NC : tipo === '08' ? MOTIVOS_ND : [];
  return catalogo.find(motivo => motivo.codigo === codigo)?.descripcion ?? '';
}
