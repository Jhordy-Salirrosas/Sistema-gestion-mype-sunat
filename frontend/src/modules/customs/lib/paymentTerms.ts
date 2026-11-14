const ETIQUETAS: Readonly<Record<string, string>> = {
  CONTADO: 'Contado',
  '15_DIAS': '15 días',
  '30_DIAS': '30 días',
  '45_DIAS': '45 días',
  '60_DIAS': '60 días',
  CARTA_CREDITO: 'Carta de crédito',
};

/** Conserva los términos personalizados y solo traduce los códigos conocidos. */
export const etiquetaCondicionPago = (valor?: string | null, vacio = '—'): string =>
  valor ? Object.hasOwn(ETIQUETAS, valor) ? ETIQUETAS[valor] : valor : vacio;
