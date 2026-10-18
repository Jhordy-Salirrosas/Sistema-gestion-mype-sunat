export interface VuceEntityInfo {
  code: string;
  name: string;
  sector: string;
  documentTypes: string[];
}

export const VUCE_ENTITIES: Record<string, VuceEntityInfo> = {
  DIGESA: {
    code: 'DIGESA',
    name: 'Dirección General de Salud Ambiental e Inocuidad Alimentaria',
    sector: 'Alimentos procesados, bebidas, juguetes y desinfectantes',
    documentTypes: ['DR', 'SUCE', 'REG_SANITARIO'],
  },
  DIGEMID: {
    code: 'DIGEMID',
    name: 'Dirección General de Medicamentos, Insumos y Drogas',
    sector: 'Medicamentos, cosméticos, dispositivos médicos e higiene',
    documentTypes: ['DR', 'SUCE', 'NSO'],
  },
  SENASA: {
    code: 'SENASA',
    name: 'Servicio Nacional de Sanidad Agraria',
    sector: 'Vegetales, semillas, animales vivos, plaguicidas y fertilizantes',
    documentTypes: ['PFI', 'PVI', 'SUCE'],
  },
  SUCAMEC: {
    code: 'SUCAMEC',
    name: 'Superintendencia Nacional de Control de Servicios de Seguridad, Armas y Explosivos',
    sector: 'Armas, municiones, explosivos y artículos pirotécnicos',
    documentTypes: ['AUTORIZACION', 'SUCE'],
  },
  MTC: {
    code: 'MTC',
    name: 'Ministerio de Transportes y Comunicaciones',
    sector: 'Equipos transmisores de telecomunicaciones, Wi-Fi, Bluetooth y satelitales',
    documentTypes: ['PERMISO_INTERNAMIENTO', 'HOMOLOGACION', 'DR'],
  },
  PRODUCE: {
    code: 'PRODUCE',
    name: 'Ministerio de la Producción',
    sector: 'Sustancias que agotan la capa de ozono (SAO), alcohol etílico y pesca',
    documentTypes: ['AUTORIZACION', 'DR', 'SUCE'],
  },
  SANIPES: {
    code: 'SANIPES',
    name: 'Organismo Nacional de Sanidad Pesquera',
    sector: 'Recursos hidrobiológicos, pescados, mariscos y piensos para acuicultura',
    documentTypes: ['CERT_SANITARIO', 'SUCE'],
  },
};
