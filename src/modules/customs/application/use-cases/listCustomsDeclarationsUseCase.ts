import { Inject, Injectable } from '@nestjs/common';
import { CUSTOMS_REPOSITORY_PORT } from '../../domain/ports/customsRepositoryPort';
import type {
  CustomsDeclarationSummary,
  ICustomsRepositoryPort,
} from '../../domain/ports/customsRepositoryPort';

@Injectable()
export class ListCustomsDeclarationsUseCase {
  constructor(
    @Inject(CUSTOMS_REPOSITORY_PORT)
    private readonly customsRepository: ICustomsRepositoryPort,
  ) {}

  async execute(companyId: string): Promise<CustomsDeclarationSummary[]> {
    return this.customsRepository.findDeclarationsByCompany(companyId);
  }
}
