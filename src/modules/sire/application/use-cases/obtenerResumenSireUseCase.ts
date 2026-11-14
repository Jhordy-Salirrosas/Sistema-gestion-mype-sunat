import { Injectable } from '@nestjs/common';
import { toDomainBookType } from '../sireBookType';
import type { SireLibroMenu } from '../dto/sireMenuQueryDto';
import type { SireResumenRespuesta } from '../dto/sireMenuResponseDto';
import {
  calcularResumenSimulado,
  generarComprobantesSimulados,
} from '../../domain/rules/sireMockDataRule';
import { SireMenuRepository } from '../../infrastructure/persistence/sireMenuRepository';

/**
 * Resumen de un periodo.
 *
 * Devuelve los totales simulados del periodo junto con los contadores de lo
 * que se ha ido haciendo en el menú (importaciones, conciliaciones y
 * reportes). Los contadores salen de las tablas reales: esa parte no es
 * simulada.
 */
@Injectable()
export class ObtenerResumenSireUseCase {
  constructor(private readonly repository: SireMenuRepository) {}

  async execute(
    companyId: string,
    periodo: string,
    libro: SireLibroMenu | null,
  ): Promise<SireResumenRespuesta> {
    const [importaciones, conciliaciones, reportes] = await Promise.all([
      this.repository.contarImportaciones(companyId, periodo),
      this.repository.contarConciliaciones(companyId, periodo),
      this.repository.contarReportes(companyId, periodo),
    ]);

    const libroDomain = toDomainBookType(libro ?? 'RVIE_VENTAS');
    const comprobantes = generarComprobantesSimulados(
      periodo,
      libroDomain,
      importaciones,
    );
    const resumen = calcularResumenSimulado(periodo, libroDomain, comprobantes);

    return {
      periodo,
      libro,
      resumen,
      importaciones,
      conciliaciones,
      reportes,
    };
  }
}
