import { randomUUID } from 'node:crypto';
import { PrismaService } from '../../../../database/prismaService';
import { Prisma, type InvoiceAggregate } from '../../../../generated/client/client';
import { QueueService, type SummaryJobData } from '../../../resilience/infrastructure/queue/queue.service';

export const MAX_SUMMARY_POLL_ATTEMPTS = 24;
export const summaryPollDelay = (attempt: number) => ([5, 15, 30][attempt - 1] ?? 60) * 60_000;
export interface Polling { attempts: number; nextAt: string | null; exhausted?: boolean; historyUnknown?: boolean; legacy?: boolean; lease?: { token: string; until: string }; }
export const pollingOf = (result: unknown): Polling | undefined => (result as { polling?: Polling } | null)?.polling;
/** Exclusión y agenda común a worker, recuperación y consulta manual; todo durable en JSON. */
export class SummaryPollingCoordinator {
 constructor(private readonly prisma: PrismaService, private readonly queue: QueueService) {}
 private async save(tx: Prisma.TransactionClient, row: InvoiceAggregate, p: Polling) {
  await tx.invoiceAggregate.update({ where: { id: row.id }, data: { result: { ...(row.result as object ?? {}), polling: p } as unknown as Prisma.InputJsonValue } });
 }
 private async jobs(tx: Prisma.TransactionClient, row: InvoiceAggregate) {
  const tables = await tx.$queryRaw<{ name: string | null }[]>`SELECT to_regclass('pgboss.job')::text AS name`;
  if (!tables[0]?.name) return [];
  return tx.$queryRaw<{ id: string; state: string; attempt: number; due: Date; finished: Date | null }[]>`
   SELECT id::text, state::text, COALESCE((data->>'sondeoIntento')::int, 1) AS attempt, start_after AS due, completed_on AS finished
   FROM pgboss.job WHERE name = 'sunat-summary-queue' AND data->>'companyId' = ${row.company_id} AND data->>'identificador' = ${row.identifier}`;
 }
 private async adopt(tx: Prisma.TransactionClient, row: InvoiceAggregate): Promise<Polling> {
  const jobs = await this.jobs(tx, row);
  const alive = jobs.filter(j => ['created','retry','active'].includes(j.state));
  const completed = jobs.filter(j => !['created','retry','active'].includes(j.state));
  const consumed = Math.max(0,...completed.map(j=>j.attempt),...alive.map(j=>j.attempt-1));
  if (/agotado tras 24 intentos/.test(row.error ?? '') || consumed >= MAX_SUMMARY_POLL_ATTEMPTS) return { attempts:24, nextAt:null, exhausted:true };
  if (!jobs.length) return { attempts:0, nextAt:null, historyUnknown:true };
  const latest = completed.sort((a,b)=>b.attempt-a.attempt)[0];
  const due = alive.length ? Math.min(...alive.map(j=>j.due.getTime())) : (latest?.finished?.getTime() ?? Date.now()) + summaryPollDelay(Math.max(1,consumed));
  return { attempts:consumed, nextAt:new Date(due).toISOString(), legacy:true };
 }
 async claim(id: string, automatic: boolean, attempt: number | undefined, timeoutMs: number) {
  return this.prisma.$transaction(async tx => {
   await tx.$executeRaw`SELECT id FROM invoice_aggregates WHERE id = ${id} FOR UPDATE`;
   const row = await tx.invoiceAggregate.findUniqueOrThrow({where:{id}});
   if (['ACCEPTED','REJECTED'].includes(row.state)) return { status:'SUMMARY_POLL_FINAL' };
   let p = pollingOf(row.result);
   if (!p) p = automatic && attempt ? { attempts:attempt-1,nextAt:new Date().toISOString() } : await this.adopt(tx,row);
   if (p.lease && Date.parse(p.lease.until)>Date.now()) return { status:'SUMMARY_POLL_BUSY' };
   if (automatic) {
    if (p.exhausted || p.attempts>=MAX_SUMMARY_POLL_ATTEMPTS) return {status:'SUMMARY_POLL_EXHAUSTED'};
    if (p.historyUnknown) return {status:'SUMMARY_POLL_HISTORY_UNKNOWN'};
    if (p.legacy && attempt && attempt>p.attempts+1) p.attempts=attempt-1;
    if (attempt && attempt!==p.attempts+1) return {status:'SUMMARY_POLL_STALE'};
    if (p.nextAt && Date.parse(p.nextAt)>Date.now()) return {status:'SUMMARY_POLL_NOT_DUE'};
    p.attempts++; p.legacy=false;
   }
   const token=randomUUID();p.lease={token,until:new Date(Date.now()+Math.max(120000,timeoutMs+30000)).toISOString()};
   await this.save(tx,row,p);
   return { token, attempt:p.attempts };
  });
 }
 async release(id: string, token: string, automatic: boolean) {
  await this.prisma.$transaction(async tx=>{
   await tx.$executeRaw`SELECT id FROM invoice_aggregates WHERE id = ${id} FOR UPDATE`;
   const row=await tx.invoiceAggregate.findUniqueOrThrow({where:{id}});
   const p=pollingOf(row.result);if(!p || p.lease?.token!==token || ['ACCEPTED','REJECTED'].includes(row.state))return;
   delete p.lease;
   if(automatic){p.exhausted=p.attempts>=MAX_SUMMARY_POLL_ATTEMPTS;p.nextAt=p.exhausted?null:new Date(Date.now()+summaryPollDelay(p.attempts)).toISOString();}
   await this.save(tx,row,p);
  });
 }
 /** Recupera o publica sin duplicar trabajos vivos; el contador nunca nace del temporizador. */
 async publish(job: SummaryJobData & {sondeoIntento?:number;ticketConsulta?:string}, _requested?: Date): Promise<string | null> {
  return this.prisma.$transaction(async tx=>{
   await tx.$executeRaw`SELECT id FROM invoice_aggregates WHERE company_id = ${job.companyId} AND identifier = ${job.identificador} FOR UPDATE`;
   const row=await tx.invoiceAggregate.findUniqueOrThrow({where:{company_id_kind_identifier:{company_id:job.companyId,kind:job.tipo==='COMUNICACION_BAJA'?'RA':'RC',identifier:job.identificador}}});
   if(row.state!=='POLLING'||!row.ticket)return 'NO_POLL_REQUIRED';
   const p=pollingOf(row.result)??await this.adopt(tx,row);
   // Una consulta caída consumió su intento antes de abrir red; esperar al vencimiento y respetar la cadencia.
   if(p.lease&&Date.parse(p.lease.until)<=Date.now()){
    delete p.lease;p.exhausted=p.attempts>=MAX_SUMMARY_POLL_ATTEMPTS;
    p.nextAt=p.exhausted?null:new Date(Date.now()+summaryPollDelay(Math.max(1,p.attempts))).toISOString();
   }
   await this.save(tx,row,p);
   if(p.historyUnknown||p.exhausted||p.attempts>=24||!p.nextAt)return 'POLL_STOPPED';
   if(p.lease&&Date.parse(p.lease.until)>Date.now())return 'POLL_BUSY';
   const live=(await this.jobs(tx,row)).find(j=>['created','retry','active'].includes(j.state)&&j.attempt===p.attempts+1);
   if(live)return live.id;
   const next={...job,sondeoIntento:p.attempts+1,ticketConsulta:row.ticket,maxConsultas:0};
   const id=await this.queue.encolarResumen(next,new Date(p.nextAt));
   if(!id)throw new Error('SUMMARY_POLL_ENQUEUE_FAILED');
   return id;
  });
 }
}
