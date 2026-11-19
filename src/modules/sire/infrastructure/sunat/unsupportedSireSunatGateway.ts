import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import type { SireDomainBookType } from '../../application/sireBookType';
import type { SireProposalEntity } from '../../domain/entities/sireProposalEntity';
import type { SireSunatGatewayPort } from '../../domain/ports/sireSunatGatewayPort';

@Injectable()
export class UnsupportedSireSunatGateway implements SireSunatGatewayPort {
  private unavailable(): ServiceUnavailableException {
    return new ServiceUnavailableException(
      'El cliente SUNAT SIRE no está configurado para este ambiente.',
    );
  }

  getProposal(
    _companyId: string,
    _period: string,
    _bookType: SireDomainBookType,
  ): Promise<SireProposalEntity[]> {
    return Promise.reject(this.unavailable());
  }
}
