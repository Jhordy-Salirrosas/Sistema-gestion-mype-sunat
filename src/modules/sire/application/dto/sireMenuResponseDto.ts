import type { SireLibroMenu } from './sireMenuQueryDto';
import type {
  SireComprobanteSimulado,
  SireResumenSimulado,
} from '../../domain/rules/sireMockDataRule';

/**
 * Estados que devuelve el menú SIRE.
 *
 * Son los mismos que persiste la tabla `sire_*` (columna `estado`), de modo
 * que el frontend puede mostrarlos sin traducción.
 */
export type SireEstadoTrabajo = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';

/**
 * Respuesta de la importación de una propuesta.
 *
 * El `messageId` es lo que el frontend usa para el sondeo: no hay que esperar
 * a que termine el procesamiento dentro de la misma petición.
 */
export interface SireImportacionRespuesta {
  messageId: string;
  importacionId: string;
  periodo: string;
  libro: SireLibroMenu;
  nombreArchivo: string;
  estado: SireEstadoTrabajo;
  rutaArchivo: string;
  backendAlmacen: string;
  hashArchivo: string;
  bytes: number;
  createdAt: string;
}

/**
 * Estado de un trabajo en curso, para el sondeo del frontend.
 *
 * `message` es el texto LISTO para mostrar: cuando el worker falla, el
 * backend lo deja escrito para que el frontend no tenga que traducir códigos
 * de error ni inventar un texto. Es `null` mientras el trabajo no ha fallado.
 */
export interface SireTrabajoEstadoRespuesta {
  messageId: string;
  estado: SireEstadoTrabajo;
  periodo: string;
  libro: SireLibroMenu;
  createdAt: string;
  completedAt: string | null;
  errorCode: string | null;
  message: string | null;
  ticket?: string | null;
}

/**
 * Respuesta de la conciliación de un periodo.
 */
export interface SireConciliacionRespuesta {
  conciliacionId: string;
  periodo: string;
  libro: SireLibroMenu;
  resumen: SireResumenSimulado;
  comprobantes: SireComprobanteSimulado[];
  createdAt: string;
}

/** Respuesta del resumen de un periodo. */
export interface SireResumenRespuesta {
  periodo: string;
  libro: SireLibroMenu | null;
  resumen: SireResumenSimulado;
  importaciones: number;
  conciliaciones: number;
  reportes: number;
}

/** Respuesta del envío del libro a SUNAT. */
export interface SireReporteRespuesta {
  messageId: string;
  reporteId: string;
  periodo: string;
  libro: SireLibroMenu;
  estado: SireEstadoTrabajo;
  ticket: string | null;
  createdAt: string;
}

/**
 * Fila del historial unificado.
 *
 * `tipoAccion` dice QUÉ se hizo y `estado` si terminó bien. Son los dos
 * campos que el frontend muestra en la tabla del historial.
 */
export interface SireHistorialFila {
  id: string;
  fecha: string;
  tipoAccion: 'IMPORTACION' | 'CONCILIACION' | 'REPORTE';
  periodo: string;
  estado: string;
  detalle: string | null;
}

/** Respuesta del historial unificado. */
export interface SireHistorialRespuesta {
  total: number;
  filas: SireHistorialFila[];
}
