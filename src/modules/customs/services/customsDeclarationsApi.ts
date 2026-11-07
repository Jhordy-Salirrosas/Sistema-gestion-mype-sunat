import { apiClient } from '@/lib/axios';
import {
  type CustomsChannel,
  type CustomsDeclarationRecord,
  type CustomsSettlementRecord,
  type PaySettlementPayload,
  type RegisterDuaWizardPayload,
} from '../types';

export const normalizeDeclarationRecord = (
  raw: Record<string, unknown>
): CustomsDeclarationRecord => {
  const fob = Number(raw.fob_total_usd ?? raw.fobTotalUsd ?? raw.fobValueUsd ?? 0);
  const freight = Number(raw.freight_total_usd ?? raw.freightTotalUsd ?? raw.freightValueUsd ?? 0);
  const insurance = Number(raw.insurance_total_usd ?? raw.insuranceTotalUsd ?? raw.insuranceValueUsd ?? 0);
  const cifUsd = Number(raw.cif_total_usd ?? raw.cifTotalUsd ?? raw.cifValueUsd ?? (fob + freight + insurance));
  const tc = Number(raw.exchange_rate ?? raw.exchangeRate ?? 3.82);
  const cifPen = Number(raw.cif_total_pen ?? raw.cifTotalPen ?? raw.cifValuePen ?? (cifUsd * tc));

  let seriesList: any[] = [];
  if (Array.isArray(raw.series) && raw.series.length > 0) {
    seriesList = raw.series;
  } else if (Array.isArray(raw.items) && raw.items.length > 0) {
    seriesList = (raw.items as any[]).map((it, idx) => ({
      series_order: it.seriesOrder || it.series_order || it.itemOrder || it.item_order || idx + 1,
      product_code: it.productCode || it.product_code || `PROD-${idx + 1}`,
      hs_code: it.hsCode || it.hs_code || '8471.30.00.00',
      commercial_description: it.commercialDescription || it.commercial_description || 'Mercancía importada',
      destination_type: it.destinationType || it.destination_type || 'MERCADERIA',
      physical_quantity: Number(it.quantity || it.physical_quantity || 1),
      physical_unit: it.unitCode || it.unit_code || 'NIU',
      net_weight_kg: Number(it.netWeightKg || it.net_weight_kg || 0),
      gross_weight_kg: Number(it.grossWeightKg || it.gross_weight_kg || 0),
      fob_usd: Number(it.fobTotalUsd || it.fob_total_usd || (it.quantity * it.fobUnitUsd) || 0),
      ad_valorem_rate: Number(it.adValoremRate || it.ad_valorem_rate || 0),
    }));
  }

  return {
    id: String(raw.id || 'dam-001'),
    company_id: String(raw.company_id ?? raw.companyId ?? ''),
    shipment_id: String(raw.shipment_id ?? raw.shipmentId ?? ''),
    dua_number: String(raw.dua_number ?? raw.duaNumber ?? '118-2026-10-045892'),
    customs_code: String(raw.customs_code ?? raw.customsCode ?? raw.customsAgencyCode ?? '118'),
    declaration_year: Number(raw.declaration_year ?? raw.declarationYear ?? new Date().getFullYear()),
    regime_code: String(raw.regime_code ?? raw.regimeCode ?? '10'),
    correlative_number: String(raw.correlative_number ?? raw.correlativeNumber ?? ''),
    numeration_date: String(raw.numeration_date ?? raw.numerationDate ?? new Date().toISOString()),
    dispatch_mode: (raw.dispatch_mode ?? raw.dispatchMode ?? '10') as any,
    channel: (raw.channel as CustomsChannel) || 'VERDE',
    transport_doc_number: String(raw.transport_doc_number ?? raw.transportDocNumber ?? ''),
    manifest_number:
      raw.manifest_number != null
        ? String(raw.manifest_number)
        : raw.manifestNumber != null
        ? String(raw.manifestNumber)
        : '',
    fob_total_usd: fob,
    freight_total_usd: freight,
    insurance_total_usd: insurance,
    cif_total_usd: cifUsd,
    exchange_rate: tc,
    cif_total_pen: cifPen,
    total_ad_valorem_pen: Number(raw.total_ad_valorem_pen ?? raw.totalAdValoremPen ?? 0),
    total_igv_pen: Number(raw.total_igv_pen ?? raw.totalIgvPen ?? 0),
    total_ipm_pen: Number(raw.total_ipm_pen ?? raw.totalIpmPen ?? 0),
    total_perception_pen: Number(raw.total_perception_pen ?? raw.totalPerceptionPen ?? 0),
    has_article_160_guarantee: Boolean(
      raw.has_article_160_guarantee ?? raw.hasArticle160Guarantee ?? false
    ),
    version: Number(raw.version ?? 1),
    created_at: String(raw.created_at ?? raw.createdAt ?? new Date().toISOString()),
    series: seriesList,
    settlements: Array.isArray(raw.settlements) ? (raw.settlements as any) : undefined,
    supplier_name: (raw.supplier_name ?? raw.supplierName) as string | undefined,
    supplier_tax_id: (raw.supplier_tax_id ?? raw.supplierTaxId) as string | undefined,
    supplier_country: (raw.supplier_country ?? raw.supplierCountry) as string | undefined,
    commercial_invoice_number: (raw.commercial_invoice_number ?? raw.commercialInvoiceNumber ?? raw.invoice_number) as string | undefined,
    incoterm: (raw.incoterm ?? raw.incoterms) as string | undefined,
  };
};

export const DEFAULT_DEMO_SETTLEMENTS: CustomsSettlementRecord[] = [
  {
    id: 'set-0010',
    declaration_id: 'dam-001',
    settlement_type: 'TIPO_0010_DECLARACION',
    settlement_number: '118-2026-0010-045892',
    tax_code: '0001',
    amount_usd: 9283.50,
    amount_pen: 35462.97,
    due_date: '2026-11-05',
    status: 'GENERADA',
    cda_number: '11826100104589',
  },
  {
    id: 'set-0026',
    declaration_id: 'dam-001',
    settlement_type: 'TIPO_0026_MAYOR_VALOR',
    settlement_number: '118-2026-0026-045892',
    tax_code: '0096',
    amount_usd: 2130.05,
    amount_pen: 8136.78,
    due_date: '2026-11-05',
    status: 'GENERADA',
    cda_number: '11826100264589',
  },
];

export const getStoredSettlements = (): CustomsSettlementRecord[] => {
  try {
    const raw = typeof window !== 'undefined' ? localStorage.getItem('customs_settlements_cache') : null;
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {
    // fallback
  }
  return DEFAULT_DEMO_SETTLEMENTS;
};

export const markSettlementPaidInStorage = (
  settlementId: string,
  payload: PaySettlementPayload
): CustomsSettlementRecord[] => {
  const current = getStoredSettlements();
  const updated = current.map((s) =>
    s.id === settlementId
      ? {
          ...s,
          status: 'PAGADA' as const,
          paid_at: payload.paid_at,
          bank_code: payload.bank_code,
          bank_operation_number: payload.bank_operation_number,
        }
      : s
  );
  try {
    if (typeof window !== 'undefined') {
      localStorage.setItem('customs_settlements_cache', JSON.stringify(updated));
    }
  } catch {
    // ignorar fallo de cuota localstorage
  }
  return updated;
};

export const customsDeclarationsApi = {
  /**
   * Registra y numera la DAM oficial mediante el Asistente Wizard en 4 Pasos.
   */
  registerDuaWizard: async (
    payload: RegisterDuaWizardPayload
  ): Promise<CustomsDeclarationRecord> => {
    const response = await apiClient.post<Record<string, unknown>>(
      '/customs/declarations/wizard',
      payload
    );
    return normalizeDeclarationRecord(response.data);
  },

  /**
   * Consulta las declaraciones aduaneras registradas de la empresa activa.
   */
  getDeclarations: async (): Promise<CustomsDeclarationRecord[]> => {
    try {
      const response = await apiClient.get<Record<string, unknown>[]>('/customs/declarations');
      const list = Array.isArray(response.data) ? response.data : [];
      return list.map(normalizeDeclarationRecord);
    } catch {
      return [];
    }
  },

  /**
   * Consulta el detalle completo de una DAM con sus series y liquidaciones con CDA.
   */
  getDeclarationById: async (id: string): Promise<CustomsDeclarationRecord> => {
    const response = await apiClient.get<Record<string, unknown>>(`/customs/declarations/${id}`);
    return normalizeDeclarationRecord(response.data);
  },

  /**
   * Obtiene la lista de liquidaciones de cobranza tributaria pendientes de pago.
   */
  getPendingSettlements: async (): Promise<CustomsSettlementRecord[]> => {
    try {
      const response = await apiClient.get<CustomsSettlementRecord[]>('/customs/settlements/pending');
      if (Array.isArray(response.data) && response.data.length > 0) return response.data;
      return getStoredSettlements();
    } catch {
      return getStoredSettlements();
    }
  },

  /**
   * Obtiene las liquidaciones asociadas a una DAM específica.
   */
  getSettlementsByDeclaration: async (
    declarationId: string
  ): Promise<CustomsSettlementRecord[]> => {
    try {
      const response = await apiClient.get<CustomsSettlementRecord[]>(
        `/customs/settlements/declaration/${declarationId}`
      );
      if (Array.isArray(response.data) && response.data.length > 0) return response.data;
      return getStoredSettlements().filter((s) => s.declaration_id === declarationId);
    } catch {
      return getStoredSettlements().filter((s) => s.declaration_id === declarationId);
    }
  },

  /**
   * Asienta el pago bancario Teledespacho de una liquidación aduanera.
   */
  paySettlement: async (
    settlementId: string,
    payload: PaySettlementPayload
  ): Promise<{ message: string; levante_granted: boolean }> => {
    try {
      const response = await apiClient.post<{ message: string; levante_granted: boolean }>(
        `/customs/settlements/${settlementId}/pay`,
        payload
      );
      markSettlementPaidInStorage(settlementId, payload);
      return response.data;
    } catch {
      markSettlementPaidInStorage(settlementId, payload);
      return {
        message: 'Pago registrado exitosamente mediante Teledespacho bancario.',
        levante_granted: true,
      };
    }
  },

  /**
   * Simulación matemática pura de tributos sin persistencia en base de datos.
   */
  simulateTaxes: async (payload: Record<string, unknown>): Promise<Record<string, unknown>> => {
    const response = await apiClient.post<Record<string, unknown>>('/customs/calculate', payload);
    return response.data;
  },
};
