import { createHash, randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import {
  type SireArchivoAGrabar,
  type SireArchivoGuardado,
  type SireFileStoragePort,
} from '../../domain/ports/sireFileStoragePort';
import { construirRutaSire, sanitizarNombreArchivo } from './supabaseSireFileStorage';

/** Carpeta raíz por defecto cuando no se configura ninguna. */
export const SIRE_CARPETA_LOCAL_POR_DEFECTO = 'sire-uploads';

/**
 * Adaptador que guarda el archivo en el disco del backend.
 *
 * Es el respaldo del almacenamiento de objetos: si Supabase Storage no está
 * configurado (o no acepta la carga) el archivo no se pierde, queda en una
 * carpeta local y la importación sigue adelante.
 */
export class LocalSireFileStorage implements SireFileStoragePort {
  private readonly raiz: string;

  constructor(raiz?: string) {
    this.raiz = resolve(raiz ?? join(tmpdir(), SIRE_CARPETA_LOCAL_POR_DEFECTO));
  }

  async guardar(archivo: SireArchivoAGrabar): Promise<SireArchivoGuardado> {
    const token = randomUUID();
    const rutaRelativa = construirRutaSire(
      archivo.companyId,
      archivo.periodo,
      archivo.nombreArchivo,
      token,
    );
    const rutaAbsoluta = join(this.raiz, rutaRelativa);

    await mkdir(join(this.raiz, 'sire', archivo.companyId, archivo.periodo), {
      recursive: true,
    });
    await writeFile(rutaAbsoluta, archivo.contenido);

    return {
      ruta: rutaAbsoluta,
      hash: createHash('sha256').update(archivo.contenido).digest('hex'),
      backend: 'LOCAL',
      bytes: archivo.contenido.length,
    };
  }
}

export { sanitizarNombreArchivo };
