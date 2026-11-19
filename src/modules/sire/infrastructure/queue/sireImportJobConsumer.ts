import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import AdmZip from 'adm-zip';
import {
  QueueService,
  type SireImportJobData,
} from '../../../resilience/infrastructure/queue/queue.service';
import {
  SIRE_FILE_STORAGE_PORT,
  type SireFileStoragePort,
  type SireStorageBackend,
} from '../../domain/ports/sireFileStoragePort';
import {
  SIRE_JOB_ERROR_CODES,
  type SireJobErrorCode,
} from '../../domain/rules/sireJobFailureMessages';
import { generarTicketSimulado } from '../../application/use-cases/reportarSireUseCase';
import { describeErrorSafely } from '../../domain/rules/sireRedactionUtils';
import { SireMenuRepository } from '../persistence/sireMenuRepository';

/**
 * Tiempo que el worker simula que tarda en procesar un REPORTE.
 *
 * La importación ya NO se simula: se lee el archivo real. Este retardo queda
 * solo para los reportes históricos, que no forman parte del flujo de lectura
 * de SIRE.
 */
export const SIRE_SIMULACION_DELAY_MS = 2_000;

/** Error controlado de archivo inválido: no se reintenta. */
class SireImportInvalidFileError extends Error {}

/**
 * Consumidor de los trabajos del menú SIRE.
 *
 * Para `IMPORTACION` lee el archivo guardado, extrae el RUC y el periodo y
 * cuenta los registros antes de marcar el trabajo como COMPLETED. Un archivo
 * inválido queda FAILED con `ARCHIVO_INVALIDO`.
 */
@Injectable()
export class SireImportJobConsumer implements OnModuleInit {
  private readonly logger = new Logger(SireImportJobConsumer.name);

  constructor(
    private readonly queue: QueueService,
    private readonly repository: SireMenuRepository,
    @Inject(SIRE_FILE_STORAGE_PORT)
    private readonly storage: SireFileStoragePort,
  ) {}

  async onModuleInit(): Promise<void> {
    if (typeof this.queue.registerSireImportWorker !== 'function') {
      this.logger.warn(
        'QueueService sin registerSireImportWorker: el consumidor del menú SIRE no se registra',
      );
      return;
    }

    this.logger.log('Iniciando worker del menú SIRE');
    await this.queue.registerSireImportWorker((job) => this.process(job));

    if (typeof this.queue.registerSireImportDlqWorker === 'function') {
      await this.queue.registerSireImportDlqWorker((job) =>
        this.markRetriesExhausted(job),
      );
    }

    this.logger.log('Worker del menú SIRE inicializado');
  }

  async process(job: SireImportJobData): Promise<void> {
    try {
      await this.runJob(job);
    } catch (error) {
      this.logger.error(
        `No se pudo completar el trabajo SIRE ${job.messageId}: ${describeErrorSafely(error)}`,
      );
      throw error;
    }
  }

  private async runJob(job: SireImportJobData): Promise<void> {
    if (job.tipo === 'IMPORTACION') {
      await this.repository.marcarImportacionEnProceso(job.registroId);
      await this.procesarImportacion(job);
      return;
    }

    await this.repository.marcarReporteEnProceso(job.registroId);
    await this.esperar(this.delaySimulacion());
    const ticket = await this.ticketDelReporte(job);
    await this.repository.completarReporte(job.registroId, ticket);
    this.logger.log(
      `Reporte SIRE completado (messageId=${job.messageId}, ticket=${ticket})`,
    );
  }

  /**
   * Procesa una importación real.
   *
   * El archivo se leyó del backend donde se guardó (Supabase o disco) y se
   * extrajo el RUC y el periodo. El número de registros queda persistido en
   * `sire_importaciones.total_registros`.
   */
  private async procesarImportacion(job: SireImportJobData): Promise<void> {
    const registro = await this.repository.buscarImportacionPorMessageId(
      job.companyId,
      job.messageId,
    );

    if (!registro?.ruta_archivo || !registro.backend_almacen) {
      await this.marcarFallo(job.registroId, SIRE_JOB_ERROR_CODES.ARCHIVO_INVALIDO);
      this.logger.error(
        `La importación SIRE ${job.messageId} no tiene archivo almacenado.`,
      );
      return;
    }

    let contenido: Buffer;
    try {
      contenido = await this.storage.leer(
        registro.ruta_archivo,
        registro.backend_almacen as SireStorageBackend,
      );
    } catch (error) {
      await this.marcarFallo(
        job.registroId,
        SIRE_JOB_ERROR_CODES.ALMACENAMIENTO_ERROR,
      );
      this.logger.error(
        `No se pudo leer el archivo de la importación SIRE ${job.messageId}: ${describeErrorSafely(error)}`,
      );
      return;
    }

    try {
      const procesado = this.procesarContenido(
        registro.nombre_archivo,
        contenido,
        registro.periodo,
      );

      await this.repository.completarImportacion(
        job.registroId,
        procesado.totalRegistros,
      );
      this.logger.log(
        `Importación SIRE completada (messageId=${job.messageId}, ruc=${procesado.ruc}, periodo=${procesado.periodo}, registros=${procesado.totalRegistros})`,
      );
    } catch (error) {
      if (error instanceof SireImportInvalidFileError) {
        await this.marcarFallo(
          job.registroId,
          SIRE_JOB_ERROR_CODES.ARCHIVO_INVALIDO,
        );
        this.logger.error(
          `Archivo de importación SIRE inválido (messageId=${job.messageId}): ${error.message}`,
        );
        return;
      }

      throw error;
    }
  }

  /**
   * Extrae los datos mínimos del TXT/ZIP de la propuesta.
   *
   * El RUC se busca en el nombre y en el contenido. El periodo se toma del
   * registro (ya validado al importar) y, como respaldo, del nombre/contenido.
   */
  private procesarContenido(
    nombreArchivo: string,
    contenido: Buffer,
    periodoRegistrado: string,
  ): { ruc: string; periodo: string; totalRegistros: number } {
    if (!contenido || contenido.length === 0) {
      throw new SireImportInvalidFileError('El archivo está vacío.');
    }

    const texto = this.leerTexto(nombreArchivo, contenido);
    const ruc = this.extraerRuc(nombreArchivo, texto);
    if (!ruc) {
      throw new SireImportInvalidFileError(
        'No se encontró un RUC de 11 dígitos en el archivo.',
      );
    }

    const periodo =
      periodoRegistrado ||
      this.extraerPeriodo(nombreArchivo) ||
      this.extraerPeriodo(texto);
    if (!periodo) {
      throw new SireImportInvalidFileError(
        'No se pudo determinar el periodo del archivo.',
      );
    }

    const totalRegistros = texto
      .split(/\r?\n/)
      .map((linea) => linea.trim())
      .filter((linea) => linea.length > 0).length;

    if (totalRegistros === 0) {
      throw new SireImportInvalidFileError('El archivo no contiene registros.');
    }

    return { ruc, periodo, totalRegistros };
  }

  private leerTexto(nombreArchivo: string, contenido: Buffer): string {
    const esZip =
      /\.zip$/i.test(nombreArchivo) ||
      (contenido.length >= 2 &&
        contenido[0] === 0x50 &&
        contenido[1] === 0x4b);

    if (!esZip) {
      return this.normalizarTexto(contenido.toString('utf8'));
    }

    let zip: AdmZip;
    try {
      zip = new AdmZip(contenido);
    } catch {
      throw new SireImportInvalidFileError(
        'El archivo ZIP de la propuesta no es válido.',
      );
    }

    const entrada = zip
      .getEntries()
      .find((item) => !item.isDirectory && /\.txt$/i.test(item.entryName));
    if (!entrada) {
      throw new SireImportInvalidFileError(
        'El ZIP no contiene un archivo TXT de propuesta.',
      );
    }

    return this.normalizarTexto(entrada.getData().toString('utf8'));
  }

  private normalizarTexto(texto: string): string {
    return texto.replace(/^\uFEFF/, '');
  }

  private extraerRuc(nombreArchivo: string, texto: string): string | undefined {
    return (
      /\b\d{11}\b/.exec(nombreArchivo)?.[0] ??
      /\b\d{11}\b/.exec(texto)?.[0]
    );
  }

  private extraerPeriodo(valor: string): string | undefined {
    return /\b(20\d{2}(?:0[1-9]|1[0-2]))\b/.exec(valor)?.[1];
  }

  private async marcarFallo(
    registroId: string,
    errorCode: SireJobErrorCode,
  ): Promise<void> {
    try {
      await this.repository.fallarImportacion(registroId, errorCode);
    } catch (error) {
      this.logger.error(
        `No se pudo marcar la importación SIRE ${registroId} como ${errorCode}: ${describeErrorSafely(error)}`,
      );
    }
  }

  private async markRetriesExhausted(job: SireImportJobData): Promise<void> {
    try {
      if (job.tipo === 'IMPORTACION') {
        await this.repository.fallarImportacion(
          job.registroId,
          SIRE_JOB_ERROR_CODES.SIRE_RETRIES_EXHAUSTED,
        );
      } else {
        await this.repository.fallarReporte(
          job.registroId,
          SIRE_JOB_ERROR_CODES.SIRE_RETRIES_EXHAUSTED,
        );
      }
    } catch (error) {
      this.logger.error(
        `No se pudo marcar el trabajo SIRE ${job.messageId} como fallido: ${describeErrorSafely(error)}`,
      );
    }
  }

  private async ticketDelReporte(job: SireImportJobData): Promise<string> {
    const registro = await this.repository.buscarReportePorMessageId(
      job.companyId,
      job.messageId,
    );
    return registro?.ticket ?? generarTicketSimulado();
  }

  private delaySimulacion(): number {
    const configurado = Number(process.env['SIRE_SIMULACION_DELAY_MS']);
    return Number.isFinite(configurado) && configurado >= 0
      ? configurado
      : SIRE_SIMULACION_DELAY_MS;
  }

  private esperar(ms: number): Promise<void> {
    return new Promise((resolve) => {
      setTimeout(resolve, ms);
    });
  }
}
