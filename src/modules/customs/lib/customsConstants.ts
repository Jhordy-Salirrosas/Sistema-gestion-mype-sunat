import { type RegisterDuaPayload } from '../types/customs.types';

/**
 * Catálogos de respaldo del formulario de importación.
 * La fuente principal es /api/v1/master-data; esto se usa si la API no responde.
 */
export const FALLBACK_INCOTERMS = [
  { code: 'FOB', name: 'Free on Board' },
  { code: 'CIF', name: 'Cost, Insurance & Freight' },
  { code: 'CFR', name: 'Cost and Freight' },
  { code: 'EXW', name: 'Ex Works' },
  { code: 'FCA', name: 'Free Carrier' },
  { code: 'DAP', name: 'Delivered at Place' },
  { code: 'CPT', name: 'Carriage Paid To' },
  { code: 'CIP', name: 'Carriage and Insurance Paid To' },
  { code: 'DPU', name: 'Delivered at Place Unloaded' },
  { code: 'DDP', name: 'Delivered Duty Paid' },
  { code: 'FAS', name: 'Free Alongside Ship' },
] as const;

export const FALLBACK_CURRENCIES = [
  { code: 'USD', name: 'Dólar', symbol: '$' },
  { code: 'EUR', name: 'Euro', symbol: '€' },
  { code: 'CNY', name: 'Yuan', symbol: '¥' },
  { code: 'PEN', name: 'Sol', symbol: 'S/' },
] as const;

export const INITIAL_DUA_FORM: RegisterDuaPayload = {
  dua_number: '',
  customs_agency_code: '118',
  regime_code: '10',
  numeration_date: new Date().toISOString().split('T')[0],
  exchange_rate: 3.8,
  fob_value_usd: 0,
  freight_value_usd: 0,
  insurance_value_usd: 0,
  ad_valorem_rate: 6,
  perception_rate: 3.5,
  items: [
    {
      item_order: 1,
      item_code: '',
      hs_code: '',
      commercial_description: '',
      quantity: 1,
      unit_code: 'NIU',
      fob_unit_usd: 0,
    },
  ],
};

export const DEMO_SUNAT_FORM: RegisterDuaPayload = {
  dua_number: '118-2026-10-001234',
  customs_agency_code: '118',
  regime_code: '10',
  numeration_date: '2026-10-15',
  exchange_rate: 3.8,
  fob_value_usd: 10000,
  freight_value_usd: 1500,
  insurance_value_usd: 500,
  ad_valorem_rate: 6,
  perception_rate: 3.5,
  items: [
    {
      item_order: 1,
      item_code: 'LAP-GAMER-01',
      hs_code: '8471300000',
      commercial_description: 'Laptop Gamer Intel Core i7 16GB RAM',
      quantity: 10,
      unit_code: 'NIU',
      fob_unit_usd: 600,
    },
    {
      item_order: 2,
      item_code: 'MON-LED-27',
      hs_code: '8528520000',
      commercial_description: 'Monitor LED 27 pulgadas Curvo 144Hz',
      quantity: 20,
      unit_code: 'NIU',
      fob_unit_usd: 200,
    },
  ],
};
