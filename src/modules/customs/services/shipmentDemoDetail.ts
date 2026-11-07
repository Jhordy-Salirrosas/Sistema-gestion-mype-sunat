import {
  type CustomsShipmentDetail,
  type CustomsDocumentRecord,
  type CustomsEventRecord,
} from '../types';
import { DEFAULT_DEMO_SHIPMENT, getStoredCustomsShipments } from './customsShipmentsApi';

export const getDemoShipmentDetail = (id: string): CustomsShipmentDetail => {
  const cachedList = getStoredCustomsShipments();
  const summary =
    cachedList.find((s) => s.id === id || s.shipment_number === id) || DEFAULT_DEMO_SHIPMENT;

  const demoDocuments: CustomsDocumentRecord[] = [
    {
      id: 'doc-1',
      shipment_id: summary.id,
      document_type: 'FAC',
      document_number: 'INV-2026-SHENZHEN-884',
      issue_date: '2026-10-12',
      issuer_name: 'Shenzhen Tech Ltd.',
      is_validated: true,
      created_at: '2026-10-15T08:00:00Z',
    },
    {
      id: 'doc-2',
      shipment_id: summary.id,
      document_type: 'TRA',
      document_number: 'MAEU-2026-8812',
      issue_date: '2026-10-15',
      issuer_name: 'Maersk Line Perú S.A.',
      is_validated: true,
      created_at: '2026-10-15T10:00:00Z',
    },
    {
      id: 'doc-3',
      shipment_id: summary.id,
      document_type: 'CRO',
      document_number: 'CO-CN-2026-0941',
      issue_date: '2026-10-14',
      issuer_name: 'CCPIT China',
      is_validated: true,
      created_at: '2026-10-15T12:00:00Z',
    },
  ];

  const demoEvents: CustomsEventRecord[] = [
    {
      id: 'ev-1',
      shipment_id: summary.id,
      event_type: 'EMBARQUE',
      event_timestamp: '2026-10-15T14:30:00Z',
      event_value: 'Zarpe en Puerto de Ningbo, China',
      registered_by: 'Operador Logístico',
      created_at: '2026-10-15T14:30:00Z',
    },
    {
      id: 'ev-2',
      shipment_id: summary.id,
      event_type: 'NUMERACION_DAM',
      event_timestamp: '2026-10-26T09:15:00Z',
      event_value: 'DAM 118-2026-10-00042 numerada (Despacho Anticipado 01)',
      registered_by: 'Agencia Aduanera del Callao',
      created_at: '2026-10-26T09:15:00Z',
    },
    {
      id: 'ev-3',
      shipment_id: summary.id,
      event_type: 'CANAL_ASIGNADO',
      event_timestamp: '2026-10-28T16:00:00Z',
      event_value: 'Canal Verde asignado por SUNAT (Levante Automático)',
      registered_by: 'SUNAT Aduanas',
      created_at: '2026-10-28T16:00:00Z',
    },
  ];

  return {
    id: summary.id,
    company_id: 'demo-company',
    shipment_number: summary.shipment_number,
    supplier_id: summary.supplier_id,
    supplier_name: summary.supplier_name || 'Shenzhen Tech Ltd (China)',
    incoterm: summary.incoterm,
    currency_code: summary.currency_code || 'USD',
    status: summary.status === 'EN_TRANSITO' ? 'CON_LEVANTE' : summary.status,
    eta_date: summary.eta_date || '2026-10-31',
    etd_date: summary.etd_date || '2026-10-15',
    transport_mode: summary.transport_mode,
    origin_country_code: summary.origin_country_code,
    destination_customs: summary.destination_customs || '118 - Marítima del Callao',
    order_reference: 'ORD-2026-00042 (100 Laptops Gaming)',
    is_observed: false,
    created_at: summary.created_at || '2026-10-20T10:00:00Z',
    updated_at: summary.updated_at || '2026-10-20T10:00:00Z',
    supplier: {
      id: summary.supplier_id,
      business_name: summary.supplier_name || 'Shenzhen Tech Ltd.',
      country_code: summary.origin_country_code || 'CN',
      tax_id: '91440300MA5',
    },
    customs_broker: {
      id: 'b1',
      broker_code: '1188',
      business_name: 'Agencia Aduanera del Callao S.A.C.',
      mandate_active: true,
    },
    documents: demoDocuments,
    events: demoEvents,
    declarations: [
      {
        id: 'dec-1',
        shipment_id: summary.id,
        declaration_number: '118-2026-10-00042',
        dua_number: '118-2026-10-00042',
        customs_office_code: '118',
        regime_code: '10',
        channel: 'VERDE',
        clearance_status: 'NUMERADA',
        fob_value_usd: 50000,
        cif_value_usd: 51575,
        total_taxes_pen: 35462.97,
        items: [
          {
            id: 'it-1',
            declaration_id: 'dec-1',
            item_order: 1,
            hs_code: '8471.30.00.00',
            product_code: 'LAP-001',
            commercial_description: 'Laptop Gaming 15.6" Core i7 16GB SSD 1TB',
            quantity: 100,
            physical_quantity: 100,
            unit_code: 'NIU',
            physical_unit: 'NIU',
            fob_unit_usd: 500,
            fob_total_usd: 50000,
            cif_usd: 51575,
            cif_pen: 197016.5,
            allocated_cif_pen: 197016.5,
            allocated_duties_pen: 0,
            ad_valorem_rate: 0,
            landed_cost_unit_pen: 2078.925,
            final_landed_cost_unit_pen: 2078.925,
          },
        ],
      } as any,
    ],
  };
};

