import { BadRequestException } from '@nestjs/common';
import { fechaFiscalLima } from '../../fiscalDate';

export interface CancelMember { conditionCode?: string; acceptedDate?: string; noOtorgado?: boolean; }
export function esAnulacionRc(members: unknown): boolean {
  return Array.isArray(members) && members.length > 0 && members.every(m => m?.conditionCode === '3' && m.noOtorgado === true);
}
/** Solo evidencia de aceptación fiscal; no se usan updated_at ni eventos de puente. */
export function fechaAceptacionNota(row: { cdr_sunat?: unknown; history?: { created_at: Date; codigo_error: string | null; estado_nuevo: string }[] }): string | undefined {
  const eventos = (row.history ?? []).filter(e => e.codigo_error === '0' && ['ACEPTADO', 'OBSERVADO'].includes(e.estado_nuevo));
  if (eventos.length) return fechaFiscalLima(new Date(Math.min(...eventos.map(e => e.created_at.getTime()))));
  const fecha = (row.cdr_sunat as { responseDate?: unknown } | null)?.responseDate;
  return typeof fecha === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(fecha) ? fecha : undefined;
}
export function validarNotaAnulacionRc(doc: { tipoComprobante: string; serie: string; estado: string; fechaEmision: string; documentoAfectado?: string; tipoDocumentoAfectado?: string | null; fechaAceptacion?: string }, hoy: string): void {
  if ((doc.tipoDocumentoAfectado != null && doc.tipoDocumentoAfectado !== '03') || !['07', '08'].includes(doc.tipoComprobante) || !/^B[A-Z0-9]{3}$/.test(doc.serie) || !/^B[A-Z0-9]{3}-\d{1,8}$/.test(doc.documentoAfectado ?? '')) throw new BadRequestException('RC_ANULACION_TIPO: solo notas BC/BD vinculadas a boleta');
  if (!['ACEPTADO', 'OBSERVADO'].includes(doc.estado)) throw new BadRequestException('RC_ANULACION_ESTADO: solo notas aceptadas u observadas');
  const inicio = Date.parse(`${doc.fechaAceptacion}T00:00:00Z`), fin = Date.parse(`${hoy}T00:00:00Z`);
  const dias = (fin - inicio) / 86400000;
  if (!Number.isFinite(dias) || new Date(inicio).toISOString().slice(0, 10) !== doc.fechaAceptacion || dias < 0 || dias > 7 || doc.fechaEmision > doc.fechaAceptacion!) throw new BadRequestException('RC_ANULACION_PLAZO: se requiere fecha de aceptación acreditada dentro de los últimos 7 días');
}
