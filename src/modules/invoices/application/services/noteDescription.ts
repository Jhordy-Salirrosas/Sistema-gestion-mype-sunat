import { CATALOGO_09_MOTIVOS, CATALOGO_10_MOTIVOS } from './noteCatalogs';
import { validarMotivoNota, validarSustentoOtros } from './noteReasonGuard';

/** Valida antes de derivar; conserva literalmente las descripciones personalizadas. */
export function descripcionCanonicaNota(tipo: string, codigo: string | undefined, descripcion?: string): string | undefined {
  if (!['07', '08'].includes(tipo)) return descripcion;
  validarMotivoNota(tipo, codigo);
  validarSustentoOtros(tipo, codigo, descripcion);
  if (descripcion?.trim()) return descripcion;
  return (tipo === '07' ? CATALOGO_09_MOTIVOS : CATALOGO_10_MOTIVOS).find(m => m.codigo === codigo)!.descripcion;
}
