import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { SireAccountingMappingResponse } from '../dto/sireAccountingMappingDto';
import {
  SIRE_ACCOUNTING_MAPPING_REPOSITORY_PORT,
  type ISireAccountingMappingRepositoryPort,
  type SireAccountingMappingEntry,
} from '../../domain/ports/sireAccountingMappingRepositoryPort';

/**
 * Guarda el mapeo contable SIRE de la empresa autenticada.
 *
 * El endpoint recibe el conjunto completo: cada elemento se inserta o se
 * actualiza según el par `(empresa, tipo de operación)`. Los tipos repetidos
 * con la misma cuenta se deduplican; con cuentas distintas se rechazan para
 * no dejar el mapeo ambiguo.
 */
@Injectable()
export class SaveSireAccountingMappingsUseCase {
  constructor(
    @Inject(SIRE_ACCOUNTING_MAPPING_REPOSITORY_PORT)
    private readonly repository: ISireAccountingMappingRepositoryPort,
  ) {}

  async execute(
    companyId: string,
    mappings: SireAccountingMappingEntry[],
  ): Promise<SireAccountingMappingResponse[]> {
    if (!Array.isArray(mappings) || mappings.length === 0) {
      throw new BadRequestException(
        'Debe enviar al menos un mapeo contable.',
      );
    }

    const normalized = this.normalize(mappings);
    const saved = await this.repository.upsertMany(companyId, normalized);
    if (!saved) {
      throw new NotFoundException('Empresa no encontrada.');
    }

    return saved;
  }

  private normalize(
    mappings: SireAccountingMappingEntry[],
  ): SireAccountingMappingEntry[] {
    const byOperation = new Map<string, string>();

    for (const mapping of mappings) {
      const tipoOperacion = mapping.tipoOperacion.trim().toUpperCase();
      const cuentaContable = mapping.cuentaContable.trim();

      if (tipoOperacion.length === 0 || cuentaContable.length === 0) {
        throw new BadRequestException(
          'El tipo de operación y la cuenta contable son obligatorios.',
        );
      }

      const previous = byOperation.get(tipoOperacion);
      if (previous !== undefined && previous !== cuentaContable) {
        throw new BadRequestException(
          `El tipo de operación ${tipoOperacion} está repetido con cuentas distintas.`,
        );
      }

      byOperation.set(tipoOperacion, cuentaContable);
    }

    return [...byOperation.entries()].map(
      ([tipoOperacion, cuentaContable]) => ({
        tipoOperacion,
        cuentaContable,
      }),
    );
  }
}
