import { basename, resolve } from 'node:path';
import { existsSync, readFileSync, realpathSync } from 'node:fs';

/** Selección explícita; nunca permite presentar el CSV de ejemplo como padrón oficial. */
export function archivoPadronOficial(ruta?: string): string {
  if (!ruta?.trim()) throw new Error('Debe indicar explícitamente la ruta del archivo oficial del padrón de retención; no hay archivo por defecto.');
  const archivo = realpathSync(ruta);
  const ejemplo = resolve('scripts/data/agentes-retencion.example.csv');
  if (basename(archivo) === 'agentes-retencion.example.csv' ||
      (existsSync(ejemplo) && readFileSync(archivo, 'utf8').trim() === readFileSync(ejemplo, 'utf8').trim())) {
    throw new Error('No se permite sembrar el padrón desde el archivo de ejemplo. Indique un archivo oficial verificado.');
  }
  return archivo;
}
