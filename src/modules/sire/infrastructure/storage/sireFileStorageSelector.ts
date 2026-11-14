import { Logger } from '@nestjs/common';
import {
  type SireArchivoAGrabar,
  type SireArchivoGuardado,
  type SireFileStoragePort,
} from '../../domain/ports/sireFileStoragePort';
import { LocalSireFileStorage } from './localSireFileStorage';
import { SupabaseSireFileStorage } from './supabaseSireFileStorage';

/**
 * Almacenamiento con respaldo.
 *
 * Intenta primero en Supabase Storage y, si la carga falla (el bucket no
 * existe, la clave no tiene permisos, la red se cae), deja el archivo en el
 * disco del backend en lugar de tumbar la importación.
 *
 * POR QUÉ NO ES UN ERROR
 *
 * El archivo ya fue validado y aceptado por el usuario: perderlo por un
 * problema de almacenamiento sería peor que guardarlo en otro sitio. El
 * backend que se usó queda registrado en `sire_importaciones.backend_almacen`
 * para que el seguimiento sea transparente.
 */
export class ResilientSireFileStorage implements SireFileStoragePort {
  private readonly logger = new Logger(ResilientSireFileStorage.name);

  constructor(
    private readonly principal: SireFileStoragePort | null,
    private readonly respaldo: SireFileStoragePort,
    private readonly alFallar?: (mensaje: string) => void,
  ) {}

  async guardar(archivo: SireArchivoAGrabar): Promise<SireArchivoGuardado> {
    if (this.principal) {
      try {
        return await this.principal.guardar(archivo);
      } catch (error) {
        const mensaje = `No se pudo guardar el archivo en Supabase Storage: ${
          error instanceof Error ? error.message : String(error)
        }. Se continúa con el almacenamiento local.`;
        this.logger.warn(mensaje);
        this.alFallar?.(mensaje);
      }
    }

    return this.respaldo.guardar(archivo);
  }
}

/**
 * Elige el almacenamiento a partir de la configuración del entorno.
 *
 * Se construye el adaptador de Supabase solo si hay URL y clave: sin ellas no
 * hay cliente y la carga siempre terminaría en el respaldo local.
 */
export function crearSireFileStorage(
  entorno: NodeJS.ProcessEnv = process.env,
): SireFileStoragePort {
  const url = entorno['SUPABASE_URL']?.trim();
  const key = entorno['SUPABASE_KEY']?.trim();
  const bucket = entorno['SUPABASE_STORAGE_BUCKET']?.trim();

  return new ResilientSireFileStorage(
    url && key ? new SupabaseSireFileStorage(url, key, bucket) : null,
    crearAlmacenamientoLocal(entorno),
  );
}

/**
 * Fábrica del adaptador local.
 */
export function crearAlmacenamientoLocal(
  entorno: NodeJS.ProcessEnv = process.env,
): SireFileStoragePort {
  const carpeta = entorno['SIRE_STORAGE_LOCAL_DIR']?.trim();
  return new LocalSireFileStorage(carpeta || undefined);
}
