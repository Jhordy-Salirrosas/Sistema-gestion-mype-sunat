import { z } from 'zod';

export const shipmentSchema = z.object({
  shipment_number: z
    .string()
    .trim()
    .min(1, 'El número de expediente es requerido')
    .regex(/^EXP-\d{4}-\d{5}$/, 'El formato debe ser EXP-AAAA-NNNNN (ej. EXP-2026-00042)'),
  supplier_id: z.string().uuid('Debe seleccionar un proveedor del exterior válido'),
  incoterm: z.enum(
    ['EXW', 'FCA', 'FAS', 'FOB', 'CFR', 'CIF', 'CPT', 'CIP', 'DAP', 'DPU', 'DDP'],
    { message: 'Incoterm no válido según el estándar ICC 2020' }
  ),
  currency_code: z.string(),
  transport_mode: z.enum(['MARITIMO', 'AEREO', 'TERRESTRE', 'FLUVIAL'], {
    message: 'Seleccione una vía de transporte válida',
  }),
  origin_country_code: z
    .string()
    .trim()
    .length(2, 'El país de origen debe tener código ISO de 2 letras (ej. CN, US)'),
  destination_customs: z
    .string()
    .trim()
    .regex(/^\d{3}$/, 'El código de aduana debe contener exactamente 3 dígitos (ej. 118 Callao, 370 Chancay)'),
  customs_broker_id: z.string().uuid().optional().or(z.literal('')),
  etd_date: z.string().optional().or(z.literal('')),
  eta_date: z.string().optional().or(z.literal('')),
  order_reference: z.string().max(40, 'Máximo 40 caracteres').optional().or(z.literal('')),
});

export type ShipmentFormData = z.infer<typeof shipmentSchema>;
