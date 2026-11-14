import { cantidadValidaParaUnidad, unidadDiscreta, type ItemBorrador } from './invoiceItems';

/** Errores de los campos editables; comparte las restricciones de emisión. */
export function erroresCamposLinea(item: ItemBorrador, esNota: boolean) {
  return {
    descripcion: !item.descripcion.trim() ? 'La descripción es obligatoria.' : Array.from(item.descripcion).length > 500 ? 'La descripción admite como máximo 500 caracteres.' : '',
    cantidad: cantidadValidaParaUnidad(item.cantidad, item.unidad, esNota) ? '' : !esNota && unidadDiscreta(item.unidad) ? 'La cantidad debe ser entera y positiva para esta unidad.' : 'La cantidad debe ser positiva y tener como máximo 3 decimales.',
    valorUnitario: Number.isFinite(item.valorUnitario) && (esNota && item.afectacion !== 'GRATUITA' ? item.valorUnitario >= 0 : item.valorUnitario > 0)
      ? '' : item.afectacion === 'GRATUITA' ? 'Una línea gratuita debe declarar su valor referencial.' : 'El valor unitario de una línea onerosa debe ser mayor que cero.',
  };
}
