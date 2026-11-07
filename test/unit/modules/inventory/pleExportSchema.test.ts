import { describe, it, expect } from 'vitest';
import { pleEvaluationSchema, pleExportSchema } from '@/modules/inventory/validators/pleExportSchema';

describe('pleExportSchema and pleEvaluationSchema', () => {
  it('valida exitosamente la evaluación de obligatoriedad Art. 35 LIR', () => {
    const valid = {
      fiscal_year: 2026,
      annual_revenue_uit: 1800,
      tax_regime: 'MYPE_TRIBUTARIO',
    };
    const res = pleEvaluationSchema.safeParse(valid);
    expect(res.success).toBe(true);
  });

  it('rechaza ingresos UIT negativos', () => {
    const invalid = {
      fiscal_year: 2026,
      annual_revenue_uit: -10,
      tax_regime: 'MYPE_TRIBUTARIO',
    };
    const res = pleEvaluationSchema.safeParse(invalid);
    expect(res.success).toBe(false);
  });

  it('valida payload de exportación para PLE 13.1 y 12.1', () => {
    const valid13 = {
      book_type: '13.1' as const,
      fiscal_year: 2026,
      month: '00',
    };
    expect(pleExportSchema.safeParse(valid13).success).toBe(true);

    const valid12 = {
      book_type: '12.1' as const,
      fiscal_year: 2026,
    };
    expect(pleExportSchema.safeParse(valid12).success).toBe(true);
  });

  it('rechaza libro desconocido', () => {
    const invalid = {
      book_type: '5.1',
      fiscal_year: 2026,
    };
    expect(pleExportSchema.safeParse(invalid).success).toBe(false);
  });
});

