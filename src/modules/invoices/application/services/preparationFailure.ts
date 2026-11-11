import { BadRequestException } from '@nestjs/common';

export type EtapaPreparacion = 'CARGA' | 'DESCRIPCION_NOTA' | 'GENERACION_UBL' | 'CONFIGURACION_EMISOR' | 'FIRMA' | 'ZIP' | 'PERSISTENCIA_XML' | 'VALIDACION_LOCAL';
export interface CausaPreparacion { codigo: string; etapa: EtapaPreparacion; categoria: 'DATOS_INVALIDOS' | 'CERTIFICADO' | 'CONFIGURACION' | 'INFRAESTRUCTURA'; recuperable: boolean; causa: string; }
const etapas = new WeakMap<object, EtapaPreparacion>();
export function registrarEtapa(error: unknown, etapa: EtapaPreparacion): void {
  if (error && typeof error === 'object') etapas.set(error, etapa);
}
/** Lista cerrada: nunca persiste mensajes de drivers, credenciales, XML ni payloads. */
export function clasificarPreparacion(error: unknown): CausaPreparacion {
  const etapa = error && typeof error === 'object' ? etapas.get(error) ?? 'CARGA' : 'CARGA';
  const mensaje = error instanceof Error ? error.message : '';
  const datos = error instanceof BadRequestException || /XML inv[aá]lido|sin payload_ubl/.test(mensaje);
  const categoria = etapa === 'FIRMA' ? 'CERTIFICADO' : etapa === 'CONFIGURACION_EMISOR' ? 'CONFIGURACION' : datos ? 'DATOS_INVALIDOS' : 'INFRAESTRUCTURA';
  const causa = { DATOS_INVALIDOS: 'El contenido fiscal no supera la validación local; revise los datos del documento.',
    CERTIFICADO: 'No se pudo obtener una firma verificable; revise el certificado y su configuración.',
    CONFIGURACION: 'No se pudo resolver la configuración del emisor; revise su configuración fiscal.',
    INFRAESTRUCTURA: 'No se pudo completar la preparación local; revise la infraestructura y reintente.' }[categoria];
  return { codigo: `M1_PREPARATION_${categoria}`, etapa, categoria, recuperable: categoria !== 'DATOS_INVALIDOS', causa };
}
