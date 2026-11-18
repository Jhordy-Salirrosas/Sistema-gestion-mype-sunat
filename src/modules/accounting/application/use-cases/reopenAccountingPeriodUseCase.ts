import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import {
  ACCOUNTING_REPOSITORY_PORT,
  type IAccountingRepositoryPort,
} from '../../domain/ports/accountingRepositoryPort';
import type { AccountingPeriodEntity } from '../../domain/entities/accountingPeriodEntity';

export interface ReopenPeriodResult {
  period: AccountingPeriodEntity;
  advertencias: string[];
}

/**
 * Reapertura de un período cerrado.
 *
 * Es una operación sensible: permite volver a registrar asientos en un mes ya
 * cerrado, así que exige motivo, queda auditada y se bloquea si el ejercicio ya
 * tiene asiento de cierre (habría que anularlo antes).
 */
@Injectable()
export class ReopenAccountingPeriodUseCase {
  constructor(
    @Inject(ACCOUNTING_REPOSITORY_PORT)
    private readonly repository: IAccountingRepositoryPort,
  ) {}

  async execute(
    companyId: string,
    period: string,
    opciones: { motivo: string; usuarioId?: string; anularCierre?: boolean },
  ): Promise<ReopenPeriodResult> {
    const motivo = opciones.motivo?.trim() ?? '';
    if (motivo.length < 10) {
      throw new BadRequestException(
        'Para reabrir un período indica el motivo (al menos 10 caracteres). Queda registrado en la auditoría.',
      );
    }

    const periodos = await this.repository.findPeriods(companyId);
    const periodo = periodos.find((item) => item.period === period);
    if (!periodo) {
      throw new BadRequestException(`El período ${period} no existe.`);
    }
    if (periodo.status === 'ABIERTO') {
      throw new BadRequestException(`El período ${period} ya está abierto.`);
    }

    // Un ejercicio con asiento de cierre no se reabre por partes: primero se
    // anula el cierre para no dejar resultados duplicados.
    const year = Number(period.slice(0, 4));
    const tieneCierre = await this.repository.existsBySourceReference(
      companyId,
      'CLOSING',
      `CIERRE-${year}`,
    );
    if (tieneCierre) {
      // Reabrir sin anular el cierre duplicaría el resultado del ejercicio, así
      // que se exige confirmarlo de forma explícita desde la pantalla.
      if (!opciones.anularCierre) {
        throw new BadRequestException(
          `El ejercicio ${year} tiene un asiento de cierre generado. Marca "Anular el asiento de cierre" para reabrir el mes.`,
        );
      }
      await this.repository.anularAsientoCierre(companyId, year);
    }

    const advertencias: string[] = [];
    const posterioresCerrados = periodos.filter(
      (item) => item.period > period && item.status === 'CERRADO',
    );
    if (posterioresCerrados.length > 0) {
      advertencias.push(
        `Hay ${posterioresCerrados.length} período(s) posterior(es) cerrado(s); reabrir este mes no los reabre.`,
      );
    }

    const abierto = await this.repository.openPeriod(companyId, year, Number(period.slice(5, 7)));
    await this.repository.registrarReapertura(companyId, period, { motivo, usuarioId: opciones.usuarioId });
    return { period: abierto, advertencias };
  }
}
