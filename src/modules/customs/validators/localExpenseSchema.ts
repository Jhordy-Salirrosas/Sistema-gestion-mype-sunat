import { z } from 'zod';

/**
 * Validador de RUC peruano mediante algoritmo Módulo 11 (SUNAT)
 */
export const isValidPeruvianRuc = (ruc: string): boolean => {
  if (!/^\d{11}$/.test(ruc)) return false;
  const prefixes = ['10', '15', '16', '17', '20'];
  if (!prefixes.includes(ruc.substring(0, 2))) return false;

  const weights = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];
  let sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += parseInt(ruc[i], 10) * weights[i];
  }

  const remainder = sum % 11;
  let checkDigit = 11 - remainder;
  if (checkDigit === 10) checkDigit = 0;
  if (checkDigit === 11) checkDigit = 1;

  return checkDigit === parseInt(ruc[10], 10);
};

export const localExpenseSchema = z.object({
  shipment_id: z.string().uuid('Debe asociar un expediente comercial válido'),
  supplier_ruc: z
    .string()
    .trim()
    .length(11, 'El RUC debe tener 11 dígitos numéricos')
    .refine(isValidPeruvianRuc, { message: 'El RUC ingresado no supera la validación por Módulo 11 de SUNAT' }),
  supplier_name: z.string().trim().min(3, 'Razón social del proveedor requerida'),
  expense_concept: z.string().trim().min(2, 'El concepto de gasto es requerido (ej. ALMACENAJE, AGENCIA)'),
  invoice_serial_number: z
    .string()
    .trim()
    .regex(/^[FE0-9]{4}-\d{1,8}$/, 'El formato debe ser Serie-Correlativo (ej. F001-12345 o E001-456)'),
  issue_date: z.string().min(1, 'La fecha de emisión es obligatoria'),
  net_amount_pen: z.number().positive('La base imponible (sin IGV) debe ser mayor a cero'),
  igv_amount_pen: z.number().min(0, 'El crédito fiscal de IGV no puede ser negativo'),
  total_amount_pen: z.number().positive('El importe total del comprobante debe ser mayor a cero'),
  spot_detraction_rate: z.number().min(0).max(100).default(0),
  is_capitalizable: z.boolean().default(true),
  proration_method: z.enum(['VALOR_FOB', 'PESO_BRUTO', 'UNIDADES', 'VALOR_CIF'], {
    message: 'Criterio de prorrateo no válido según NIC 2',
  }),
}).refine(
  (data) => Math.abs(data.net_amount_pen + data.igv_amount_pen - data.total_amount_pen) <= 0.05,
  {
    message: 'El Total del comprobante debe coincidir con la suma del Monto Neto y el IGV (tolerancia S/ 0.05)',
    path: ['total_amount_pen'],
  }
);

export type LocalExpenseFormData = z.infer<typeof localExpenseSchema>;
