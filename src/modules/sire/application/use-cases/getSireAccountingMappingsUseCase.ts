import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { ListAccountingAccountsUseCase } from '../../../accounting/application/use-cases/listAccountingAccountsUseCase';
import type { SireAccountingMappingResponse } from '../dto/sireAccountingMappingDto';
import {
  SIRE_ACCOUNTING_MAPPING_REPOSITORY_PORT,
  type ISireAccountingMappingRepositoryPort,
} from '../../domain/ports/sireAccountingMappingRepositoryPort';

/**
 * Consulta el mapeo contable SIRE de la empresa autenticada.
 *
 * El mapeo es EXCLUSIVO del módulo SIRE (`sire_accounting_mappings`); no lee ni
 * modifica el mapeo global de otros procesos. Los nombres y el estado de las
 * cuentas se resuelven contra el catálogo PCGE real de la base de datos.
 */
@Injectable()
export class GetSireAccountingMappingsUseCase {
  constructor(
    @Inject(SIRE_ACCOUNTING_MAPPING_REPOSITORY_PORT)
    private readonly repository: ISireAccountingMappingRepositoryPort,
    private readonly accountingAccounts: ListAccountingAccountsUseCase,
  ) {}

  async execute(companyId: string): Promise<SireAccountingMappingResponse[]> {
    const [mappings, accounts] = await Promise.all([
      this.repository.findAll(companyId),
      this.accountingAccounts.execute(true),
    ]);
    if (!mappings) {
      throw new NotFoundException('Empresa no encontrada.');
    }

    const byCode = new Map(accounts.map((account) => [account.code, account]));

    return mappings.map((mapping) => {
      const account = byCode.get(mapping.cuentaContable);
      return {
        ...mapping,
        cuentaNombre: account?.name ?? null,
        cuentaActiva: account?.isActive ?? false,
      };
    });
  }
}
