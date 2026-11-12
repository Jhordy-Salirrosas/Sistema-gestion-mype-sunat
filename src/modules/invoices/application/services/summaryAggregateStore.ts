import { SummaryPollingCoordinator, pollingOf } from './summaryPollingCoordinator';
import { raReversalWork, raWorks } from './raBridgeReversalService';
import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { XMLParser } from 'fast-xml-parser';
import { QueueService } from '../../../resilience/infrastructure/queue/queue.service';
import { PrismaService } from '../../../../database/prismaService';
import { Prisma, type InvoiceAggregate } from '../../../../generated/client/client';
import { parseCdr } from '../../../sunat/soap/cdr.parser';
import type { AggregateKind } from './summaryGate';
import { hashSummary } from './summaryGate';
import type { IssuerContext } from '../../../sunat/issuerConfigResolver';
import type { VistaPrevia } from './invoiceSummaryService';

export interface SeleccionBaja { id: string; motivo: string; }
export interface AggregateMember { id: string; serie: string; correlativo: number; tipoComprobante: string; motivo?: string; }
export const membersOf = (row: Pick<InvoiceAggregate, 'members'>): AggregateMember[] => row.members as unknown as AggregateMember[];
export const resumenFingerprint = (kind: string, fecha: string, selection: SeleccionBaja[]) => createHash('sha256').update(JSON.stringify([kind, fecha, [...selection].sort((a, b) => a.id.localeCompare(b.id))])).digest('hex');
export const hoyLima = () => new Date(Date.now() - 5 * 3_600_000).toISOString().slice(0, 10);
const memberIds = (value: unknown): string[] => Array.isArray(value)
  ? value.flatMap(m => m && typeof m === 'object' && typeof m.id === 'string' && m.id.trim() ? [m.id] : []) : [];
const numberOf = (m: AggregateMember) => `${m.serie}-${Number(m.correlativo)}`;
const normalizeNumber = (s: string) => {
  const separator = s.lastIndexOf('-');
  const suffix = s.slice(separator + 1);
  return separator >= 0 && /^\d+$/.test(suffix)
    ? `${s.slice(0, separator + 1)}${Number(suffix)}`
    : s;
};

@Injectable()
export class SummaryAggregateStore {
  readonly polling: SummaryPollingCoordinator;
  constructor(private readonly prisma: PrismaService, private readonly queue: QueueService) { this.polling = new SummaryPollingCoordinator(prisma,queue); }

  async reservar(companyId: string, kind: AggregateKind, fecha: string, selection: SeleccionBaja[], context: IssuerContext,
    preview: (tx: Prisma.TransactionClient, correlativo: number, excludeId?: string) => Promise<VistaPrevia>): Promise<{ row: InvoiceAggregate; vista?: VistaPrevia }> {
    if (context.companyId !== companyId) throw new BadRequestException('SUMMARY_COMPANY_MISMATCH');
    const fingerprint = resumenFingerprint(kind, fecha, selection);
    return this.prisma.$transaction(async tx => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${companyId}))`;
      const existing = await tx.invoiceAggregate.findUnique({ where: { company_id_kind_fingerprint: { company_id: companyId, kind, fingerprint } } });
      if (existing && !['RESERVED', 'BLOCKED'].includes(existing.state)) return { row: existing };
      if (selection.length) await tx.$executeRaw`SELECT id FROM invoices WHERE company_id = ${companyId} AND id = ANY(${selection.map(s => s.id)}::text[]) FOR UPDATE`;
      const today = hoyLima();
      const anteriores = await tx.invoiceAggregate.findMany({ where: { company_id: companyId, kind, generation_date: today }, select: { identifier: true } });
      const next = 1 + anteriores.reduce((max, r) => Math.max(max, Number(r.identifier.split('-').at(-1)) || 0), 0);
      const identifier = existing?.identifier ?? `${kind}-${today.replace(/-/g, '')}-${String(next).padStart(3, '0')}`;
      const correlativo = Number(identifier.split('-').at(-1));
      if (existing?.state === 'BLOCKED') await tx.invoiceAggregate.update({ where: { id: existing.id }, data: { state: 'RESERVED' } });
      const vista = await preview(tx, correlativo, existing?.id);
      if (vista.errores.length || !vista.xml) throw new BadRequestException(vista.errores.join(' | ') || 'No hay comprobantes incluidos');
      vista.envio.identificador = identifier;
      vista.xml = vista.xml.replace(/(<cbc:ID>)[^<]*(<\/cbc:ID>)/, `$1${identifier}$2`).replace(/(<cbc:IssueDate>)[^<]*(<\/cbc:IssueDate>)/, `$1${existing?.generation_date ?? today}$2`);
      const members = vista.lineas.filter(l => l.incluido).map(l => ({ id: l.id, serie: l.serie, correlativo: l.correlativo, tipoComprobante: l.tipoComprobante,
        ...(kind === 'RA' ? { motivo: selection.find(s => s.id === l.id)?.motivo } : {}) }));
      if (!members.length || members.length !== selection.length) throw new BadRequestException('Selección de baja no elegible o ajena a la empresa');
      const active = await tx.invoiceAggregate.findMany({ where: { company_id: companyId, state: { notIn: ['BLOCKED', 'REJECTED'] }, ...(existing ? { id: { not: existing.id } } : {}) } });
      if (active.some(a => membersOf(a).some(m => members.some(n => n.id === m.id)))) throw new ConflictException('SUMMARY_MEMBER_ALREADY_RESERVED');
      const row = existing ?? await tx.invoiceAggregate.create({ data: { company_id: companyId, kind, identifier, fingerprint,
        reference_date: fecha, generation_date: today, state: 'RESERVED', issuer_ruc: context.ruc, environment: context.environment ?? '', members: members as unknown as Prisma.InputJsonValue } });
      return { row, vista };
    });
  }
  async cargar(companyId: string, identifier: string) {
    if (!companyId || !identifier) throw new BadRequestException('SUMMARY_COMPANY_REQUIRED');
    const row = await this.prisma.invoiceAggregate.findFirst({ where: { company_id: companyId, identifier } });
    if (!row) throw new BadRequestException('SUMMARY_NOT_FOUND');
    return row;
  }
  async artefacto(row: InvoiceAggregate, xml: string, zipBase64: string) {
    await this.prisma.invoiceAggregate.updateMany({ where: { id: row.id, state: { in: ['RESERVED', 'BLOCKED'] }, transport_uncertain: false }, data: { xml, xml_hash: hashSummary(xml), zip_base64: zipBase64, state: 'PREPARED', error: null } });
    return this.prisma.invoiceAggregate.findUniqueOrThrow({ where: { id: row.id } });
  }
  async encolado(id: string, jobId: string) {
    await this.prisma.invoiceAggregate.updateMany({ where: { id, state: 'PREPARED' }, data: { state: 'QUEUED', job_id: jobId } });
  }
  async bloquear(id: string, error: string) {
    await this.prisma.invoiceAggregate.updateMany({ where: { id, state: { in: ['RESERVED', 'BLOCKED'] } }, data: { state: 'BLOCKED', error } });
  }
  async reclamar(row: InvoiceAggregate): Promise<boolean> {
    return (await this.prisma.invoiceAggregate.updateMany({ where: { id: row.id, company_id: row.company_id, ticket: null, transport_uncertain: false, state: { in: ['PREPARED', 'QUEUED'] } },
      data: { transport_uncertain: true, state: 'SENDING' } })).count === 1;
  }
  async ticket(id: string, ticket: string) {
    await this.prisma.invoiceAggregate.update({ where: { id }, data: { ticket, state: 'POLLING', transport_uncertain: false, error: null, result: { polling: { attempts: 0, nextAt: new Date().toISOString() } } } });
  }
  async pendiente(id: string, error: string, ticket: string | null) {
    await this.prisma.invoiceAggregate.updateMany({ where: { id, state: { notIn: ['ACCEPTED', 'REJECTED'] } }, data: { state: ticket ? 'POLLING' : 'UNCERTAIN', error } });
  }
  async revision(id: string, error: string) { await this.prisma.invoiceAggregate.update({ where: { id }, data: { state: 'REVIEW', error } }); }
  async rechazar(id: string, codigo: string, error: string) { await this.prisma.invoiceAggregate.update({ where: { id }, data: { state: 'REJECTED', transport_uncertain: false, error, result: { codigo, mensaje: error } } }); }
  async pendientes() { return this.prisma.invoiceAggregate.findMany({ where: { OR: [{ state: 'POLLING', ticket: { not: null } }, { state: 'PREPARED' }, { state: 'RESERVED', updated_at: { lt: new Date(Date.now() - 60_000) } }, { state: { notIn: ['ACCEPTED', 'REJECTED'] }, result: { path: ['receivedCdr'], not: Prisma.DbNull } }] }, take: 50, orderBy: { updated_at: 'asc' } }); }
  async listar(companyId: string) {
    if (!companyId) throw new BadRequestException('SUMMARY_COMPANY_REQUIRED');
    const rows = await this.prisma.invoiceAggregate.findMany({ where: { company_id: companyId }, orderBy: { created_at: 'desc' }, take: 100,
      select: { id: true, kind: true, identifier: true, reference_date: true, state: true, ticket: true, transport_uncertain: true, result: true, error: true, job_id: true, created_at: true, members: true } });
    const ids = [...new Set(rows.flatMap(r => memberIds(r.members)))];
    const invoices = ids.length ? await this.prisma.invoice.findMany({
      where: { company_id: companyId, id: { in: ids } },
      select: { id: true, serie: true, correlativo: true, tipo_comprobante: true, monto_total: true, estado: true },
    }) : [];
    const byId = new Map(invoices.map(invoice => [invoice.id, invoice]));
    return rows.map(r => { const result = r.result as Record<string, unknown> | null; const { members: snapshot, ...summary } = r;
      const members = memberIds(snapshot).flatMap(id => { const invoice = byId.get(id); return invoice ? [{
        id: invoice.id, numero: `${invoice.serie}-${String(invoice.correlativo).padStart(8, '0')}`,
        tipo: invoice.tipo_comprobante, monto: Number(invoice.monto_total), estado: invoice.estado,
      }] : []; });
      return { ...summary, members, polling: pollingOf(r.result) ? { attempts: pollingOf(r.result)!.attempts, nextAt: pollingOf(r.result)!.nextAt, exhausted: pollingOf(r.result)!.exhausted ?? false, historyUnknown: pollingOf(r.result)!.historyUnknown ?? false, inProgress: Boolean(pollingOf(r.result)!.lease && Date.parse(pollingOf(r.result)!.lease!.until)>Date.now()) } : undefined, bridge_reversal: { pending: raWorks(r.result).filter(w => w.status !== 'DONE').length, done: raWorks(r.result).filter(w => w.status === 'DONE').length }, result: result ? { codigo: result.codigo, mensaje: result.mensaje, referencia: result.referencia } : null }; });
  }
  async finalizar(row: InvoiceAggregate, contenido: string, status: string | null) {
    const cdr = parseCdr(contenido);
    if (cdr.referenceId !== row.identifier || cdr.xmlFileName !== `R-${row.issuer_ruc}-${row.identifier}.xml`) throw new Error('SUMMARY_CDR_IDENTITY_MISMATCH');
    const parser = new XMLParser({ removeNSPrefix: true, ignoreAttributes: false, parseTagValue: false });
    const root = parser.parse(row.xml ?? '')[row.kind === 'RA' ? 'VoidedDocuments' : 'SummaryDocuments'];
    if (!root || hashSummary(row.xml ?? '') !== row.xml_hash) throw new Error('SUMMARY_XML_HASH_MISMATCH');
    const rawLines = root[row.kind === 'RA' ? 'VoidedDocumentsLine' : 'SummaryDocumentsLine'];
    const lines = Array.isArray(rawLines) ? rawLines : [rawLines];
    const snapshot = membersOf(row);
    const xmlNumbers = lines.map(l => row.kind === 'RA' ? `${l?.DocumentSerialID}-${Number(l?.DocumentNumberID)}` : normalizeNumber(String(l?.ID)));
    if (lines.length !== snapshot.length || xmlNumbers.some((n, i) => n !== numberOf(snapshot[i]) || String(lines[i]?.DocumentTypeCode) !== snapshot[i].tipoComprobante || Number(lines[i]?.LineID) !== i + 1)) throw new Error('SUMMARY_CDR_MEMBER_MISMATCH');
    // Si el CDR enumera documentos, la lista debe coincidir exactamente. Un CDR
    // global vincula la aceptación al identificador único y al XML inmutable.
    const named: string[] = [];
    const inspect = (value: unknown, key = '') => {
      if (typeof value === 'string' && ['ID', 'ReferenceID', 'LineID'].includes(key) && /^[FB][A-Z0-9]{3}-\d{1,8}$/.test(value)) named.push(normalizeNumber(value));
      if (Array.isArray(value)) value.forEach(v => inspect(v, key));
      else if (value && typeof value === 'object') {
        const node = value as Record<string, unknown>;
        if (key === 'LineResponse') {
          const response = node.Response as Record<string, unknown> | undefined;
          if (response?.ResponseCode !== undefined && String(response.ResponseCode) !== '0') throw new Error('SUMMARY_CDR_MEMBER_REJECTED');
        }
        Object.entries(node).forEach(([k, v]) => inspect(v, k));
      }
    };
    inspect(new XMLParser({ removeNSPrefix: true, parseTagValue: false }).parse(cdr.rawXml));
    if (named.length && (new Set(named).size !== snapshot.length || named.some(n => !snapshot.some(m => numberOf(m) === n)))) throw new Error('SUMMARY_CDR_MEMBER_MISMATCH');
    const accepted = cdr.responseCode === '0';
    // El CDR recibido sobrevive a cualquier fallo posterior de materialización local.
    await this.prisma.$transaction(async tx => {
      await tx.$executeRaw`SELECT id FROM invoice_aggregates WHERE id = ${row.id} AND company_id = ${row.company_id} FOR UPDATE`;
      const actual = await tx.invoiceAggregate.findUniqueOrThrow({ where: { id: row.id } });
      if (actual.xml_hash !== row.xml_hash || JSON.stringify(actual.members) !== JSON.stringify(row.members)) throw new Error('SUMMARY_CDR_SNAPSHOT_CHANGED');
      if (!['ACCEPTED', 'REJECTED'].includes(actual.state)) await tx.invoiceAggregate.update({ where: { id: row.id }, data: {
        result: { ...(actual.result as object ?? {}), receivedCdr: { contenido, status } } as Prisma.InputJsonValue,
      } });
    });
    return this.prisma.$transaction(async tx => {
      await tx.$executeRaw`SELECT id FROM invoice_aggregates WHERE id = ${row.id} AND company_id = ${row.company_id} FOR UPDATE`;
      const actual = await tx.invoiceAggregate.findUniqueOrThrow({ where: { id: row.id } });
      if (['ACCEPTED', 'REJECTED'].includes(actual.state)) return actual;
      if (actual.xml_hash !== row.xml_hash || JSON.stringify(actual.members) !== JSON.stringify(row.members)) throw new Error('SUMMARY_CDR_SNAPSHOT_CHANGED');
      if (accepted && row.kind === 'RA') {
        const updated = await tx.invoice.updateMany({ where: { company_id: row.company_id, id: { in: snapshot.map(m => m.id) }, estado: { in: ['ACEPTADO', 'OBSERVADO'] } }, data: { estado: 'ANULADO' } });
        if (updated.count !== snapshot.length) throw new Error('SUMMARY_MEMBER_STATE_CHANGED');
        for (const m of snapshot) await tx.transactionHistory.create({ data: { invoice_id: m.id, company_id: row.company_id, estado_anterior: null, estado_nuevo: 'ANULADO', codigo_error: 'M1_RA_REVERSAL_PENDING', mensaje_error: `ANULADO con reversión pendiente: ${row.identifier}.` } });
      }
      if (accepted && row.kind === 'RC') {
        const updated = await tx.invoice.updateMany({ where: { company_id: row.company_id, id: { in: snapshot.map(m => m.id) }, estado: 'PENDIENTE', transport_uncertain: false }, data: { estado: 'ACEPTADO' } });
        if (updated.count !== snapshot.length) throw new Error('SUMMARY_MEMBER_STATE_CHANGED');
        // La reentrega de un comprobante final solo completa el puente contable;
        // la publicación transaccional impide perder ese trabajo tras el CDR.
        for (const member of snapshot) if (!await this.queue.enqueueInvoiceInTx(tx, member.id)) throw new Error('SUMMARY_ACCOUNTING_ENQUEUE_FAILED');
      }
      return tx.invoiceAggregate.update({ where: { id: row.id }, data: { state: accepted ? 'ACCEPTED' : 'REJECTED', transport_uncertain: false, error: accepted ? null : cdr.description,
        result: { codigo: cdr.responseCode, mensaje: cdr.description, referencia: cdr.referenceId, status, contenido, xml: cdr.rawXml, ...(accepted && row.kind === 'RA' ? { bridgeReversals: raReversalWork(snapshot.map(m => m.id)) } : {}) } as unknown as Prisma.InputJsonValue } });
    });
  }
}
