export type ResultadoReintentoMasivo = 'EN_CURSO' | 'ELEGIBLE' | 'ENCOLADO' | 'OMITIDO_INCERTIDUMBRE' | 'OMITIDO_RECHAZO_DEFINITIVO' | 'OMITIDO_BLOQUEO_LOCAL' | 'YA_EN_COLA' | 'OMITIDO_ESTADO' | 'NO_CONFIRMADO';
export interface DetalleReintentoMasivo {
  id: string; numero: string; estado: string; resultado: ResultadoReintentoMasivo; motivo: string;
}
export interface ReintentoMasivoDto {
  fase: 'PREVIA' | 'EJECUTADA';
  elegibles: number; encolados: number; omitidos_incertidumbre: number;
  omitidos_rechazo_definitivo: number; omitidos_bloqueo_local: number;
  en_curso: number; ya_en_cola: number; omitidos_estado: number; no_confirmados: number;
  documentos: DetalleReintentoMasivo[];
}
