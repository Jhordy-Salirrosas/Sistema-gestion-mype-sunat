import { apiClient } from '@/lib/axios';
import { type ForeignSupplierSummary, type CustomsBrokerSummary } from '../types';

export interface CustomsOfficeItem {
  code: string;
  name: string;
  is_active: boolean;
}

export interface BankItem {
  code: string;
  name: string;
}

export interface VuceEntityItem {
  code: string;
  name: string;
  sector: string;
}

export const CUSTOMS_OFFICES: CustomsOfficeItem[] = [
  { code: '118', name: 'Marítima del Callao', is_active: true },
  { code: '235', name: 'Aérea del Callao', is_active: true },
  { code: '370', name: 'Chancay', is_active: true },
  { code: '046', name: 'Paita', is_active: true },
  { code: '019', name: 'Tumbes', is_active: true },
  { code: '172', name: 'Ilo', is_active: true },
  { code: '181', name: 'Matarani (Mollendo)', is_active: true },
  { code: '217', name: 'Salaverry', is_active: true },
  { code: '127', name: 'Pisco', is_active: true },
  { code: '055', name: 'Chimbote', is_active: true },
  { code: '145', name: 'Iquitos', is_active: true },
  { code: '028', name: 'Tacna', is_active: true },
  { code: '082', name: 'Puno', is_active: true },
  { code: '091', name: 'Cusco', is_active: true },
  { code: '262', name: 'Desaguadero', is_active: true },
  { code: '280', name: 'Puerto Maldonado', is_active: true },
  { code: '299', name: 'Tarapoto', is_active: true },
];

export const AUTHORIZED_BANKS: BankItem[] = [
  { code: '002', name: 'Banco de Crédito del Perú (BCP)' },
  { code: '011', name: 'BBVA Perú' },
  { code: '003', name: 'Interbank' },
  { code: '009', name: 'Scotiabank Perú' },
  { code: '018', name: 'Banco de la Nación' },
];

export interface CountryItem {
  code: string;
  name: string;
  flag: string;
}

/** Catálogo oficial de países de origen SUNAT (Tabla 04 / Paises.txt) */
export const COUNTRIES: CountryItem[] = [
  { code: 'CN', name: 'China', flag: '🇨🇳' },
  { code: 'US', name: 'Estados Unidos', flag: '🇺🇸' },
  { code: 'DE', name: 'Alemania', flag: '🇩🇪' },
  { code: 'JP', name: 'Japón', flag: '🇯🇵' },
  { code: 'KR', name: 'Corea del Sur', flag: '🇰🇷' },
  { code: 'BR', name: 'Brasil', flag: '🇧🇷' },
  { code: 'ES', name: 'España', flag: '🇪🇸' },
  { code: 'IT', name: 'Italia', flag: '🇮🇹' },
  { code: 'IN', name: 'India', flag: '🇮🇳' },
  { code: 'MX', name: 'México', flag: '🇲🇽' },
  { code: 'CL', name: 'Chile', flag: '🇨🇱' },
  { code: 'CO', name: 'Colombia', flag: '🇨🇴' },
  { code: 'TW', name: 'Taiwán', flag: '🇹🇼' },
  { code: 'VN', name: 'Vietnam', flag: '🇻🇳' },
  { code: 'GB', name: 'Reino Unido', flag: '🇬🇧' },
  { code: 'CA', name: 'Canadá', flag: '🇨🇦' },
];

export const getStoredCountries = (): CountryItem[] => {
  try {
    const raw = typeof window !== 'undefined' ? localStorage.getItem('customs_countries_cache') : null;
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {
    // fallback seguro
  }
  return COUNTRIES;
};

export const saveStoredCountry = (country: CountryItem): CountryItem[] => {
  const current = getStoredCountries();
  const upperCode = country.code.toUpperCase().trim();
  const normalized = { ...country, code: upperCode };
  const updated = [normalized, ...current.filter((c) => c.code !== upperCode)];
  try {
    if (typeof window !== 'undefined') {
      localStorage.setItem('customs_countries_cache', JSON.stringify(updated));
    }
  } catch {
    // ignorar fallo de almacenamiento local
  }
  return updated;
};

export const FOREIGN_SUPPLIERS: ForeignSupplierSummary[] = [
  { id: 'a0000000-0000-0000-0000-000000000001', business_name: 'Shenzhen Tech Ltd. (China)', country_code: 'CN', tax_id: '91440300MA5' },
  { id: 'a0000000-0000-0000-0000-000000000002', business_name: 'Global Componentes Inc. (EE.UU.)', country_code: 'US', tax_id: 'US-98745612' },
  { id: 'a0000000-0000-0000-0000-000000000003', business_name: 'Hamburg Logistics GmbH (Alemania)', country_code: 'DE', tax_id: 'DE-849201' },
  { id: 'a0000000-0000-0000-0000-000000000004', business_name: 'Tokyo Electric Co. (Japón)', country_code: 'JP', tax_id: 'JP-11223344' },
];

export const getStoredSuppliers = (): ForeignSupplierSummary[] => {
  try {
    const raw = typeof window !== 'undefined' ? localStorage.getItem('customs_foreign_suppliers') : null;
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {
    // fallback seguro
  }
  return FOREIGN_SUPPLIERS;
};

export const saveStoredSupplier = (supplier: ForeignSupplierSummary): ForeignSupplierSummary[] => {
  const current = getStoredSuppliers();
  const updated = [supplier, ...current.filter((s) => s.id !== supplier.id)];
  try {
    if (typeof window !== 'undefined') {
      localStorage.setItem('customs_foreign_suppliers', JSON.stringify(updated));
    }
  } catch {
    // ignorar fallo de cuota localstorage
  }
  return updated;
};

export const VUCE_ENTITIES: VuceEntityItem[] = [
  { code: '08', name: 'MTC', sector: 'Telecomunicaciones e internamiento de equipos Wi-Fi' },
  { code: '03', name: 'DIGEMID', sector: 'Medicamentos, cosméticos y dispositivos médicos' },
  { code: '04', name: 'DIGESA', sector: 'Alimentos elaborados, bebidas y juguetes' },
  { code: '05', name: 'SENASA', sector: 'Sanidad agraria y pecuaria' },
  { code: '02', name: 'SUCAMEC', sector: 'Armas, municiones y explosivos' },
  { code: '17', name: 'PRODUCE', sector: 'Insumos químicos y productos industriales' },
  { code: '28', name: 'SANIPES', sector: 'Recursos hidrobiológicos y pesqueros' },
];

/**
 * Tabla de Porcentajes Promedio de Seguro (TPPS) de SUNAT por capítulo arancelario
 */
export const TPPS_BY_CHAPTER: Record<string, number> = {
  '84': 0.75, // Computadoras, reactores nucleares, calderas, aparatos mecánicos
  '85': 0.75, // Máquinas, aparatos y material eléctrico, telefonía
  '87': 1.00, // Vehículos automóviles, tractores
  '90': 0.75, // Instrumentos y aparatos de óptica, fotografía, médico-quirúrgicos
  '39': 1.50, // Materias plásticas y sus manufacturas
  '73': 1.50, // Manufacturas de fundición, hierro o acero
  DEFAULT: 1.50,
};

export const catalogsApi = {
  getCustomsOffices: () => CUSTOMS_OFFICES,
  getAuthorizedBanks: () => AUTHORIZED_BANKS,
  getVuceEntities: () => VUCE_ENTITIES,
  getTppsRate: (hsCode: string): number => {
    const chapter = hsCode.substring(0, 2);
    return TPPS_BY_CHAPTER[chapter] ?? TPPS_BY_CHAPTER.DEFAULT;
  },

  searchBrokers: async (query?: string): Promise<CustomsBrokerSummary[]> => {
    try {
      const response = await apiClient.get<CustomsBrokerSummary[]>('/customs/catalogs/brokers', {
        params: { q: query },
      });
      return Array.isArray(response.data) ? response.data : [];
    } catch {
      // Fallback local en caso de pruebas offline
      return [
        { id: 'b1', broker_code: '1188', business_name: 'Agencia Aduanera del Callao S.A.C.', mandate_active: true },
        { id: 'b2', broker_code: '2045', business_name: 'Despachos & Aduanas del Pacífico S.A.', mandate_active: true },
      ];
    }
  },

  getForeignSuppliers: async (): Promise<ForeignSupplierSummary[]> => {
    try {
      const response = await apiClient.get<ForeignSupplierSummary[]>('/customs/catalogs/suppliers');
      return Array.isArray(response.data) && response.data.length > 0 ? response.data : getStoredSuppliers();
    } catch {
      return getStoredSuppliers();
    }
  },
};
