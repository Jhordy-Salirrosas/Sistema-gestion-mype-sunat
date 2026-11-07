import { z } from 'zod';

export const pleEvaluationSchema = z.object({
  fiscal_year: z.number().int().min(2020).max(2050),
  annual_revenue_uit: z.number().min(0, 'Los ingresos en UIT no pueden ser negativos'),
  tax_regime: z.string().min(1, 'Seleccione un régimen tributario'),
});

export const pleExportSchema = z.object({
  book_type: z.enum(['12.1', '13.1']),
  fiscal_year: z.number().int().min(2020).max(2050),
  month: z.string().optional(),
});

export type PleEvaluationFormData = z.infer<typeof pleEvaluationSchema>;
export type PleExportFormData = z.infer<typeof pleExportSchema>;

