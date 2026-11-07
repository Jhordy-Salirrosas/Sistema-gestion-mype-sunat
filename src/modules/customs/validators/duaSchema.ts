import { z } from 'zod';

export const registerDuaItemSchema = z.object({
  item_order: z.number().int().min(1),
  item_code: z.string().optional(),
  hs_code: z
    .string()
    .regex(/^(\d{10}|\d{4}\.\d{2}\.\d{2}\.\d{2})$/, {
      message: 'La subpartida arancelaria debe contener 10 dígitos (ej. 8471300000 o 8471.30.00.00)',
    }),
  commercial_description: z
    .string()
    .min(1, { message: 'La descripción comercial es obligatoria' }),
  quantity: z
    .number()
    .positive({ message: 'La cantidad debe ser mayor a 0' }),
  unit_code: z
    .string()
    .min(1, { message: 'Selecciona una unidad de medida' }),
  fob_unit_usd: z
    .number()
    .positive({ message: 'El valor FOB unitario debe ser mayor a 0' }),
});

export const registerDuaSchema = z
  .object({
    dua_number: z
      .string()
      .regex(/^\d{3}-\d{4}-\d{2}-\d{6}$/, {
        message: 'Formato inválido de DAM. Debe ser Aduana-Año-Régimen-Correlativo (ej. 118-2026-10-012345)',
      }),
    customs_agency_code: z
      .string()
      .min(3, { message: 'Selecciona la intendencia de aduana' }),
    regime_code: z.string().default('10'),
    numeration_date: z
      .string()
      .min(1, { message: 'La fecha de numeración es obligatoria' }),
    fob_value_usd: z
      .number()
      .positive({ message: 'El valor FOB total debe ser mayor a 0' }),
    freight_value_usd: z
      .number()
      .min(0, { message: 'El flete no puede ser negativo' })
      .default(0),
    insurance_value_usd: z
      .number()
      .min(0, { message: 'El seguro no puede ser negativo' })
      .default(0),
    exchange_rate: z
      .number()
      .positive({ message: 'El tipo de cambio debe ser mayor a 0' }),
    ad_valorem_rate: z.number().min(0).max(30).default(6),
    perception_rate: z.number().min(0).max(20).default(3.5),
    items: z
      .array(registerDuaItemSchema)
      .min(1, { message: 'Debes registrar al menos un producto o serie arancelaria en la DAM' }),
  })
  .refine(
    (data) => {
      const itemsSum = data.items.reduce(
        (acc, item) => acc + item.quantity * item.fob_unit_usd,
        0
      );
      return Math.abs(itemsSum - data.fob_value_usd) < 0.01;
    },
    {
      message: 'La suma de FOB de los ítems no coincide con el Valor FOB global declarado',
      path: ['fob_value_usd'],
    }
  );

export type RegisterDuaFormData = z.infer<typeof registerDuaSchema>;
export type RegisterDuaItemFormData = z.infer<typeof registerDuaItemSchema>;
