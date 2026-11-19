import {
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { randomInt, randomUUID } from 'node:crypto';
import {
  QueueService,
  type SireImportJobData,
} from '../../../resilience/infrastructure/queue/queue.service';
import { describeErrorSafely } from '../../domain/rules/sireRedactionUtils';
import { friendlySireJobFailureMessage } from '../../domain/rules/sireJobFailureMessages';
import type {
  SireReporteRespuesta,
  SireTrabajoEstadoRespuesta,
} from '../dto/sireMenuResponseDto';
import type { SireReporteRequestDto } from '../dto/sireMenuQueryDto';
import { SireMenuRepository } from '../../infrastructure/persistence/sireMenuRepository';

/**
 * Longitud del ticket simulado.
 *
 * SUNAT devuelve el ticket de un libro como una cadena numérica de ocho
 * dígitos. La simulación devuelve algo con la misma forma para que el
 * frontend pueda tratarlo igual que uno real.
 */
const LARGO_TICKET_SIMULADO = 8;

/**
 * Genera un ticket simulado.
 */
export function generarTicketSimulado(): string {
  const minimo = 10 ** (LARGO_TICKET_SIMULADO - 1);
  const maximo = 10 ** LARGO_TICKET_SIMULADO;
  return String(randomInt(minimo, maximo));
}

/**
 * Envío del libro conciliado a SUNAT.
 *
 * POR QUÉ DEVUELVE 202 Y NO 200
 *
 * El envío a SUNAT es asíncrono también en la vida real: SUNAT devuelve un
 * ticket y el resultado se consulta después. La respuesta lleva el ticket y el
 * `messageId` para que el frontend sondee hasta que el trabajo termine.
 */
@Injectable()
export class ReportarSireUseCase {
  private readonly logger = new Logger(ReportarSireUseCase.name);

  constructor(
    private readonly repository: SireMenuRepository,
    private readonly queue: QueueService,
  ) {}

  async execute(
    companyId: string,
    dto: SireReporteRequestDto,
  ): Promise<SireReporteRespuesta> {
    const messageId = randomUUID();
    const ticket = generarTicketSimulado();

    const registro = await this.repository.crearReporte({
      companyId,
      periodo: dto.periodo,
      libro: dto.libro,
      messageId,
      ticket,
    });

    const trabajo: SireImportJobData = {
      messageId,
      companyId,
      tipo: 'REPORTE',
      registroId: registro.id,
      periodo: dto.periodo,
      libro: dto.libro,
    };

    try {
      await this.queue.enqueueSireImport(trabajo);
    } catch (error) {
      await this.repository
        .fallarReporte(registro.id, 'QUEUE_ENQUEUE_FAILED')
        .catch(() => undefined);
      this.logger.error(
        `No se pudo encolar el reporte SIRE ${messageId}: ${describeErrorSafely(error)}`,
      );
      throw new ServiceUnavailableException(
        'No se pudo registrar el reporte SIRE en la cola.',
      );
    }

    this.logger.log(
      `Reporte SIRE registrado (messageId=${messageId}, periodo=${dto.periodo}, libro=${dto.libro}, ticket=${ticket})`,
    );

    return {
      messageId,
      reporteId: registro.id,
      periodo: dto.periodo,
      libro: dto.libro,
      estado: 'PENDING',
      ticket,
      createdAt: registro.created_at.toISOString(),
    };
  }
}

/**
 * Estado de un reporte en curso, para el sondeo del frontend.
 */
@Injectable()
export class ConsultarReporteSireUseCase {
  constructor(private readonly repository: SireMenuRepository) {}

  async execute(
    companyId: string,
    messageId: string,
  ): Promise<SireTrabajoEstadoRespuesta> {
    const registro = await this.repository.buscarReportePorMessageId(
      companyId,
      messageId,
    );

    if (!registro) {
      throw new NotFoundException('No se encontró el reporte SIRE.');
    }

    return {
      messageId: registro.message_id ?? messageId,
      estado: registro.estado,
      periodo: registro.periodo,
      libro: registro.libro,
      createdAt: registro.created_at.toISOString(),
      completedAt: registro.completed_at
        ? registro.completed_at.toISOString()
        : null,
      errorCode: registro.error_code,
      message: friendlySireJobFailureMessage(registro.error_code),
      ticket: registro.ticket,
    };
  }
}
