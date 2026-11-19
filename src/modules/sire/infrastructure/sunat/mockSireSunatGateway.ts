import { Injectable } from '@nestjs/common';
import type { SireDomainBookType } from '../../application/sireBookType';
import type { SireProposalEntity } from '../../domain/entities/sireProposalEntity';
import type { SireSunatGatewayPort } from '../../domain/ports/sireSunatGatewayPort';

/**
 * Doble de SUNAT para desarrollo.
 *
 * Solo implementa la consulta de propuestas: el módulo SIRE no emite nada
 * contra SUNAT, ni siquiera en modo mock.
 */
@Injectable()
export class MockSireSunatGateway implements SireSunatGatewayPort {
  async getProposal(
    companyId: string,
    period: string,
    bookType: SireDomainBookType,
  ): Promise<SireProposalEntity[]> {
    return [
      this.proposal(companyId, period, bookType, 'CAR-MOCK-001', '20123456789', 'SUNAT'),
      this.proposal(companyId, period, bookType, 'CAR-MOCK-002', '20123456789', 'SUNAT'),
      this.proposal(companyId, period, bookType, 'CAR-MOCK-003', '20654321987', 'USUARIO'),
    ];
  }

  private proposal(
    companyId: string,
    period: string,
    bookType: SireDomainBookType,
    carSunat: string,
    emitterRuc: string,
    origin: 'SUNAT' | 'USUARIO',
  ): SireProposalEntity {
    return {
      companyId,
      period,
      bookType,
      carSunat,
      emitterRuc,
      documentType: '01',
      series: 'F001',
      correlative: carSunat.slice(-3),
      issueDate: new Date(`${period.slice(0, 4)}-${period.slice(4)}-15T00:00:00.000Z`),
      taxableBase: 100,
      igvAmount: 18,
      totalAmount: 118,
      origin,
    };
  }
}
