import { SimulateManualSireConsultationUseCase } from '../../../src/modules/sire/application/use-cases/simulateManualSireConsultationUseCase';

describe('SimulateManualSireConsultationUseCase', () => {
  it('returns simulated RVIE and RCE records related to the requested RUC', () => {
    const result = new SimulateManualSireConsultationUseCase().execute({
      ruc: '20100070970',
      period: '202611',
    });

    expect(result).toMatchObject({
      mode: 'SIMULATED',
      sunatContacted: false,
      solCredentialStored: false,
      ruc: '20100070970',
      period: '202611',
      modules: [
        {
          code: 'RVIE',
          bookType: 'RVIE_VENTAS',
          relatedRuc: '20100070970',
          state: 'SIMULATED',
          count: 1,
          records: [
            {
              relatedRuc: '20100070970',
              issueDate: '2026-11-05',
              car: 'DEMO-RVIE-202611-001',
            },
          ],
        },
        {
          code: 'RCE',
          bookType: 'RCE_COMPRAS',
          relatedRuc: '20100070970',
          state: 'SIMULATED',
          count: 1,
          records: [
            {
              relatedRuc: '20100070970',
              issueDate: '2026-11-10',
              car: 'DEMO-RCE-202611-001',
            },
          ],
        },
      ],
    });
  });

  it('does not return or retain the manually supplied SOL password', () => {
    const solPassword = 'fake-sol-password-do-not-store';
    const input = {
      ruc: '20100070970',
      period: '202611',
      solPassword,
    };
    const useCase = new SimulateManualSireConsultationUseCase();
    const result = useCase.execute(input);

    expect(JSON.stringify(result)).not.toContain(solPassword);
    expect(Object.keys(result)).not.toContain('solPassword');
  });
});
