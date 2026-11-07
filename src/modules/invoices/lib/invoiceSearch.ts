/**
 * Búsqueda reactiva de clientes y productos (TA-61).
 *
 * Emitir una factura exige identificar al cliente y a los productos. Escribir a
 * mano el RUC y el precio es la principal fuente de errores de digitación en una
 * factura de ferretería: un dígito de más en el RUC y el comprobante no existe
 * ante SUNAT.
 *
 * Este módulo es TypeScript puro —sin React ni red— para poder probar la lógica
 * de búsqueda y de debounce sin montar un componente:
 *
 *  - **Debounce:** no se consulta el backend en cada tecla. Se espera a que el
 *    usuario deje de escribir; sin esto, "CORPORACION" son once peticiones y las
 *    respuestas pueden llegar desordenadas.
 *  - **Prioridad del documento:** si lo escrito es un número de 8 u 11 dígitos,
 *    es un documento y se busca por documento, no por nombre. Es lo que el
 *    usuario espera al pegar un RUC.
 *  - **Mínimo de caracteres:** con una letra, la lista de coincidencias no cabe ni
 *    es útil.
 */

/** Cliente que ofrece el buscador. */
export interface ClienteBuscado {
  /** ID del maestro; ausente al escribir un cliente manualmente. */
  id?: string;
  tipoDocumento: string;
  numeroDocumento: string;
  razonSocial: string;
  direccion?: string;
}

/** Producto que ofrece el buscador. */
export interface ProductoBuscado {
  sku: string;
  descripcion: string;
  unidad: string;
  valorUnitario: number;
  /** Stock disponible, si se conoce; se muestra para no vender lo que no hay. */
  stock?: number;
}

/** Mínimo de caracteres para disparar una búsqueda por nombre. */
export const MINIMO_CARACTERES = 2;

/** Milisegundos de espera desde la última tecla. */
export const ESPERA_MS = 300;

/** ¿Lo escrito es solo dígitos? */
export const esSoloDigitos = (texto: string): boolean =>
  /^\d+$/.test(texto.trim());

/**
 * ¿Lo escrito es un documento de identidad completo? */
export const esDocumentoCompleto = (texto: string): boolean => {
  const limpio = texto.replace(/\D/g, '');
  // DNI de 8 dígitos o RUC de 11: el número de documento de SUNAT.
  return limpio.length === 8 || limpio.length === 11;
};

/** Tipo de documento que corresponde a un número por su longitud. */
export const tipoDocumentoDe = (texto: string): '1' | '6' =>
  texto.replace(/\D/g, '').length === 11 ? '6' : '1';

/**
 * ¿Vale la pena buscar?
 *
 * Un documento completo siempre; un texto parcial solo si llega al mínimo.
 */
export const debeBuscar = (texto: string): boolean => {
  const limpio = texto.trim();
  if (limpio.length === 0) return false;
  if (esDocumentoCompleto(limpio)) return true;
  return limpio.length >= MINIMO_CARACTERES;
};

/** Campos por los que se busca. */
export type CampoBusqueda = 'documento' | 'nombre' | 'ninguno';

/**
 * Decide por qué campo buscar según lo escrito.
 *
 * Basta con que el texto sea SOLO DÍGITOS para buscar por documento: al teclear
 * un RUC se espera ver los clientes que empiezan así, no los que contienen esos
 * números en el nombre. Exigir el documento completo obligaría a escribir los 11
 * dígitos de memoria antes de ver ninguna sugerencia.
 */
export const campoDeBusqueda = (texto: string): CampoBusqueda => {
  const limpio = texto.trim();
  if (!debeBuscar(limpio)) return 'ninguno';
  if (esSoloDigitos(limpio)) return 'documento';
  return 'nombre';
};

/**
 * Filtra clientes por el texto escrito.
 *
 * Se aplica sobre la lista que ya está en memoria: el backend no expone un
 * endpoint de búsqueda de clientes y añadirlo obligaría a crear el módulo. La
 * comparación ignora tildes y mayúsculas porque nadie escribe "PÉREZ" con
 * tilde al buscar.
 */
export const filtrarClientes = (
  clientes: readonly ClienteBuscado[],
  texto: string,
  limite = 8,
): readonly ClienteBuscado[] => {
  const campo = campoDeBusqueda(texto);
  if (campo === 'ninguno') return [];

  if (campo === 'documento') {
    const buscado = texto.replace(/\D/g, '');
    return clientes
      .filter((c) => c.numeroDocumento.replace(/\D/g, '').startsWith(buscado))
      .slice(0, limite);
  }

  const buscado = normalizar(texto);
  return clientes
    .filter((c) => normalizar(c.razonSocial).includes(buscado))
    .slice(0, limite);
};

/**
 * Filtra productos por SKU o descripción.
 *
 * El SKU tiene prioridad: si lo escrito coincide con el comienzo de un SKU, esos
 * resultados van primero. En una ferretería se busca "CEM" más a menudo que
 * "cemento".
 */
export const filtrarProductos = (
  productos: readonly ProductoBuscado[],
  texto: string,
  limite = 8,
): readonly ProductoBuscado[] => {
  const buscado = normalizar(texto.trim());
  if (buscado.length < MINIMO_CARACTERES) return [];

  const porSku = productos.filter((p) =>
    normalizar(p.sku).startsWith(buscado),
  );
  const porDescripcion = productos.filter(
    (p) =>
      !porSku.includes(p) && normalizar(p.descripcion).includes(buscado),
  );

  return [...porSku, ...porDescripcion].slice(0, limite);
};

/** Quita tildes y pasa a minúsculas para comparar. */
export const normalizar = (texto: string): string =>
  (texto ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();

/**
 * Envoltorio de debounce, sin dependencias.
 *
 * Devuelve la función envuelta y un método para cancelar la llamada pendiente:
 * sin `cancelar`, cambiar de pantalla con una búsqueda en vuelo actualiza el
 * estado de un componente que ya no existe.
 */
export const conDebounce = <T extends unknown[]>(
  fn: (...args: T) => void,
  espera = ESPERA_MS,
): { ejecutar: (...args: T) => void; cancelar: () => void } => {
  let temporizador: ReturnType<typeof setTimeout> | null = null;

  return {
    ejecutar: (...args: T) => {
      if (temporizador) clearTimeout(temporizador);
      temporizador = setTimeout(() => {
        temporizador = null;
        fn(...args);
      }, espera);
    },
    cancelar: () => {
      if (temporizador) clearTimeout(temporizador);
      temporizador = null;
    },
  };
};
