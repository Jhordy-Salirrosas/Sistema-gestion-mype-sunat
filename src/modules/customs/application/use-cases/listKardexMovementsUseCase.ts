import { Inject, Injectable } from '@nestjs/common';
import { CUSTOMS_REPOSITORY_PORT } from '../../domain/ports/customsRepositoryPort';
import type {
  ICustomsRepositoryPort,
  KardexMovementRecord,
} from '../../domain/ports/customsRepositoryPort';

@Injectable()
export class ListKardexMovementsUseCase {
  constructor(
    @Inject(CUSTOMS_REPOSITORY_PORT)
    private readonly customsRepository: ICustomsRepositoryPort,
  ) {}

  async execute(companyId: string): Promise<KardexMovementRecord[]> {
    return this.customsRepository.findKardexMovementsByCompany(companyId);
  }
}
