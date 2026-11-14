import { BadRequestException } from '@nestjs/common';
import { CATALOGO_09_MOTIVOS, CATALOGO_10_MOTIVOS } from './noteCatalogs';

/** Catálogos oficiales del set SFS del repo; no equivale a habilitar todos sus motivos en M1. */
export const MOTIVOS_OFICIALES_NC = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12', '13'] as const;
export const MOTIVOS_OFICIALES_ND = ['01', '02', '03', '11', '12'] as const;
export function validarMotivoNota(tipo: string, codigo: string | undefined): void {
  const credito = tipo === '07';
  const oficial: readonly string[] = credito ? MOTIVOS_OFICIALES_NC : MOTIVOS_OFICIALES_ND;
  const habilitados = credito ? CATALOGO_09_MOTIVOS : CATALOGO_10_MOTIVOS;
  if (!codigo || !oficial.includes(codigo)) throw new BadRequestException({ code: 'MOTIVO_INVALIDO', message: `El motivo ${codigo ?? '(ausente)'} no pertenece al Catálogo ${credito ? '09' : '10'}. Los códigos oficiales son ${oficial.join(', ')}.` });
  if (!habilitados.some(m => m.codigo === codigo)) throw new BadRequestException({ code: 'MOTIVO_NO_HABILITADO', message: `El motivo ${codigo} es oficial pero no está habilitado en M1.` });
}
export function validarImporteNota(total: number): void {
  if (!Number.isFinite(total) || total <= 0) throw new BadRequestException({ code: 'NOTA_IMPORTE_INVALIDO', message: 'El importe total de la nota debe ser mayor que cero.' });
}

/** Alcance 10: ajuste monetario sobre el origen, con sustento explícito; sin rectificación aislada de IGV. */
export function validarSustentoOtros(tipo: string, codigo: string | undefined, descripcion?: string): void {
  if (tipo === '07' && codigo === '10' && (!descripcion?.trim() || descripcion.trim().toLocaleLowerCase('es') === 'otros conceptos')) {
    throw new BadRequestException({ code: 'NOTA_SUSTENTO_REQUERIDO', message: 'Describa el ajuste y su sustento para Otros conceptos. No se admite corregir únicamente el IGV.' });
  }
}
