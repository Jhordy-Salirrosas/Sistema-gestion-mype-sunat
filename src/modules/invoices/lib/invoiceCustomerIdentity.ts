/** Invalida una selección, sin borrar la edición ni impedir la entrada manual. */
export function editarIdentidadCliente(actual: { documento: string; razonSocial: string; confirmado: boolean }, campo: 'documento' | 'nombre', texto: string) {
  return {
    documento: campo === 'documento' ? texto : actual.confirmado ? '' : actual.documento,
    razonSocial: campo === 'nombre' ? texto : actual.confirmado ? '' : actual.razonSocial,
  };
}
