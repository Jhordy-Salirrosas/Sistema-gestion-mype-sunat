import { BadRequestException, HttpException, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import AdmZip from 'adm-zip';
import { SignatureService } from '../../../sunat/signature.service';
import { IssuerConfigResolver } from '../../../sunat/issuerConfigResolver';
import { detalleErrorConsulta } from '../../../sunat/statusConsultaError';
import { SummaryDispatchService } from './summaryDispatchService';
import { InvoiceSummaryService } from './invoiceSummaryService';
import { SummaryAggregateStore, membersOf, type SeleccionBaja } from './summaryAggregateStore';
import { SummaryGate } from './summaryGate';

export interface ResultadoEnvioAgregado { enviado: boolean; identificador: string; jobId: string | null; incluidos: number; motivo: string | null; }
export function seleccionBaja(input: unknown): SeleccionBaja[] {
  if (!Array.isArray(input) || !input.length || input.length > 500) throw new BadRequestException('Seleccione explícitamente los documentos para la baja');
  const lines = input.map((l: unknown) => {
    if (!l || typeof l !== 'object') throw new BadRequestException('Selección de baja inválida');
    const value = l as Record<string, unknown>;
    const motivo = value.motivo === undefined ? 'Anulación de la operación' : value.motivo;
    if (typeof value.id !== 'string' || !value.id.trim() || value.id.length > 100 || typeof motivo !== 'string' || !motivo.trim() || motivo.trim().length > 100) throw new BadRequestException('Indique documento y motivo de baja de 1 a 100 caracteres');
    return { id: value.id.trim(), motivo: motivo.trim() };
  });
  if (new Set(lines.map(l => l.id)).size !== lines.length) throw new BadRequestException('Documento repetido en la selección');
  return lines;
}
@Injectable()
export class SummaryEnvioService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SummaryEnvioService.name);
  private timer?: NodeJS.Timeout;
  private recovering = false;
  constructor(private readonly resumenes: InvoiceSummaryService, private readonly despacho: SummaryDispatchService,
    private readonly firma: SignatureService, private readonly issuerConfig: IssuerConfigResolver,
    private readonly store: SummaryAggregateStore, private readonly gate: SummaryGate) {}

  onModuleInit() { this.timer = setInterval(() => void this.recuperar(), 60_000); this.timer.unref(); }
  onModuleDestroy() { if (this.timer) clearInterval(this.timer); }
  async recuperar() {
    if (this.recovering) return;
    this.recovering = true;
    try {
      for (const row of await this.store.pendientes()) {
        try {
        const received = (row.result as { receivedCdr?: { contenido: string; status: string | null } } | null)?.receivedCdr;
        if (received) { await this.store.finalizar(row, received.contenido, received.status); continue; }
        if (row.state === 'RESERVED') {
          if (row.kind === 'RC') { await this.enviarResumenDiario(row.company_id, row.reference_date, membersOf(row).map(m => ({ id: m.id, motivo: '' }))); continue; }
          await this.enviarComunicacionBaja(row.company_id, row.reference_date, membersOf(row).map(m => ({ id: m.id, motivo: m.motivo ?? 'Anulación de la operación' })));
          continue;
        }
        const context = await this.issuerConfig.resolve(row.company_id);
        if (row.environment !== context.environment || row.issuer_ruc !== context.ruc) continue;
        await this.gate.validar(row.xml ?? '', row.kind as 'RA' | 'RC', context, row.identifier);
        const jobId = await this.despacho.encolar(this.job(row));
        if (jobId) await this.store.encolado(row.id, jobId);
        } catch (error) { const d = detalleErrorConsulta(error); this.logger.error(`Recuperación ${row.identifier}: ${d.nombre}: ${d.mensaje}`); }
      }
    } catch (error) { const d = detalleErrorConsulta(error); this.logger.error(`Recuperación agregados: ${d.nombre}: ${d.mensaje}`); }
    finally { this.recovering = false; }
  }
  async enviarResumenDiario(companyId: string, fecha: string, selection?: SeleccionBaja[]): Promise<ResultadoEnvioAgregado> {
    try {
      if (!selection) {
        const preview = await this.resumenes.vistaResumenDiario(companyId, fecha);
        selection = preview.lineas.filter(l => l.incluido).map(l => ({ id: l.id, motivo: '' }));
      }
      if (!selection.length) return { enviado: false, identificador: '', jobId: null, incluidos: 0, motivo: 'No hay documentos elegibles: revise exclusiones de la vista previa' };
      return await this.prepararBaja(companyId, fecha, selection, 'RC');
    } catch (error) {
      if (error instanceof HttpException && error.getStatus() < 500) throw error;
      const d = detalleErrorConsulta(error); this.logger.error(`Preparación RC: ${d.nombre}: ${d.mensaje}`);
      return { enviado: false, identificador: '', jobId: null, incluidos: 0, motivo: d.mensaje };
    }
  }
  async enviarComunicacionBaja(companyId: string, fecha: string, input?: unknown): Promise<ResultadoEnvioAgregado> {
    const selection = seleccionBaja(input);
    try { return await this.prepararBaja(companyId, fecha, selection); }
    catch (error) {
      if (error instanceof HttpException && error.getStatus() < 500) throw error;
      const d = detalleErrorConsulta(error); this.logger.error(`Preparación RA: ${d.nombre}: ${d.mensaje}`);
      return { enviado: false, identificador: '', jobId: null, incluidos: 0, motivo: d.mensaje };
    }
  }
  private async prepararBaja(companyId: string, fecha: string, selection: SeleccionBaja[], kind: 'RA' | 'RC' = 'RA'): Promise<ResultadoEnvioAgregado> {
    const context = await this.issuerConfig.resolve(companyId);
    const { row, vista } = await this.store.reservar(companyId, kind, fecha, selection, context,
      (tx, n, excludeId) => kind === 'RA' ? this.resumenes.vistaComunicacionBaja(companyId, fecha, n, selection, tx, excludeId) : this.resumenes.vistaResumenDiario(companyId, fecha, n, selection, tx, excludeId));
    const result = { enviado: false, identificador: row.identifier, jobId: row.job_id, incluidos: membersOf(row).length, motivo: null as string | null };
    if (['SENDING', 'POLLING', 'UNCERTAIN', 'ACCEPTED', 'REJECTED', 'REVIEW'].includes(row.state)) return { ...result, motivo: `Envío ya reservado: ${row.state}; consulte el Monitor` };
    if (row.state === 'QUEUED') return { ...result, enviado: true };
    try {
      let prepared = row;
      if (vista) {
        const signed = this.firma.signXml(vista.xml!, context).signedXml;
        await this.gate.validar(signed, kind, context, row.identifier);
        const zip = new AdmZip(); zip.addFile(`${context.ruc}-${row.identifier}.xml`, Buffer.from(signed));
        prepared = await this.store.artefacto(row, signed, zip.toBuffer().toString('base64'));
      } else await this.gate.validar(row.xml ?? '', kind, context, row.identifier);
      if (!['PREPARED', 'RESERVED', 'BLOCKED'].includes(prepared.state)) return { ...result, enviado: prepared.state === 'QUEUED', jobId: prepared.job_id, motivo: `Envío ya reservado: ${prepared.state}` };
      const jobId = await this.despacho.encolar(this.job(prepared));
      if (!jobId) return { ...result, motivo: 'La cola no aceptó el envío; reserva y XML conservados para recuperación' };
      await this.store.encolado(row.id, jobId);
      return { ...result, enviado: true, jobId };
    } catch (error) {
      const detail = detalleErrorConsulta(error, [context.sol?.password ?? '', context.certificate?.password ?? '', context.certificate?.base64 ?? '']);
      await this.store.bloquear(row.id, detail.mensaje);
      this.logger.error(`[M1 ${row.identifier}] ${detail.nombre}: ${detail.mensaje}`);
      return { ...result, motivo: detail.mensaje };
    }
  }
  private job(row: Awaited<ReturnType<SummaryAggregateStore['cargar']>>) {
    return { tipo: (row.kind === 'RA' ? 'COMUNICACION_BAJA' : 'RESUMEN_DIARIO') as 'COMUNICACION_BAJA' | 'RESUMEN_DIARIO', identificador: row.identifier, companyId: row.company_id,
      zipBase64: row.zip_base64!, fileName: `${row.issuer_ruc}-${row.identifier}.zip` };
  }
}
