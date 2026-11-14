import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import {
  SIRE_FILE_STORAGE_PORT,
  type SireFileStoragePort,
} from '../../domain/ports/sireFileStoragePort';
import {
  extraerPeriodoYLibroDelNombre,
  validarNombreArchivoSire,
} from '../../domain/rules/sireFileNameRule';
import { describeErrorSafely } from '../../domain/rules/sireRedactionUtils';
import {
  QueueService,
  type SireImportJobData,
} from '../../../resilience/infrastructure/queue/queue.service';
import type { SireImportacionRespuesta } from '../dto/sireMenuResponseDto';
import type {
  SireImportacionRequestDto,
  SireLibroMenu,
} from '../dto/sireMenuQueryDto';
import { SireMenuRepository } from '../../infrastructure/persistence/sireMenuRepository';

/** Archivo recibido por `multipart/form-data`. */
export interface SireArchivoRecibido {
  originalname: string;
  mimetype: string;
  buffer: Buffer;
}

/**
 * Importación de una propuesta SIRE.
 *
 * POR QUÉ EL TRABAJO ES ASÍNCRONO
 *
 * Procesar una propuesta puede tardar (el archivo puede venir comprimido y
 * tener miles de líneas). La petición HTTP no puede quedarse esperando: se
 * registra el trabajo, se publica en la cola y se devuelve un `messageId` para
 * que el frontend sondee el avance.
 */
@Injectable()
export class ImportarPropuestaSireUseCase {
  private readonly logger = new Logger(ImportarPropuestaSireUseCase.name);

  constructor(
    private readonly repository: SireMenuRepository,
    private readonly queue: QueueService,
    @Inject(SIRE_FILE_STORAGE_PORT)
    private readonly storage: SireFileStoragePort,
  ) {}

  async execute(
    companyId: string,
    ruc: string,
    dto: SireImportacionRequestDto,
    archivo: SireArchivoRecibido,
  ): Promise<SireImportacionRespuesta> {
    if (!archivo?.buffer || archivo.buffer.length === 0) {
      throw new BadRequestException('Falta el archivo de la propuesta SIRE.');
    }

    const validacion = validarNombreArchivoSire(archivo.originalname, ruc);
    if (!validacion.valido) {
      throw new BadRequestException(
        validacion.mensaje ??
          'El nombre del archivo no cumple el formato de una propuesta SIRE.',
      );
    }

    const { periodo, libro } = this.resolverPeriodoYLibro(
      dto,
      archivo.originalname,
    );

    const messageId = randomUUID();

    const guardado = await this.storage.guardar({
      companyId,
      periodo,
      nombreArchivo: archivo.originalname,
      contenido: archivo.buffer,
    });

    const registro = await this.repository.crearImportacion({
      companyId,
      periodo,
      libro,
      nombreArchivo: archivo.originalname,
      messageId,
      rutaArchivo: guardado.ruta,
      hashArchivo: guardado.hash,
      backendAlmacen: guardado.backend,
      bytes: guardado.bytes,
    });

    const trabajo: SireImportJobData = {
      messageId,
      companyId,
      tipo: 'IMPORTACION',
      registroId: registro.id,
      periodo,
      libro,
    };

    try {
      await this.queue.enqueueSireImport(trabajo);
    } catch (error) {
      /**
       * El archivo y el registro ya están guardados. Si la cola no publica el
       * trabajo, el registro queda en PENDING para siempre y el frontend
       * sondería sin fin: se marca FAILED para que la pantalla muestre un
       * error y el usuario pueda reintentar.
       */
      await this.repository
        .fallarImportacion(registro.id, 'QUEUE_ENQUEUE_FAILED')
        .catch(() => undefined);
      this.logger.error(
        `No se pudo encolar la importación SIRE ${messageId}: ${describeErrorSafely(error)}`,
      );
      throw new ServiceUnavailableException(
        'No se pudo registrar la importación SIRE en la cola.',
      );
    }

    this.logger.log(
      `Importación SIRE registrada (messageId=${messageId}, periodo=${periodo}, libro=${libro}, backend=${guardado.backend})`,
    );

    return {
      messageId,
      importacionId: registro.id,
      periodo,
      libro,
      nombreArchivo: archivo.originalname,
      estado: 'PENDING',
      rutaArchivo: guardado.ruta,
      backendAlmacen: guardado.backend,
      hashArchivo: guardado.hash,
      bytes: guardado.bytes,
      createdAt: registro.created_at.toISOString(),
    };
  }

  /**
   * Determina el periodo y el libro de la importación.
   *
   * El cuerpo de la petición tiene prioridad; si no llega, se deducen del
   * nombre del archivo, que es la fuente de verdad de SUNAT.
   */
  private resolverPeriodoYLibro(
    dto: SireImportacionRequestDto,
    nombreArchivo: string,
  ): { periodo: string; libro: SireLibroMenu } {
    const delNombre = extraerPeriodoYLibroDelNombre(nombreArchivo);
    const periodo = dto.periodo ?? delNombre.periodo;
    const libro = dto.libro ?? delNombre.libro;

    if (!periodo || !libro) {
      throw new BadRequestException(
        'No se pudo determinar el periodo y el libro de la importación. Envíelos en el cuerpo o use un archivo con el formato LE<RUC>-<LIBRO>-<PERIODO>.',
      );
    }

    return { periodo, libro };
  }
}
