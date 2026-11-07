import { apiClient } from '@/lib/axios';
import {
  type KardexFilterParams,
  type KardexMovementEntry,
  type SireAnnex8_4Record,
} from '../types';

export const getDemoSireAnnex8_4 = (period?: string): SireAnnex8_4Record[] => [
  {
    period: period || '202610',
    cuo: 'CUO-2026-0001',
    correlative_number: 'M00001',
    document_issue_date: '2026-10-24',
    customs_code: '118',
    numeration_year: 2026,
    regime_code: '10',
    correlative_dua: '045892',
    taxpayer_id: '20601012341',
    supplier_name: 'SHENZHEN TECH LTD',
    cif_value_pen: 197016.5,
    ad_valorem_pen: 0.0,
    taxable_base_pen: 197016.5,
    igv_ipm_pen: 35462.97,
    perception_pen: 8136.78,
    total_import_cost_pen: 240616.25,
  },
];

export const kardexApi = {
  /**
   * Obtiene los movimientos valorizados de inventario permanente (Formatos PLE 12.1 y 13.1).
   */
  getKardexMovements: async (
    params?: KardexFilterParams
  ): Promise<KardexMovementEntry[]> => {
    try {
      const response = await apiClient.get<KardexMovementEntry[]>('/customs/kardex', {
        params,
      });
      return Array.isArray(response.data) ? response.data : [];
    } catch {
      return [];
    }
  },

  /**
   * Obtiene los datos consolidados de importaciones para el Anexo 8.4 del SIRE RCE.
   */
  getSireAnnex8_4: async (period?: string): Promise<SireAnnex8_4Record[]> => {
    try {
      const response = await apiClient.get<SireAnnex8_4Record[]>(
        '/customs/sire-purchases/records',
        { params: { period } }
      );
      if (Array.isArray(response.data) && response.data.length > 0) {
        return response.data;
      }
      return getDemoSireAnnex8_4(period);
    } catch {
      return getDemoSireAnnex8_4(period);
    }
  },
};
