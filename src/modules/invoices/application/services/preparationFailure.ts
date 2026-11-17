import { BadRequestException } from '@nestjs/common';
import { ErrorValidacionBloqueada } from './invoiceSendGate';

export type EtapaPreparacion = 'CARGA' | 'DESCRIPCION_NOTA' | 'GENERACION_UBL' | 'CONFIGURACION_EMISOR' | 'FIRMA' | 'ZIP' | 'PERSISTENCIA_XML' | 'VALIDACION_LOCAL';
export interface CausaPreparacion { codigo: string; etapa: EtapaPreparacion; categoria: 'DATOS_INVALIDOS' | 'CERTIFICADO' | 'CONFIGURACION' | 'INFRAESTRUCTURA'; recuperable: boolean; causa: string; detalleDiagnostico?: { claseError: string; motivo?: string }; }
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
  const detalleDiagnostico = etapa === 'VALIDACION_LOCAL' ? diagnosticoLocal(error) : undefined;
  return { codigo: `M1_PREPARATION_${categoria}`, etapa, categoria, recuperable: categoria !== 'DATOS_INVALIDOS', causa,
    ...(detalleDiagnostico ? { detalleDiagnostico } : {}) };
}

// Motivos emitidos por la compuerta y el ejecutor actuales. No aceptar texto
// arbitrario de error.message/motivo: puede incluir XML, SQL o credenciales.
const MOTIVOS_LOCALES = new Set([
  'NO_CONCLUYENTE', 'BYPASS_NO_PERMITIDO', 'VALIDACION_OFICIAL_NO_DISPONIBLE',
  'SIN_MOTIVO', 'XML_NO_PERSISTIDO', 'Ejecutor Python SFS no disponible',
  'Ejecutor SFS no disponible', 'Ejecutor SFS no completó la validación',
]);
function diagnosticoLocal(error: unknown): { claseError: string; motivo?: string } {
  if (error instanceof ErrorValidacionBloqueada) {
    const timeout = /^Ejecutor SFS excedió ([1-9]\d{0,9}) ms$/.exec(error.motivo);
    const conocido = MOTIVOS_LOCALES.has(error.motivo) || (timeout !== null && Number(timeout[1]) <= 2_147_483_647);
    return { claseError: 'ErrorValidacionBloqueada', motivo: conocido ? error.motivo : 'MOTIVO_NO_CATALOGADO' };
  }
  // Usar la clase del prototipo, nunca la propiedad mutable error.name ni el
  // mensaje. Los valores lanzados que no son Error no se serializan.
  const clase = error instanceof Error ? Object.getPrototypeOf(error)?.constructor?.name : undefined;
  return { claseError: typeof clase === 'string' && /^[A-Za-z][A-Za-z0-9_]{0,63}$/.test(clase) ? clase : 'ErrorNoIdentificado' };
}
