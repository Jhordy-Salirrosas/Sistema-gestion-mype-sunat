import { apiClient } from '@/lib/axios';

export interface CurrencyRecord {
  code: string;
  name: string;
  symbol: string;
  decimals: number;
  is_active: boolean;
}

export interface ExchangeRateRecord {
  id: string;
  base_currency: string;
  quote_currency: string;
  rate: string | number;
  date: string;
  source: string;
}

export interface IncotermRecord {
  code: string;
  name: string;
  version: string;
  named_place_required: boolean;
  is_active: boolean;
}

export interface CountryRecord {
  code: string;
  name: string;
  status: string;
}

export interface PortRecord {
  code: string;
  name: string;
  country_code: string;
  type: string;
  status: string;
}

export interface DocumentTypeRecord {
  code: string;
  name: string;
  stage: string;
  is_required: boolean;
  allowed_formats: string[];
  is_active: boolean;
}

export type PartnerRole =
  | 'CLIENTE'
  | 'PROVEEDOR'
  | 'IMPORTADOR'
  | 'AGENTE'
  | 'ASEGURADORA'
  | 'TRANSPORTISTA';

export interface BusinessPartnerRecord {
  primary_contact?: PartnerContactRecord | null;
  primary_address?: PartnerAddressRecord | null;
  id: string;
  company_id: string;
  doc_type: string;
  doc_number: string;
  legal_name: string;
  trade_name?: string | null;
  country_code: string;
  address?: string | null;
  email?: string | null;
  phone?: string | null;
  website?: string | null;
  roles: PartnerRole[];
  payment_terms?: string | null;
  has_credit?: boolean | null;
  allows_discount?: boolean | null;
  credit_limit?: string | number | null;
  currency_code?: string | null;
  is_active: boolean;
}

export interface PartnerAddressRecord {
  id: string;
  label: string;
  address: string;
  city?: string | null;
  state?: string | null;
  country_code: string;
  postal_code?: string | null;
  is_default: boolean;
}

export interface PartnerContactRecord {
  id: string;
  name: string;
  position?: string | null;
  email?: string | null;
  phone?: string | null;
  is_primary: boolean;
}

export interface PartnerBankAccountRecord {
  id: string;
  bank_name: string;
  bank_country: string;
  account_number: string;
  cci?: string | null;
  swift?: string | null;
  iban?: string | null;
  beneficiary?: string | null;
  currency_code: string;
  is_default: boolean;
}

export interface PartnerDetailRecord extends BusinessPartnerRecord {
  addresses: PartnerAddressRecord[];
  contacts: PartnerContactRecord[];
  bank_accounts: PartnerBankAccountRecord[];
}

export interface AccountingMappingRecord {
  id: string;
  company_id: string;
  process_code: string;
  role_code: string;
  account_code: string;
  is_active: boolean;
}

const BASE = '/master-data';

export const masterDataApi = {
  // Monedas
  getCurrencies: async (): Promise<CurrencyRecord[]> => {
    const { data } = await apiClient.get<CurrencyRecord[]>(`${BASE}/currencies`);
    return data;
  },
  upsertCurrency: async (payload: Partial<CurrencyRecord> & { code: string }) => {
    const { data } = await apiClient.put<CurrencyRecord>(`${BASE}/currencies`, payload);
    return data;
  },
  deleteCurrency: async (code: string) => {
    await apiClient.delete(`${BASE}/currencies/${code}`);
  },

  // Tipos de cambio
  getExchangeRates: async (): Promise<ExchangeRateRecord[]> => {
    const { data } = await apiClient.get<ExchangeRateRecord[]>(`${BASE}/exchange-rates`);
    return data;
  },
  createExchangeRate: async (payload: {
    baseCurrency: string;
    quoteCurrency: string;
    rate: number;
    date: string;
    source?: string;
  }) => {
    const { data } = await apiClient.post<ExchangeRateRecord>(
      `${BASE}/exchange-rates`,
      payload,
    );
    return data;
  },
  deleteExchangeRate: async (id: string) => {
    await apiClient.delete(`${BASE}/exchange-rates/${id}`);
  },
  updateExchangeRate: async (id: string, payload: { rate: number; source?: string }) => {
    const { data } = await apiClient.put<ExchangeRateRecord>(
      `${BASE}/exchange-rates/${id}`,
      payload,
    );
    return data;
  },
  syncTodayExchangeRate: async (): Promise<ExchangeRateRecord> => {
    const { data } = await apiClient.post<ExchangeRateRecord>(
      `${BASE}/exchange-rates/sync-today`,
    );
    return data;
  },

  // Países
  getCountries: async (): Promise<CountryRecord[]> => {
    const { data } = await apiClient.get<CountryRecord[]>(`${BASE}/countries`);
    return data;
  },
  upsertCountry: async (payload: { code: string; name: string; status?: string }) => {
    const { data } = await apiClient.put<CountryRecord>(`${BASE}/countries`, payload);
    return data;
  },
  deleteCountry: async (code: string) => {
    await apiClient.delete(`${BASE}/countries/${code}`);
  },

  // Puertos
  getPorts: async (type?: string): Promise<PortRecord[]> => {
    const { data } = await apiClient.get<PortRecord[]>(`${BASE}/ports`, {
      params: type ? { type } : undefined,
    });
    return data;
  },
  upsertPort: async (payload: {
    code: string;
    name: string;
    countryCode?: string;
    type?: string;
    status?: string;
  }) => {
    const { data } = await apiClient.put<PortRecord>(`${BASE}/ports`, payload);
    return data;
  },
  deletePort: async (code: string) => {
    await apiClient.delete(`${BASE}/ports/${code}`);
  },

  // Incoterms
  getIncoterms: async (): Promise<IncotermRecord[]> => {
    const { data } = await apiClient.get<IncotermRecord[]>(`${BASE}/incoterms`);
    return data;
  },
  upsertIncoterm: async (payload: Partial<IncotermRecord> & { code: string }) => {
    const { data } = await apiClient.put<IncotermRecord>(`${BASE}/incoterms`, payload);
    return data;
  },
  deleteIncoterm: async (code: string) => {
    await apiClient.delete(`${BASE}/incoterms/${code}`);
  },

  // Documentos
  getDocumentTypes: async (): Promise<DocumentTypeRecord[]> => {
    const { data } = await apiClient.get<DocumentTypeRecord[]>(
      `${BASE}/document-types`,
    );
    return data;
  },
  upsertDocumentType: async (payload: {
    code: string;
    name: string;
    stage?: string;
    isRequired?: boolean;
    isActive?: boolean;
  }) => {
    const { data } = await apiClient.put<DocumentTypeRecord>(
      `${BASE}/document-types`,
      payload,
    );
    return data;
  },
  deleteDocumentType: async (code: string) => {
    await apiClient.delete(`${BASE}/document-types/${code}`);
  },

  // Terceros
  getPartners: async (params?: { role?: string; q?: string }) => {
    const { data } = await apiClient.get<BusinessPartnerRecord[]>(
      `${BASE}/partners`,
      { params },
    );
    return data;
  },
  getPartner: async (id: string): Promise<PartnerDetailRecord> => {
    const { data } = await apiClient.get<PartnerDetailRecord>(
      `${BASE}/partners/${id}`,
    );
    return data;
  },
  createPartner: async (payload: Record<string, unknown>) => {
    const { data } = await apiClient.post<BusinessPartnerRecord>(
      `${BASE}/partners`,
      payload,
    );
    return data;
  },
  updatePartner: async (id: string, payload: Record<string, unknown>) => {
    const { data } = await apiClient.put<BusinessPartnerRecord>(
      `${BASE}/partners/${id}`,
      payload,
    );
    return data;
  },
  deletePartner: async (id: string) => {
    await apiClient.delete(`${BASE}/partners/${id}`);
  },
  updatePartnerRecord: async (partnerId: string, kind: string, id: string, payload: Record<string, unknown>) =>
    (await apiClient.put(`/master-data/partners/${partnerId}/${kind}/${id}`, payload)).data,
  deletePartnerRecord: async (partnerId: string, kind: string, id: string) =>
    (await apiClient.delete(`/master-data/partners/${partnerId}/${kind}/${id}`)).data,
  addAddress: async (partnerId: string, payload: Record<string, unknown>) => {
    const { data } = await apiClient.post<PartnerAddressRecord>(
      `${BASE}/partners/${partnerId}/addresses`,
      payload,
    );
    return data;
  },
  addContact: async (partnerId: string, payload: Record<string, unknown>) => {
    const { data } = await apiClient.post<PartnerContactRecord>(
      `${BASE}/partners/${partnerId}/contacts`,
      payload,
    );
    return data;
  },
  addBankAccount: async (partnerId: string, payload: Record<string, unknown>) => {
    const { data } = await apiClient.post<PartnerBankAccountRecord>(
      `${BASE}/partners/${partnerId}/bank-accounts`,
      payload,
    );
    return data;
  },

  // Mapeo contable
  getAccountingMappings: async (): Promise<AccountingMappingRecord[]> => {
    const { data } = await apiClient.get<AccountingMappingRecord[]>(
      `${BASE}/accounting-mappings`,
    );
    return data;
  },
  upsertAccountingMapping: async (payload: {
    processCode: string;
    roleCode: string;
    accountCode: string;
    isActive?: boolean;
  }) => {
    const { data } = await apiClient.put<AccountingMappingRecord>(
      `${BASE}/accounting-mappings`,
      payload,
    );
    return data;
  },
};
