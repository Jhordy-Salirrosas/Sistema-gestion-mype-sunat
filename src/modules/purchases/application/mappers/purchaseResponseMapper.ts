import { UnauthorizedException } from '@nestjs/common';

/**
 * Valida que el identificador de empresa esté presente en el contexto autenticado.
 */
export function requirePurchaseCompanyId(companyId?: string): string {
  if (!companyId) {
    throw new UnauthorizedException('Identificador de empresa requerido.');
  }
  return companyId;
}

/**
 * Mapea una compra nacional al formato de respuesta API compartido entre módulos.
 */
export function mapPurchaseRecord(
  purchase: any,
  options: { includeExtended?: boolean; includeItemsCount?: boolean } = {},
) {
  const { includeExtended = false, includeItemsCount = false } = options;
  const totalAmount = Number(purchase.total_amount);
  const paidAmount = Number(purchase.paid_amount ?? 0);
  const pendingAmount = Math.max(0, Math.round((totalAmount - paidAmount) * 100) / 100);

  return {
    id: purchase.id,
    purchaseNumber: purchase.purchase_number,
    supplierDocNumber: purchase.supplier_doc_number,
    supplierName: purchase.supplier_name,
    documentTypeCode: purchase.document_type_code,
    documentSerial: purchase.document_serial,
    documentNumber: purchase.document_number,
    issueDate: purchase.issue_date,
    createdAt: purchase.created_at,
    pricesIncludeIgv: purchase.prices_include_igv === true,
    warehouseCode: purchase.warehouse_code,
    ...(includeExtended
      ? {
          currencyCode: purchase.currency_code ?? 'PEN',
          exchangeRate: Number(purchase.exchange_rate ?? 1),
        }
      : {}),
    netAmount: Number(purchase.net_amount),
    igvAmount: Number(purchase.igv_amount),
    totalAmount,
    ...(includeExtended ? { paidAmount, pendingAmount } : {}),
    status: purchase.status,
    receptionStatus: purchase.reception_status ?? 'RECIBIDA',
    notes: purchase.notes,
    responsible: purchase.responsible,
    ...(includeItemsCount ? { itemsCount: purchase.items.length } : {}),
    items: (purchase.items ?? []).map((item: any) => ({
      id: item.id,
      sku: item.sku,
      description: item.description,
      quantity: Number(item.quantity),
      receivedQuantity: Number(item.received_quantity ?? item.quantity),
      unitCost: Number(item.unit_cost),
      subtotal: Number(item.subtotal),
      igvAmount: Number(item.igv_amount),
      totalAmount: Number(item.total_amount),
    })),
  };
}

/**
 * Mapea el listado de compras nacionales al formato de respuesta paginado.
 */
export function mapPurchasesListResponse(purchases: any[], includeExtended = false) {
  return {
    total: purchases.length,
    items: purchases.map((purchase) =>
      mapPurchaseRecord(purchase, { includeExtended, includeItemsCount: true }),
    ),
  };
}

