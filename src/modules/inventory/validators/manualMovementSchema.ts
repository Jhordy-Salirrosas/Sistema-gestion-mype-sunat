import { z } from 'zod';

export const manualMovementSchema = z.object({
  sku: z.string().min(1, 'Debe seleccionar o ingresar un SKU'),
  warehouse_code: z.string().optional(),
  direction: z.enum(['ENTRADA', 'SALIDA']),
  operation_type_code: z.string().min(1, 'Seleccione un tipo de operación Tabla 12'),
  quantity: z.number().min(0.0001, 'La cantidad debe ser mayor a 0'),
  unit_cost: z.number().min(0, 'El costo unitario no puede ser negativo').optional(),
  document_type_code: z.string().optional(),
  document_serial: z.string().optional(),
  document_number: z.string().optional(),
  movement_date: z.string().optional(),
  notes: z.string().optional(),
});

export type ManualMovementFormData = z.infer<typeof manualMovementSchema>;

