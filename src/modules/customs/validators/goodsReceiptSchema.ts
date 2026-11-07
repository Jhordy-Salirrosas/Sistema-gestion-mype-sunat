import { z } from 'zod';

export const goodsReceiptItemSchema = z.object({
  customsItemId: z.string().optional(),
  productCode: z.string().min(1, 'Código de producto requerido'),
  commercialDescription: z.string().min(1, 'Descripción comercial requerida'),
  declaredQuantity: z.number().min(0, 'Cantidad declarada no puede ser negativa'),
  receivedQuantity: z.number().min(0, 'Cantidad recibida no puede ser negativa'),
  damagedQuantity: z.number().min(0, 'Cantidad averiada no puede ser negativa').optional(),
  discrepancyReason: z.string().optional(),
  unitCode: z.string().optional(),
  destinationType: z.enum(['MERCADERIA', 'ACTIVO_FIJO']).optional(),
});

export const goodsReceiptSchema = z.object({
  receiptNumber: z.string().min(3, 'El número de acta debe tener al menos 3 caracteres'),
  declarationId: z.string().min(1, 'Debe seleccionar una DAM'),
  shipmentId: z.string().optional(),
  warehouseCode: z.string().optional(),
  receptionType: z.enum(['TOTAL', 'PARCIAL']).optional(),
  responsibleName: z.string().min(3, 'Nombre del responsable requerido (mínimo 3 caracteres)'),
  responsibleDni: z.string().optional(),
  containerNumber: z.string().optional(),
  sealNumber: z.string().optional(),
  observations: z.string().optional(),
  items: z.array(goodsReceiptItemSchema).min(1, 'Debe incluir al menos un ítem para recepción'),
});

export type GoodsReceiptFormData = z.infer<typeof goodsReceiptSchema>;
export type GoodsReceiptItemFormData = z.infer<typeof goodsReceiptItemSchema>;
