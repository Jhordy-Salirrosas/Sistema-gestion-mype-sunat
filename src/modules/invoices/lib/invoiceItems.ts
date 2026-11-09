/**
 * Ítems del detalle de un comprobante: modelo, cálculos y validación (TA-64).
 *
 * El formulario de emisión pasó de UN monto base a una grilla de líneas. Este
 * módulo es TypeScript puro —sin React ni red— para poder probar las reglas
 * sin montar el componente:
 *
 *  - **Catálogo 03**: la unidad de medida de cada línea debe pertenecer al
 *    catálogo de SUNAT. Enviar `UND` o `UNIDAD` en lugar de `NIU` produce un
 *    rechazo del XML.
 *  - **Catálogo 07**: cada línea declara su propia afectación, así que la
 *    liquidación por afectación sale de la grilla y no de un campo único.
 *  - **ICBPER**: la bolsa plástica es una línea más, con precio unitario 0 y
 *    su propio importe (regla 3306 de la hoja oficial).
 *  - **Gratuitas**: una línea gratuita no cobra, así que se excluye del total
 *    aunque tenga valor referencial (regla 3278).
 */
import {
  ICBPER_POR_UNIDAD,
  baseDesdeTotal,
  calcularLinea,
  round2,
  type AfectacionIgv,
  type LineaComprobante,
} from './invoiceTaxes';

/** Unidad de medida del Catálogo 03 que se ofrece en la grilla. */
export interface UnidadMedida {
  codigo: string;
  descripcion: string;
}

/**
 * Subconjunto del Catálogo 03 para una ferretería.
 *
 * No se listan las ~90 unidades del catálogo completo porque el formulario se
 * usa con guantes: se ofrecen las que aplican al rubro y el resto entra por la
 * API. NIU es la unidad por defecto y la única válida para servicios.
 */
export const UNIDADES_MEDIDA: readonly UnidadMedida[] = [
  { codigo: 'NIU', descripcion: 'Unidad (bienes y servicios)' },
  { codigo: 'BG', descripcion: 'Bolsa' },
  { codigo: 'BX', descripcion: 'Caja' },
  { codigo: 'DZN', descripcion: 'Docena' },
  { codigo: 'CEN', descripcion: 'Ciento' },
  { codigo: 'MIL', descripcion: 'Millar' },
  { codigo: 'KGM', descripcion: 'Kilogramo' },
  { codigo: 'MTR', descripcion: 'Metro' },
  { codigo: 'TNE', descripcion: 'Tonelada' },
  { codigo: 'LTR', descripcion: 'Litro' },
] as const;

/** ¿La unidad pertenece al Catálogo 03 que admite la grilla? */
export const unidadValida = (codigo: string): boolean =>
  UNIDADES_MEDIDA.some((u) => u.codigo === codigo.trim().toUpperCase());

/** Línea editable de la grilla de detalle. */
export interface ItemBorrador {
  /** Clave estable para React; no viaja al XML. */
  clave: string;
  codigo: string;
  descripcion: string;
  unidad: string;
  cantidad: number;
  valorUnitario: number;
  /** Precio unitario final CON IGV incluido digitado en la venta. */
  precioUnitario?: number;
  afectacion: AfectacionIgv;
  /** True cuando la afectación proviene del producto elegido y no es editable como campo libre. */
  afectacionHeredada?: boolean;
  codigoAfectacion?: string;
  /** True cuando la unidad proviene del producto y no debe editarse en la venta. */
  unidadHeredada?: boolean;
  descuento?: { codigo: '00' | '01'; monto: number } | null;
  /** Importe del ICBPER de la línea; > 0 la marca como bolsa plástica. */
  icbper: number;
  /**
   * Código del Catálogo 54 si el BIEN o SERVICIO de esta línea está sujeto a
   * detracción.
   *
   * Vive en la línea y no en la cabecera porque —como dijo el docente— "esto lo
   * manda el producto, no la factura". Una factura de ferretería con un flete
   * dentro debe detraer solo el flete.
   */
  codigoDetraccion?: string;
}

/** Importes derivados de una línea. */
export interface TotalesItem {
  /** Valor de venta sin IGV; cero si la línea es gratuita. */
  base: number;
  igv: number;
  icbper: number;
  /** Importe que el cliente paga por la línea. */
  total: number;
}

/**
 * Calcula los importes de una línea.
 *
 * Las cantidades y los valores no finitos se tratan como cero en lugar de
 * propagar `NaN`: un `NaN` dentro de un `<cbc:Amount>` rompe el XML entero y el
 * usuario no sabría qué línea lo causó.
 */
/**
 * Deriva el valor unitario sin IGV a partir del precio unitario final con IGV incluido.
 * En operaciones gravadas desglosa el 18 %; en exoneradas e inafectas coincide con el precio.
 */
export const valorUnitarioDesdePrecioConIgv = (
  precioConIgv: number,
  afectacion: AfectacionIgv = 'GRAVADA',
): number => {
  if (!Number.isFinite(precioConIgv) || precioConIgv <= 0) return 0;
  return afectacion === 'GRAVADA' ? baseDesdeTotal(precioConIgv) : round2(precioConIgv);
};

export const calcularItem = (item: ItemBorrador): TotalesItem => {
  const cantidad = Number.isFinite(item.cantidad) ? Math.max(0, item.cantidad) : 0;
  const tienePrecioConIgv =
    typeof item.precioUnitario === 'number' && Number.isFinite(item.precioUnitario);
  const precioFinalUnitario = tienePrecioConIgv
    ? Math.max(0, item.precioUnitario!)
    : 0;
  const valor = tienePrecioConIgv
    ? valorUnitarioDesdePrecioConIgv(precioFinalUnitario, item.afectacion)
    : Number.isFinite(item.valorUnitario)
      ? Math.max(0, item.valorUnitario)
      : 0;

  const totalBrutoConIgv = tienePrecioConIgv
    ? round2(cantidad * precioFinalUnitario)
    : null;
  const baseBruta =
    tienePrecioConIgv && item.afectacion === 'GRAVADA'
      ? baseDesdeTotal(totalBrutoConIgv!)
      : round2(cantidad * valor);

  const linea = calcularLinea({
    base: round2(Math.max(0, baseBruta - (item.descuento?.codigo === '00' ? item.descuento.monto : 0))),
    afectacion: item.afectacion,
  });

  // Regla 3278: la gratuita se declara en cero aunque tenga valor referencial.
  const esGratuita = item.afectacion === 'GRATUITA';
  const base = esGratuita ? 0 : linea.base;
  const sinDescuentoAfecto = !item.descuento || item.descuento.codigo !== '00';
  const igv = esGratuita
    ? 0
    : tienePrecioConIgv && item.afectacion === 'GRAVADA' && sinDescuentoAfecto
      ? round2(totalBrutoConIgv! - base)
      : linea.igv;
  const icbper = Number.isFinite(item.icbper) ? Math.max(0, item.icbper) : 0;

  return { base, igv, icbper, total: round2(base + igv + icbper - (item.descuento?.codigo === '01' ? item.descuento.monto : 0)) };
};

/** Total de una grilla de líneas. */
export interface TotalesGrilla {
  base: number;
  igv: number;
  icbper: number;
  total: number;
  /** Cuántas líneas trae el comprobante (incluidas gratuitas). */
  lineas: number;
}

/** Suma los importes de todas las líneas de la grilla. */
export const totalizarItems = (
  items: readonly ItemBorrador[],
): TotalesGrilla => {
  const acumulado = items.reduce(
    (acc, item) => {
      const t = calcularItem(item);
      return {
        base: acc.base + t.base,
        igv: acc.igv + t.igv,
        icbper: acc.icbper + t.icbper,
        total: acc.total + t.total,
      };
    },
    { base: 0, igv: 0, icbper: 0, total: 0 },
  );

  const base = round2(acumulado.base);
  const igv = round2(acumulado.igv);
  const icbper = round2(acumulado.icbper);

  return {
    base,
    igv,
    icbper,
    total: round2(acumulado.total),
    lineas: items.length,
  };
};

/** Convierte las líneas de la grilla al contrato del motor tributario. */
export const itemsALiquidar = (
  items: readonly ItemBorrador[],
): readonly LineaComprobante[] =>
  items.map((item) => {
    const total = calcularItem(item);
    return {
      base: total.base,
      afectacion: item.afectacion,
    };
  });

/** Motivo por el que una línea todavía no puede emitirse. */
export interface ErrorItem {
  /** Índice 0-based dentro de la grilla. */
  indice: number;
  motivos: readonly string[];
}

/**
 * Valida la grilla completa y devuelve los errores por línea.
 *
 * Se devuelven TODOS los errores y no el primero: con diez líneas, corregir de
 * una en una obliga a diez intentos de emisión.
 */
export const validarItems = (
  items: readonly ItemBorrador[],
): readonly ErrorItem[] => {
  if (items.length === 0) {
    return [{ indice: -1, motivos: ['El comprobante necesita al menos un ítem.'] }];
  }

  const errores: ErrorItem[] = [];

  items.forEach((item, indice) => {
    const motivos: string[] = [];

    if (!item.descripcion.trim()) {
      motivos.push('La descripción es obligatoria.');
    }
    if (!unidadValida(item.unidad)) {
      motivos.push(
        `La unidad '${item.unidad}' no pertenece al Catálogo 03 ` +
          `(se aceptan ${UNIDADES_MEDIDA.map((u) => u.codigo).join(', ')}).`,
      );
    }
    if (!Number.isFinite(item.cantidad) || item.cantidad <= 0) {
      motivos.push('La cantidad debe ser mayor que cero.');
    }
    if (!Number.isFinite(item.valorUnitario) || item.valorUnitario < 0) {
      motivos.push('El valor unitario no puede ser negativo.');
    }
    if (item.descuento && (!Number.isFinite(item.descuento.monto) || item.descuento.monto <= 0 || round2(item.descuento.monto) !== item.descuento.monto || item.descuento.monto > item.cantidad * item.valorUnitario || item.afectacion === 'GRATUITA')) {
      motivos.push('El descuento debe ser positivo, no exceder el valor de la línea y no aplicarse a una línea gratuita.');
    }
    // Una línea gratuita con valor cero no informa nada; una onerosa en cero
    // pasa, porque puede ser un bien de cortesía declarado como exonerado.
    if (
      item.afectacion === 'GRATUITA' &&
      (!Number.isFinite(item.valorUnitario) || item.valorUnitario <= 0) &&
      item.icbper === 0
    ) {
      motivos.push('Una línea gratuita debe declarar su valor referencial.');
    }

    if (motivos.length > 0) errores.push({ indice, motivos });
  });

  return errores;
};

/** Nueva línea vacía con la unidad y la afectación por defecto. */
export const itemVacio = (clave: string): ItemBorrador => ({
  clave,
  codigo: '',
  descripcion: '',
  unidad: 'NIU',
  cantidad: 1,
  valorUnitario: 0,
  afectacion: 'GRAVADA',
  icbper: 0,
});

/** Conserva el código fiscal por separado de la categoría usada para presentar totales.
 * Un catálogo incompleto o incompatible bloquea la selección con causa explícita. */
export const normalizarAfectacionProducto = (
  afectacion?: string | null,
): AfectacionIgv => {
  const limpio = (afectacion ?? '').trim().toUpperCase();
  if (['10', 'GRAVADA'].includes(limpio)) return 'GRAVADA';
  if (['20', 'EXONERADA'].includes(limpio)) return 'EXONERADA';
  if (['30', '40', 'INAFECTA'].includes(limpio)) return 'INAFECTA';
  if (['11', '12', '13', '14', '15', '16', '21', '31', '32', '33', '34', '35', '36', '37', 'GRATUITA'].includes(limpio)) return 'GRATUITA';
  throw new Error('Producto sin afectación tributaria compatible: configure el código real del Catálogo 07.');
};

export const itemDesdeProducto = (
  producto: {
    sku: string;
    descripcion: string;
    unidad: string;
    valorUnitario: number;
    afectacion?: string | null;
  },
  clave: string,
): ItemBorrador => {
  const unidad = producto.unidad.trim().toUpperCase();
  if (!unidadValida(unidad)) throw new Error(`Unidad del producto no compatible: ${unidad || 'sin configurar'}. Corrija el catálogo; no se presume NIU.`);
  const valor = Number(producto.valorUnitario);
  const afectacion = normalizarAfectacionProducto(producto.afectacion);

  return {
    clave,
    codigo: producto.sku,
    descripcion: producto.descripcion,
    unidad,
    cantidad: 1,
    valorUnitario: Number.isFinite(valor) && valor > 0 ? valor : 0,
    precioUnitario: Number.isFinite(valor) && valor > 0 ? (afectacion === 'GRAVADA' ? Number((valor * 1.18).toFixed(10)) : valor) : 0,
    afectacion,
    codigoAfectacion: ({ GRAVADA: '10', EXONERADA: '20', INAFECTA: '30', GRATUITA: '11' } as Record<string, string>)[producto.afectacion?.trim().toUpperCase() ?? ''] ?? producto.afectacion?.trim(),
    afectacionHeredada: true,
    unidadHeredada: true,
    icbper: 0,
  };
};

/** Línea de bolsa plástica con su precio unitario y su ICBPER. */
export const itemBolsa = (
  clave: string,
  cantidad: number,
  valorUnitario = 0.05,
): ItemBorrador => ({
  clave,
  codigo: 'ICBPER',
  descripcion: 'Bolsa plástica (ICBPER)',
  unidad: 'NIU',
  cantidad,
  valorUnitario,
  afectacion: 'GRAVADA',
  icbper: round2(cantidad * ICBPER_POR_UNIDAD),
});

/**
 * ¿La línea es la bolsa plástica del ICBPER?
 *
 * Se reconoce por el código fijo `ICBPER`, que es el que escribe `itemBolsa`.
 * Sirve para tratar su importe como DERIVADO de la cantidad en lugar de como un
 * dato que el usuario teclea por separado.
 */
export const esLineaBolsa = (item: ItemBorrador): boolean =>
  item.codigo.trim().toUpperCase() === 'ICBPER';

/**
 * Sincroniza el ICBPER de la bolsa con su cantidad.
 *
 * EL DEFECTO QUE ESTO ARREGLA
 *
 * El ICBPER es S/ 0,50 por unidad (regla 3306), pero en la grilla era una celda
 * más que el usuario tecleaba por su cuenta. `itemBolsa` lo calculaba bien al
 * crear la línea, y a partir de ahí se desincronizaba: poner cantidad 2 dejaba
 * el ICBPER en 0,50 y la liquidación cobraba la mitad. La cantidad y el impuesto
 * decían cosas distintas del mismo hecho, y quien lo revisara ante SUNAT vería
 * dos bolsas declaradas con el impuesto de una.
 *
 * Solo se toca la línea de bolsa: en cualquier otra, `icbper` es un importe que
 * el usuario decide (una línea con ICBPER sin ser bolsa no existe en el
 * catálogo, pero no se le pisa un valor escrito a mano).
 */
export const sincronizarIcbper = (item: ItemBorrador): ItemBorrador => {
  if (!esLineaBolsa(item)) return item;

  const cantidad = Number.isFinite(item.cantidad) ? Math.max(0, item.cantidad) : 0;
  return { ...item, icbper: round2(cantidad * ICBPER_POR_UNIDAD) };
};

/**
 * Reemplaza una línea por índice sin mutar el arreglo original.
 *
 * Después de aplicar el cambio se SINCRONIZA el ICBPER: si la línea es la bolsa
 * plástica y el usuario acaba de cambiar la cantidad, el impuesto tiene que
 * seguirla (S/ 0,50 por unidad). Sin esto, poner cantidad 2 dejaba el ICBPER en
 * 0,50 y la liquidación cobraba la mitad de lo que declara la línea.
 */
export const actualizarItem = (
  items: readonly ItemBorrador[],
  indice: number,
  parcial: Partial<ItemBorrador>,
): readonly ItemBorrador[] =>
  items.map((item, i) => {
    if (i !== indice) return item;
    const combinado: ItemBorrador = { ...item, ...parcial };
    if (
      typeof parcial.precioUnitario === 'number' &&
      parcial.valorUnitario === undefined
    ) {
      combinado.valorUnitario = valorUnitarioDesdePrecioConIgv(
        parcial.precioUnitario,
        combinado.afectacion,
      );
    } else if (
      parcial.afectacion !== undefined &&
      typeof combinado.precioUnitario === 'number'
    ) {
      combinado.valorUnitario = valorUnitarioDesdePrecioConIgv(
        combinado.precioUnitario,
        combinado.afectacion,
      );
    }
    return sincronizarIcbper(combinado);
  });

/** Elimina una línea por índice. */
export const eliminarItem = (
  items: readonly ItemBorrador[],
  indice: number,
): readonly ItemBorrador[] => items.filter((_, i) => i !== indice);

/** Añade una línea al final. */
export const agregarItem = (
  items: readonly ItemBorrador[],
  item: ItemBorrador,
): readonly ItemBorrador[] => [...items, item];
