/**
 * Puerto de almacenamiento de los archivos de propuesta SIRE.
 *
 * POR QUÉ UN PUERTO Y NO UNA LLAMADA DIRECTA A SUPABASE
 *
 * El archivo de propuesta se guarda FUERA de la base de datos (en Supabase
 * Storage o, si no está disponible, en el disco del backend). La capa de
 * aplicación no debe saber en cuál de los dos. El puerto declara lo que el
 * caso de uso necesita —"guarda este archivo y dime dónde quedó y con qué
 * hash"— y cada adaptador lo resuelve a su manera.
 */

export const SIRE_FILE_STORAGE_PORT = Symbol('SIRE_FILE_STORAGE_PORT');

/** Backend donde quedó guardado el archivo. */
export type SireStorageBackend = 'SUPABASE' | 'LOCAL';

/** Datos del archivo guardado. */
export interface SireArchivoGuardado {
  /** Ruta o clave con la que se puede volver a localizar el archivo. */
  ruta: string;
  /** SHA-256 del contenido, para detectar cargas duplicadas. */
  hash: string;
  /** Backend effective en el que se guardó. */
  backend: SireStorageBackend;
  /** Tamaño del archivo en bytes. */
  bytes: number;
}

/** Entrada del puerto de almacenamiento. */
export interface SireArchivoAGrabar {
  companyId: string;
  periodo: string;
  nombreArchivo: string;
  contenido: Buffer;
}

export interface SireFileStoragePort {
  /**
   * Guarda el archivo y devuelve la ruta, el hash y el backend usado.
   */
  guardar(archivo: SireArchivoAGrabar): Promise<SireArchivoGuardado>;
}
