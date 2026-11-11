/** Clasificación física de M1, distinta de la totalidad monetaria del catálogo. */
export function devuelveUnidades(motivo: string | null | undefined): boolean {
  return ['01', '02', '06', '07'].includes(motivo ?? '');
}

/** Marca exclusiva de altas nuevas; nunca se añade al preparar o reprocesar legado. */
export const VERSION_DEVOLUCION_FISICA_02 = 1;
export function esNota02Historica(tipo: string, motivo: string | undefined, version?: number): boolean {
  return tipo === '07' && motivo === '02' && version !== VERSION_DEVOLUCION_FISICA_02;
}
