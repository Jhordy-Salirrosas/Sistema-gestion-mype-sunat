import { z } from 'zod';

export const duaWizardItemSchema = z.object({
  series_order: z.number().int().positive('La serie debe ser correlativa y positiva'),
  product_code: z.string().trim().min(1, 'El código del producto es obligatorio'),
  hs_code: z
    .string()
    .trim()
    .regex(/^\d{10}$/, 'La Subpartida Nacional (SPN) debe tener 10 dígitos numéricos exactos (ej. 8471300000)'),
  commercial_description: z
    .string()
    .trim()
    .min(5, 'La descripción comercial debe detallar marca, modelo y características (mínimo 5 caracteres)'),
  goods_state: z.enum(['NUEVO', 'USADO']).default('NUEVO'),
  destination_type: z.enum(['MERCADERIA', 'ACTIVO_FIJO']).default('MERCADERIA'),
  tpi_code: z.string().max(3).optional().or(z.literal('')),
  physical_quantity: z.number().positive('La cantidad física debe ser mayor a cero'),
  physical_unit: z.string().trim().min(2, 'Unidad de medida obligatoria (ej. NIU, KGM)'),
  net_weight_kg: z.number().positive('El peso neto debe ser mayor a cero'),
  gross_weight_kg: z.number().positive('El peso bruto debe ser mayor a cero'),
  fob_usd: z.number().positive('El valor FOB debe ser mayor a cero'),
  ad_valorem_rate: z.number().min(0, 'Tasa arancelaria no puede ser negativa').max(100),
}).refine((data) => data.gross_weight_kg >= data.net_weight_kg, {
  message: 'El peso bruto debe ser mayor o igual al peso neto',
  path: ['gross_weight_kg'],
});

export const duaWizardSchema = z.object({
  shipment_id: z.string().uuid('Debe asociar un expediente comercial válido'),
  customs_code: z
    .string()
    .trim()
    .regex(/^\d{3}$/, 'Código de aduana de 3 dígitos (ej. 118 Callao, 370 Chancay)'),
  declaration_year: z.number().int().min(2000).max(2100),
  correlative_number: z
    .string()
    .trim()
    .regex(/^\d{6}$/, 'El correlativo de la DAM debe tener 6 dígitos numéricos'),
  numeration_date: z.string().min(1, 'La fecha de numeración es requerida'),
  dispatch_mode: z.enum(['10', '00', '01', '02'], {
    message: 'Modalidad de despacho no válida (10 Anticipado, 00 Diferido, 01 Urgente)',
  }),
  channel: z.enum(['PENDIENTE', 'VERDE', 'NARANJA', 'ROJO']).default('PENDIENTE'),
  transport_doc_number: z.string().trim().min(1, 'El número de B/L o Guía Aérea es obligatorio'),
  manifest_number: z.string().optional().or(z.literal('')),
  fob_total_usd: z.number().positive('El FOB total debe ser mayor a cero'),
  freight_total_usd: z.number().min(0, 'El flete no puede ser negativo'),
  insurance_total_usd: z.number().min(0).optional().default(0),
  exchange_rate: z.number().positive('El tipo de cambio venta debe ser mayor a cero'),
  has_article_160_guarantee: z.boolean().default(false),
  items: z.array(duaWizardItemSchema).min(1, 'La DAM debe tener al menos una serie arancelaria declarada'),
}).refine(
  (data) => {
    const sumFobItems = data.items.reduce((acc, item) => acc + item.fob_usd, 0);
    return Math.abs(sumFobItems - data.fob_total_usd) <= 0.05;
  },
  {
    message: 'La sumatoria del valor FOB de las series no coincide con el FOB total declarado (tolerancia máx. $0.05)',
    path: ['fob_total_usd'],
  }
);

export type DuaWizardFormData = z.infer<typeof duaWizardSchema>;
export type DuaWizardItemFormData = z.infer<typeof duaWizardItemSchema>;
