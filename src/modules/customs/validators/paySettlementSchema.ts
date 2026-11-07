import { z } from 'zod';

export const paySettlementSchema = z.object({
  bank_code: z
    .string()
    .trim()
    .regex(/^\d{3}$/, 'Seleccione una entidad bancaria autorizada por SUNAT (ej. 002 BCP, 011 BBVA, 018 BN)'),
  bank_operation_number: z
    .string()
    .trim()
    .min(4, 'El número de operación bancaria debe contener al menos 4 caracteres'),
  paid_at: z.string().min(1, 'La fecha y hora de la cancelación bancaria es requerida'),
  voucher_storage_url: z.string().url('URL no válida').optional().or(z.literal('')),
});

export type PaySettlementFormData = z.infer<typeof paySettlementSchema>;
