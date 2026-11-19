import { GetSireProposalUseCase } from '../../../src/modules/sire/application/use-cases/getSireProposalUseCase';
import { SireTicketManagerService } from '../../../src/modules/sire/application/sireTicketManagerService';
import { MockSireSunatGateway } from '../../../src/modules/sire/infrastructure/sunat/mockSireSunatGateway';
import { UnsupportedSireSunatGateway } from '../../../src/modules/sire/infrastructure/sunat/unsupportedSireSunatGateway';

const dto = { period: '202611', bookType: 'RCE_COMPRAS' as const };
const proposal = {
  companyId: 'company-a',
  period: '202611',
  bookType: 'RCE' as const,
  carSunat: 'CAR-1',
  emitterRuc: '20123456789',
  documentType: '01',
  series: 'F001',
  correlative: '1',
  issueDate: new Date('2026-11-01'),
  taxableBase: 100,
  igvAmount: 18,
  totalAmount: 118,
};

function dependencies() {
  const repository = {
    getPeriod: jest.fn(),
    saveSunatProposal: jest.fn(),
    getPeriodProposals: jest.fn().mockResolvedValue([proposal]),
  };
  const sunat = {
    getProposal: jest.fn().mockResolvedValue([proposal]),
  };
  return { repository, sunat };
}

describe('SIRE read-only use cases', () => {
  it('gets and persists a SUNAT proposal', async () => {
    const { repository, sunat } = dependencies();
    repository.getPeriodProposals.mockResolvedValue([
      { ...proposal, id: 'proposal-1' },
    ]);
    const result = await new GetSireProposalUseCase(
      repository as never,
      sunat as never,
    ).execute(dto, 'company-a');

    expect(result).toEqual({
      period: '202611',
      bookType: 'RCE_COMPRAS',
      state: 'PROPUESTA',
      count: 1,
      proposals: [{ ...proposal, id: 'proposal-1' }],
    });
    expect(repository.saveSunatProposal).toHaveBeenCalledWith(
      'company-a',
      '202611',
      'RCE',
      [proposal],
    );
    expect(repository.getPeriodProposals).toHaveBeenCalledWith(
      'company-a',
      '202611',
      'RCE',
    );
  });
});

describe('SIRE ticket manager and gateways', () => {
  it('reads the period and the proposals from the local repository', async () => {
    const repository = {
      getPeriod: jest.fn().mockResolvedValue({ id: 'p', state: 'PROPUESTA' }),
      getPeriodProposals: jest.fn().mockResolvedValue([proposal]),
    };
    const manager = new SireTicketManagerService(repository as never);

    await expect(
      manager.getPeriod('company-a', '202611', 'RCE_COMPRAS'),
    ).resolves.toEqual({ id: 'p', state: 'PROPUESTA' });
    await expect(
      manager.getRecords('company-a', '202611', 'RCE_COMPRAS'),
    ).resolves.toEqual([proposal]);
    expect(repository.getPeriodProposals).toHaveBeenCalledWith(
      'company-a',
      '202611',
      'RCE',
    );
  });

  it('returns mock fixtures for the only read operation', async () => {
    const gateway = new MockSireSunatGateway();
    expect(
      (await gateway.getProposal('company-a', '202611', 'RCE')).map(
        (item) => item.origin,
      ),
    ).toEqual(['SUNAT', 'SUNAT', 'USUARIO']);
  });

  it('keeps the production gateway explicitly unavailable', async () => {
    const gateway = new UnsupportedSireSunatGateway();

    await expect(
      gateway.getProposal('c', '202611', 'RCE'),
    ).rejects.toThrow();
  });
});
