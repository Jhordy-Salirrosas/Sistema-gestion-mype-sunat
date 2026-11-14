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
 * POR QUÉ ES UNA SIMULACIÓN
 *
 * El cruce contra SUNAT todavía no está disponible en este módulo: la
 * conciliación lee las importaciones del periodo y devuelve un resultado
 * SIMULADO con la misma forma que tendría el cruce real (resumen + lista de
 * comprobantes). El resultado se persiste en `sire_conciliaciones` para poder
 * auditarlo y para que el historial lo muestre.
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

    const registro = await this.repository.crearConciliacion({
      companyId,
      periodo,
      conciliados: resumen.conciliados,
      diferencias: resumen.diferencias,
      detalle: { resumen, comprobantes },
    });

    return {
      conciliacionId: registro.id,
      periodo,
      libro: libro ?? 'RVIE_VENTAS',
      resumen,
      comprobantes,
      createdAt: registro.created_at.toISOString(),
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
