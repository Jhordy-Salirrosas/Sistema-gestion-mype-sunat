import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ListAccountingAccountsUseCase } from '../../../accounting/application/use-cases/listAccountingAccountsUseCase';
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
 *
 * Las cuentas se validan contra el catálogo PCGE real (`accounting_accounts`):
 * no se aceptan códigos inventados ni cuentas inactivas. Este mapeo vive en
 * `sire_accounting_mappings` y es exclusivo del módulo SIRE.
 */
@Injectable()
export class SaveSireAccountingMappingsUseCase {
  constructor(
    @Inject(SIRE_ACCOUNTING_MAPPING_REPOSITORY_PORT)
    private readonly repository: ISireAccountingMappingRepositoryPort,
    private readonly accountingAccounts: ListAccountingAccountsUseCase,
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
    await this.assertAccountsExist(normalized);

    const saved = await this.repository.upsertMany(companyId, normalized);
    if (!saved) {
      throw new NotFoundException('Empresa no encontrada.');
    }

    return saved;
  }

  /**
   * Comprueba que cada cuenta exista y esté activa en el catálogo PCGE.
   *
   * El catálogo es global y oficial; la empresa solo elige qué cuenta usar
   * para cada concepto SIRE.
   */
  private async assertAccountsExist(
    mappings: readonly SireAccountingMappingEntry[],
  ): Promise<void> {
    const accounts = await this.accountingAccounts.execute(false);
    const activeCodes = new Set(accounts.map((account) => account.code));
    const invalid = mappings
      .map((mapping) => mapping.cuentaContable)
      .filter((code) => !activeCodes.has(code));

    if (invalid.length > 0) {
      throw new BadRequestException(
        `Las cuentas ${[...new Set(invalid)].join(', ')} no existen o están inactivas en el Plan de Cuentas (PCGE).`,
      );
    }
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
