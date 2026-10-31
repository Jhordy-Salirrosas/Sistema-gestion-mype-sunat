import { EvaluateBookObligationUseCase } from '../../../src/modules/inventory/application/use-cases/evaluateBookObligationUseCase';

describe('EvaluateBookObligationUseCase (Art. 35 Reglamento LIR & RS 239-2008)', () => {
  let useCase: EvaluateBookObligationUseCase;
  let repoMock: any;

  beforeEach(() => {
    repoMock = {
      saveDecision: jest.fn().mockImplementation((d) => Promise.resolve(d)),
    };
    useCase = new EvaluateBookObligationUseCase(repoMock);
  });

  it('determina excepción total de libros permanentes para empresas con ingresos <= 500 UIT', async () => {
    const result = await useCase.execute(
      {
        fiscal_year: 2026,
        annual_revenue_uit: 450,
        tax_regime: 'MYPE_TRIBUTARIO',
      },
      'comp-100',
    );

    expect(result.ple12_1Status).toBe('EXCEPTUADO');
    expect(result.ple13_1Status).toBe('EXCEPTUADO');
    expect(result.legalBasisNotes).toContain('menores o iguales a 500 UIT');
  });

  it('determina obligatoriedad de PLE 12.1 (Unidades Físicas) entre 500 y 1,500 UIT', async () => {
    const result = await useCase.execute(
      {
        fiscal_year: 2026,
        annual_revenue_uit: 1200,
        tax_regime: 'GENERAL',
      },
      'comp-100',
    );

    expect(result.ple12_1Status).toBe('OBLIGATORIO');
    expect(result.ple13_1Status).toBe('VOLUNTARIO');
  });

  it('determina obligatoriedad de PLE 13.1 y excepción expresa de 12.1 para ingresos > 1,500 UIT (RS 239-2008)', async () => {
    const result = await useCase.execute(
      {
        fiscal_year: 2026,
        annual_revenue_uit: 2500,
        tax_regime: 'GENERAL',
      },
      'comp-100',
    );

    expect(result.ple13_1Status).toBe('OBLIGATORIO');
    expect(result.ple12_1Status).toBe('EXCEPTUADO');
    expect(result.legalBasisNotes).toContain('RS 239-2008/SUNAT');
  });

  it('determina excepción total para el Régimen Especial (RER)', async () => {
    const result = await useCase.execute(
      {
        fiscal_year: 2026,
        annual_revenue_uit: 200,
        tax_regime: 'RER',
      },
      'comp-100',
    );

    expect(result.ple12_1Status).toBe('EXCEPTUADO');
    expect(result.ple13_1Status).toBe('EXCEPTUADO');
    expect(result.legalBasisNotes).toContain('RER');
  });
});

