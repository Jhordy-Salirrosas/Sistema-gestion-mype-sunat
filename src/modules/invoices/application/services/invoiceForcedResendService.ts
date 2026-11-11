import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../../database/prismaService';
import { QueueService } from '../../../resilience/infrastructure/queue/queue.service';
import type { Prisma } from '../../../../generated/client/client';
export const FORCE_AUTH = 'M1_FORCE_RESEND_AUTHORIZED';
export const FORCE_USED = 'M1_FORCE_RESEND_CONSUMED';
const estados = ['ERROR_RED', 'ENVIADO', 'EN_COLA', 'PENDIENTE', 'PROCESANDO'];
const incertidumbre = (row: { estado: string; transport_uncertain: boolean | null; cdr_sunat?: unknown }) => estados.includes(row.estado) && !row.cdr_sunat &&
 (row.transport_uncertain === true || (row.transport_uncertain == null && ['ERROR_RED','ENVIADO'].includes(row.estado)));
@Injectable()
export class InvoiceForcedResendService {
 constructor(private readonly prisma: PrismaService, private readonly queue: QueueService) {}
 private async pendiente(tx: Prisma.TransactionClient, id: string) {
  const rows = await tx.transactionHistory.findMany({ where: { invoice_id: id, codigo_error: { in: [FORCE_AUTH, FORCE_USED] } }, orderBy: { created_at: 'asc' } });
  const usados = new Set(rows.filter(r => r.codigo_error === FORCE_USED).map(r => { try { return JSON.parse(r.mensaje_error ?? '{}').autorizacionId; } catch { return null; } }));
  return [...rows].reverse().find(r => r.codigo_error === FORCE_AUTH && !usados.has(r.id));
 }
 async autorizar(companyId: string, id: string, actor: { sub?: string; role?: string }, body: unknown) {
  if (actor?.role !== 'ADMIN' || !actor.sub) throw new ForbiddenException('Solo ADMIN autenticado puede autorizar el reenvío forzado.');
  const input = body as { motivo?: unknown; confirmado?: unknown; decisionId?: unknown; renovarAutorizacionId?: unknown } | null;
  if (!input || input.confirmado !== true || typeof input.motivo !== 'string' || !input.motivo.trim() || input.motivo.length > 1000) throw new BadRequestException('Indique un motivo escrito (hasta 1000 caracteres) y confirme explícitamente el riesgo de duplicidad.');
  if (typeof input.decisionId !== 'string' || !/^[A-Za-z0-9_-]{16,128}$/.test(input.decisionId)) throw new BadRequestException('Indique el identificador estable de esta decisión.');
  const motivo = input.motivo.trim();
  const decision = await this.prisma.$transaction(async tx => {
   await tx.$queryRaw`SELECT id FROM invoices WHERE id = ${id} AND company_id = ${companyId} FOR UPDATE`;
   const row = await tx.invoice.findFirst({ where: { id, company_id: companyId } });
   if (!row) throw new NotFoundException('Comprobante no encontrado en la empresa');
   const history = await tx.transactionHistory.findMany({ where: { invoice_id: id, company_id: companyId }, orderBy: { created_at: 'asc' } });
   const datos = (texto: string | null) => { try { return JSON.parse(texto ?? '{}'); } catch { return {}; } };
   const usadas = new Set(history.filter(e => e.codigo_error === FORCE_USED).map(e => datos(e.mensaje_error).autorizacionId));
   const autorizaciones = history.filter(e => e.codigo_error === FORCE_AUTH);
   const replay = autorizaciones.find(e => datos(e.mensaje_error).decisionId === input.decisionId);
   if (replay) {
    if (datos(replay.mensaje_error).motivo !== motivo) throw new ConflictException('DECISION_REUSED_WITH_DIFFERENT_BODY');
    return { id: replay.id, consumida: usadas.has(replay.id), renovar: false };
   }
   if (!incertidumbre(row)) throw new ConflictException('Solo se admite reenvío forzado por incertidumbre de transporte, sin resultado fiscal definitivo.');
   const pending = await this.pendiente(tx, id); if (pending) return { id: pending.id, consumida: false, renovar: false };
   const ultima = autorizaciones.at(-1);
   if (ultima && usadas.has(ultima.id) && input.renovarAutorizacionId !== ultima.id) return { id: ultima.id, consumida: true, renovar: true };
   const episodioId = history.filter(e => e.codigo_error === 'M1_TRANSPORT_STARTED').at(-1)?.id ?? `historico:${id}`;
   await tx.invoice.update({ where: { id }, data: { transport_uncertain: true } });
   const event = await tx.transactionHistory.create({ data: { invoice_id: id, company_id: companyId,
    intento: 0, estado_anterior: row.estado, estado_nuevo: row.estado, codigo_error: FORCE_AUTH,
    mensaje_error: JSON.stringify({ version: 2, decisionId: input.decisionId, episodioId, renovacionDe: input.renovarAutorizacionId ?? null, accion: 'Reenvío forzado por decisión registrada', usuarioId: actor.sub, motivo }), tiempo_respuesta_ms: null, http_status_code: null } });
   return { id: event.id, consumida: false, renovar: false };
  });
  const autorizacionId = decision.id;
  if (decision.consumida) return { autorizacionId, resultadoCola: decision.renovar ? 'REQUIERE_NUEVA_DECISION' : 'AUTORIZACION_CONSUMIDA', requiereNuevaDecision: true,
   mensaje: 'La constancia anterior ya fue consumida. No se publica otro trabajo; una nueva decisión requiere renovar expresamente motivo y confirmación.' };
  const cola = await this.queue.reenqueueInvoiceIfIdle(id, companyId, async () => {
   const row = await this.prisma.invoice.findFirst({ where: { id, company_id: companyId } });
   return Boolean(row && incertidumbre(row));
  }, { rescatarDlq: true });
  return { autorizacionId, resultadoCola: cola.estado, mensaje: 'Reenvío forzado por decisión registrada. No confirma envío ni aceptación. Si ya hay un trabajo activo, la constancia pendiente permanece recuperable.' };
 }
 /** Solo después de preparación/compuerta; consumo único bajo el mismo lock de factura. */
 async consumir(id: string): Promise<boolean> {
  return this.prisma.$transaction(async tx => {
   await tx.$queryRaw`SELECT id FROM invoices WHERE id = ${id} FOR UPDATE`;
   const row = await tx.invoice.findUnique({ where: { id } });
   if (!row || !incertidumbre(row)) return false;
   const pending = await this.pendiente(tx, id); if (!pending) return false;
   await tx.transactionHistory.create({ data: { company_id: row.company_id, invoice_id: id, intento: 0,
    estado_anterior: row.estado, estado_nuevo: row.estado, codigo_error: FORCE_USED,
    mensaje_error: JSON.stringify({ autorizacionId: pending.id, accion: 'Autorización reclamada para un nuevo intento; la conciliación posterior sigue vigente.' }), tiempo_respuesta_ms: null, http_status_code: null } });
   await tx.invoice.update({ where: { id }, data: { transport_uncertain: false } });
   return true;
  });
 }
}
