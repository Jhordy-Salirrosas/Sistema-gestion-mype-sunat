import { Injectable, NotFoundException } from '@nestjs/common';
import { randomInt } from 'node:crypto';
import { friendlySireJobFailureMessage } from '../../domain/rules/sireJobFailureMessages';
import type { SireTrabajoEstadoRespuesta } from '../dto/sireMenuResponseDto';
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
 *
 * Se conserva para poder completar trabajos históricos de la cola. El módulo
 * SIRE ya no expone ningún endpoint que envíe libros a SUNAT.
 */
export function generarTicketSimulado(): string {
  const minimo = 10 ** (LARGO_TICKET_SIMULADO - 1);
  const maximo = 10 ** LARGO_TICKET_SIMULADO;
  return String(randomInt(minimo, maximo));
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
