/** Configuración explícita y ficticia de series para los formularios. */
export const seriesConfiguradasPrueba = ['01', '03', '07', '08'].flatMap(tipo =>
  (tipo === '03' ? ['B001'] : tipo === '01' ? ['F001'] : ['F001', 'B001'])
    .map(serie => ({ document_type: tipo, series: serie, is_active: true })),
);
