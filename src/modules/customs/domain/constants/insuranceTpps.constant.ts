/**
 * Tabla de Porcentajes Promedio de Seguro (TPPS) de SUNAT
 * Base legal: Decisión 571 de la Comunidad Andina / Procedimiento DESPA-PE.01.10a
 * Aplicable supletoriamente cuando el importador no contrata una póliza efectiva de seguro.
 */
export const SUNAT_INSURANCE_TPPS_BY_CHAPTER: Record<string, number> = {
  // Capítulos 01 al 24: Productos agrícolas, animales vivos, alimentos
  '01': 2.0,
  '02': 2.0,
  '03': 2.0,
  '04': 1.75,
  '07': 2.0,
  '08': 2.0,
  '09': 1.5,
  '10': 1.5,
  '12': 1.5,
  '15': 1.5,
  '16': 1.5,
  '21': 1.5,
  '22': 1.5,

  // Capítulos 28 al 38: Productos químicos, farmacéuticos y abonos
  '28': 1.75,
  '29': 1.75,
  '30': 1.5, // Medicamentos
  '31': 1.75, // Fertilizantes
  '39': 1.5, // Plásticos

  // Capítulos 50 al 63: Textiles, hilados y confecciones
  '52': 1.5,
  '54': 1.5,
  '61': 1.5,
  '62': 1.5,
  '64': 1.5, // Calzado

  // Capítulos 72 al 83: Metales comunes y manufacturas
  '72': 1.25, // Fundición, hierro y acero
  '73': 1.25,
  '76': 1.25, // Aluminio

  // Capítulos 84 y 85: Maquinaria, computadoras, tecnología y electrónica
  '84': 0.75, // Reactores nucleares, calderas, computadoras (Laptops 8471)
  '85': 0.75, // Máquinas eléctricas, teléfonos, telecomunicaciones

  // Capítulo 87: Vehículos automóviles, tractores y repuestos
  '87': 1.25,

  // Capítulos 90 al 96: Instrumentos ópticos, médicos y manufacturas diversas
  '90': 1.0, // Instrumentos médicos y de precisión
  '94': 1.5, // Muebles
  '95': 1.5, // Juguetes
};

export const DEFAULT_SUNAT_INSURANCE_TPPS_RATE = 1.5;

/**
 * Obtiene la tasa de seguro teórico TPPS en función de la subpartida nacional o capítulo
 * @param hsCode Subpartida nacional (mínimo 2 dígitos para el capítulo)
 * @returns Porcentaje de seguro (ej. 0.75 para computadoras, 1.25 para vehículos)
 */
export function getTppsInsuranceRate(hsCode?: string): number {
  if (!hsCode || hsCode.length < 2) {
    return DEFAULT_SUNAT_INSURANCE_TPPS_RATE;
  }
  const chapter = hsCode.substring(0, 2);
  return SUNAT_INSURANCE_TPPS_BY_CHAPTER[chapter] ?? DEFAULT_SUNAT_INSURANCE_TPPS_RATE;
}
