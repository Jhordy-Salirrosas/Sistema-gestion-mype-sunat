import AdmZip from 'adm-zip';
import { Injectable, Logger } from '@nestjs/common';
import { IssuerConfigResolver } from '../../../sunat/issuerConfigResolver';
import { detalleErrorConsulta } from '../../../sunat/statusConsultaError';
import { QueueService } from '../../../resilience/infrastructure/queue/queue.service';
import { CODIGOS_EN_PROCESO, SunatSummaryClient, resolveSummaryTimeout, parseGetStatusResponse, type CredencialesSol } from '../../../sunat/soap/sunatSummaryOperations';
import { SummaryAggregateStore } from './summaryAggregateStore';
import { SummaryGate, hashSummary } from './summaryGate';
export type TipoEnvioResumen = 'RESUMEN_DIARIO' | 'COMUNICACION_BAJA';
export interface SummaryJobData { tipo: TipoEnvioResumen; identificador: string; zipBase64: string; fileName: string; companyId: string; }
export interface ResultadoEnvioResumen { enviado: boolean; identificador: string; ticket: string | null; status: string | null; contenido: string | null; consultas: number; error: string | null; }
export interface OpcionesEnvio { credentials?: CredencialesSol | null; maxConsultas?: number; esperaMs?: number; ticketEsperado?: string; }
export const SUMMARY_QUEUE = 'sunat-summary-queue';
export const CONSULTAS_POR_DEFECTO = 30;
export const ESPERA_POR_DEFECTO_MS = 1000;
export const estaEnProceso = (status: string | null) => status !== null && CODIGOS_EN_PROCESO.includes(status);
@Injectable()
export class SummaryDispatchService {
  private readonly logger = new Logger(SummaryDispatchService.name);
  constructor(private readonly cola: QueueService, private readonly cliente: SunatSummaryClient,
    private readonly issuerConfig: IssuerConfigResolver, private readonly store: SummaryAggregateStore, private readonly gate: SummaryGate) {}
  async encolar(job: SummaryJobData, opciones: OpcionesEnvio = {}): Promise<string | null> {
    return this.cola.encolarResumen({ ...job, maxConsultas: opciones.maxConsultas ?? CONSULTAS_POR_DEFECTO, esperaMs: opciones.esperaMs ?? ESPERA_POR_DEFECTO_MS });
  }
  async procesar(job: SummaryJobData, opciones: OpcionesEnvio = {}): Promise<ResultadoEnvioResumen> {
    const base: ResultadoEnvioResumen = { enviado: false, identificador: job.identificador, ticket: null, status: null, contenido: null, consultas: 0, error: null };
    const row = await this.store.cargar(job.companyId, job.identificador);
    if (opciones.ticketEsperado && row.ticket !== opciones.ticketEsperado) return { ...base, ticket: row.ticket, status: 'BLOQUEADO', error: 'SUMMARY_POLL_TICKET_MISMATCH: no se reenvía un sondeo sin su ticket persistido' };
    if (row.kind !== (job.tipo === 'COMUNICACION_BAJA' ? 'RA' : 'RC')) throw new Error('SUMMARY_JOB_KIND_MISMATCH');
    if (['ACCEPTED', 'REJECTED'].includes(row.state)) {
      const result = row.result as Record<string, string | null> | null;
      return { ...base, ticket: row.ticket, status: result?.codigo ?? null, contenido: result?.contenido ?? null, enviado: Boolean(result?.contenido), error: row.error };
    }
    if (!row.ticket && (row.transport_uncertain || ['SENDING', 'UNCERTAIN', 'REVIEW'].includes(row.state))) return { ...base, error: row.error ?? 'Intento incierto sin ticket: revisión requerida; no se reenvía a ciegas' };
    let context: Awaited<ReturnType<IssuerConfigResolver['resolve']>>;
    try {
      context = Object.freeze({ ...await this.issuerConfig.resolve(job.companyId), timeoutMs: resolveSummaryTimeout() });
      if (context.ruc !== row.issuer_ruc || context.environment !== row.environment) throw new Error('SUMMARY_CONTEXT_CHANGED');
      if (!row.xml || hashSummary(row.xml) !== row.xml_hash || !row.zip_base64) throw new Error('SUMMARY_ARTIFACT_UNAVAILABLE');
      const entries = new AdmZip(Buffer.from(row.zip_base64, 'base64')).getEntries();
      if (entries.length !== 1 || entries[0].entryName !== `${row.issuer_ruc}-${row.identifier}.xml` || hashSummary(entries[0].getData().toString('utf8')) !== row.xml_hash) throw new Error('SUMMARY_ZIP_HASH_MISMATCH');
      await this.gate.validar(row.xml, row.kind as 'RA' | 'RC', context, row.identifier);
    } catch (error) {
      const d = detalleErrorConsulta(error);
      await this.store.revision(row.id, d.mensaje);
      this.logger.error(`[${row.identifier}] ${d.nombre}: ${d.mensaje}`);
      return { ...base, ticket: row.ticket, status: 'BLOQUEADO', error: d.mensaje };
    }
    let ticket = row.ticket;
    if (!ticket) {
      if (!await this.store.reclamar(row)) return { ...base, error: 'Otro trabajo tiene el envío reservado' };
      try {
        const envio = await this.cliente.sendSummary({ fileName: `${row.issuer_ruc}-${row.identifier}.zip`, zip: Buffer.from(row.zip_base64, 'base64'),
          credentials: context.sol ? { usuario: context.sol.username, clave: context.sol.password } : null, context });
        ticket = envio.ticket;
        if (!ticket) throw new Error('sendSummary no devolvió ticket');
        await this.store.ticket(row.id, ticket);
      } catch (error) {
        const d = detalleErrorConsulta(error instanceof Error ? error : new Error(String(error)), [context.sol?.password ?? '']);
        await this.store.pendiente(row.id, d.mensaje, null);
        this.logger.error(`[${row.identifier}] ${d.nombre}: ${d.mensaje}`);
        return { ...base, error: d.mensaje };
      }
    }
    const maximo = Math.max(0, opciones.maxConsultas ?? CONSULTAS_POR_DEFECTO);
    const espera = Math.max(0, opciones.esperaMs ?? ESPERA_POR_DEFECTO_MS);
    let status: string | null = null;
    for (let n = 0; n <= maximo; n++) {
      if (n && espera) await new Promise(resolve => setTimeout(resolve, espera));
      try {
        const result = await this.cliente.getStatus(ticket, context.sol ? { usuario: context.sol.username, clave: context.sol.password } : null, context);
        status = result.statusCode;
        if (result.contenido) {
          try { await this.store.finalizar(row, result.contenido, status); }
          catch (error) {
            const d = detalleErrorConsulta(error);
            if (/^SUMMARY_(CDR|XML_HASH)/.test(d.mensaje)) {
              await this.store.revision(row.id, d.mensaje);
              return { ...base, ticket, status: 'CDR_INVALIDO', consultas: n + 1, error: d.mensaje };
            }
            throw error;
          }
          return { ...base, enviado: true, ticket, status, contenido: result.contenido, consultas: n + 1 };
        }
        if (!result.enProceso) {
          const error = `SUNAT respondió ${status ?? 'sin estado'} sin CDR`;
          if (status) await this.store.rechazar(row.id, status, error);
          else await this.store.pendiente(row.id, error, ticket);
          return { ...base, ticket, status, consultas: n + 1, error };
        }
      } catch (error) {
        const d = detalleErrorConsulta(error instanceof Error ? error : new Error(String(error)), [context.sol?.password ?? '']);
        await this.store.pendiente(row.id, d.mensaje, ticket);
        this.logger.error(`[${row.identifier}] ${d.nombre}: ${d.mensaje}`);
        return { ...base, ticket, consultas: n, error: d.mensaje };
      }
    }
    const error = `SUNAT sigue procesando (código ${status})`; await this.store.pendiente(row.id, error, ticket);
    return { ...base, ticket, status, consultas: maximo + 1, error };
  }
}
export function interpretarEstadoResumen(xml: string) {
  const r = parseGetStatusResponse(xml); return { status: r.statusCode, enProceso: r.enProceso, contenido: r.contenido };
}
