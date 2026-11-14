import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { createHash, randomUUID } from 'node:crypto';
import {
  SIRE_FILE_STORAGE_PORT,
  type SireArchivoAGrabar,
  type SireArchivoGuardado,
  type SireFileStoragePort,
} from '../../domain/ports/sireFileStoragePort';

/** Bucket por defecto de los archivos SIRE. */
export const SIRE_BUCKET_POR_DEFECTO = 'sire';

/**
 * Normaliza el nombre del archivo para poder usarlo como parte de una ruta.
 *
 * SUNAT devuelve nombres con caracteres que no son válidos en una clave de
 * objeto (barras, dos puntos, espacios). Se reducen a letras, dígitos, punto,
 * guion y guion bajo.
 */
export function sanitizarNombreArchivo(nombreArchivo: string): string {
  const base = nombreArchivo.split(/[\\/]/).pop() ?? nombreArchivo;
  const limpio = base.replace(/[^A-Za-z0-9._-]/g, '_').replace(/_+/g, '_');
  return limpio.length > 0 ? limpio.slice(0, 180) : 'archivo';
}

/**
 * Construye la clave del objeto dentro del bucket.
 *
 * El identificador aleatorio evita que dos cargas del mismo archivo (con el
 * mismo nombre) se pisen entre sí.
 */
export function construirRutaSire(
  companyId: string,
  periodo: string,
  nombreArchivo: string,
  token: string = randomUUID(),
): string {
  return `sire/${companyId}/${periodo}/${token}-${sanitizarNombreArchivo(nombreArchivo)}`;
}

/**
 * Adaptador que guarda el archivo en Supabase Storage.
 *
 * La URL y la clave se leen del entorno (`SUPABASE_URL` y `SUPABASE_KEY`), que
 * es como este proyecto ya se conecta a Supabase. Si no están configuradas el
 * adaptador no se instancia: el selector cae al backend local.
 */
export class SupabaseSireFileStorage implements SireFileStoragePort {
  private readonly client: SupabaseClient;
  private readonly bucket: string;

  constructor(url: string, key: string, bucket: string = SIRE_BUCKET_POR_DEFECTO) {
    this.client = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    this.bucket = bucket;
  }

  async guardar(archivo: SireArchivoAGrabar): Promise<SireArchivoGuardado> {
    const ruta = construirRutaSire(
      archivo.companyId,
      archivo.periodo,
      archivo.nombreArchivo,
    );

    const { error } = await this.client.storage
      .from(this.bucket)
      .upload(ruta, archivo.contenido, {
        contentType: 'application/octet-stream',
        upsert: false,
      });

    if (error) {
      throw new Error(`Supabase Storage rechazó la carga: ${error.message}`);
    }

    return {
      ruta,
      hash: createHash('sha256').update(archivo.contenido).digest('hex'),
      backend: 'SUPABASE',
      bytes: archivo.contenido.length,
    };
  }
}

export { SIRE_FILE_STORAGE_PORT };
