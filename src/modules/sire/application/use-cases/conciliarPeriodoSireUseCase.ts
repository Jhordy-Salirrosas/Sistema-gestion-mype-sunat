import { Injectable, NotFoundException } from '@nestjs/common';
import { toDomainBookType } from '../sireBookType';
import type { SireLibroMenu } from '../dto/sireMenuQueryDto';
import type {
  SireConciliacionRespuesta,
  SireTrabajoEstadoRespuesta,
} from '../dto/sireMenuResponseDto';
import {
  calcularResumenSimulado,
  generarComprobantesSimulados,
} from '../../domain/rules/sireMockDataRule';
import { friendlySireJobFailureMessage } from '../../domain/rules/sireJobFailureMessages';
import { SireMenuRepository } from '../../infrastructure/persistence/sireMenuRepository';

/**
 * Conciliación de un periodo.
 *
 * SOLO LECTURA: lee las importaciones del periodo y devuelve un resultado
 * simulado con la forma del cruce real. No persiste nada y no genera asientos:
 * la contabilidad es la única encargada de crear asientos a partir de estos
 * datos.
 */
@Injectable()
export class ConciliarPeriodoSireUseCase {
  constructor(private readonly repository: SireMenuRepository) {}

  async execute(
    companyId: string,
    periodo: string,
    libro: SireLibroMenu | null,
  ): Promise<SireConciliacionRespuesta> {
    const importaciones = await this.repository.listarImportaciones(
      companyId,
      periodo,
      libro ?? undefined,
    );

    const libroDomain = toDomainBookType(libro ?? 'RVIE_VENTAS');
    const comprobantes = generarComprobantesSimulados(
      periodo,
      libroDomain,
      importaciones.length,
    );
    const resumen = calcularResumenSimulado(periodo, libroDomain, comprobantes);

    return {
      conciliacionId: null,
      periodo,
      libro: libro ?? 'RVIE_VENTAS',
      resumen,
      comprobantes,
      createdAt: new Date().toISOString(),
    };
  }
}

/**
 * Estado de una importación en curso, para el sondeo del frontend.
 */
@Injectable()
export class ConsultarImportacionSireUseCase {
  constructor(private readonly repository: SireMenuRepository) {}

  async execute(
    companyId: string,
    messageId: string,
  ): Promise<SireTrabajoEstadoRespuesta> {
    const registro = await this.repository.buscarImportacionPorMessageId(
      companyId,
      messageId,
    );

    if (!registro) {
      throw new NotFoundException('No se encontró la importación SIRE.');
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
    };
  }
}
