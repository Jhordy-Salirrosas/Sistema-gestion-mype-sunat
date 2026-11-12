/**
 * Validación de la cantidad contra el stock disponible (M1).
 *
 * LO QUE PIDIÓ EL DOCENTE (31-10)
 *
 *   "Ya, acá tengo el precio unitario... Y ahora la cantidad tiene que ser
 *    validada dependiendo de lo que tienes."
 *
 * El buscador ya traía el stock de `/inventory/stocks`, pero nadie lo comparaba
 * con lo que se escribía en la grilla: se podía pedir 500 kg de clavos con 20 en
 * almacén y el formulario no decía nada. El backend lo rechaza al emitir, pero
 * enterarse después de llenar diez líneas es un mal rato evitable.
 *
 * POR QUÉ ES UN MÓDULO APARTE Y SIN REACT
 *
 * La regla tiene tres casos que conviene poder probar sin montar un componente:
 * producto del almacén con stock conocido, producto que no está en el catálogo
 * (no se puede afirmar nada) y línea de servicio escrita a mano (no tiene
 * almacén). Mezclarla con el JSX haría que solo se probara de rebote.
 */
import type { ItemBorrador } from './invoiceItems';
import type { ProductoBuscado } from './invoiceSearch';

/** Tolerancia por redondeo de cantidades decimales (0.001 unidades). */
const TOLERANCIA = 0.001;

/** Gravedad del problema de una línea. */
export type GravedadLinea = 'ok' | 'aviso' | 'error';

/** Resultado de validar una línea. */
export interface RevisionLinea {
  /** Índice 0-based de la línea. */
  indice: number;
  gravedad: GravedadLinea;
  /** Explicación apta para el usuario; vacía cuando la línea está bien. */
  mensaje: string;
  /** Stock disponible, cuando se conoce. */
  disponible?: number;
}

/** Resumen de la validación de toda la grilla. */
export interface RevisionGrilla {
  lineas: readonly RevisionLinea[];
  /** ¿Hay alguna línea que bloquea la emisión? */
  bloquea: boolean;
  /** Cantidad de líneas con error. */
  errores: number;
  /** Cantidad de líneas con aviso. */
  avisos: number;
  /** Líneas cuyas cantidades se validaron contra el almacén. */
  validadas: number;
}

/**
 * ¿La línea corresponde a un producto del inventario?
 *
 * El código puede escribirse a mano, así que se cruza contra el catálogo que
 * vino del almacén. Si el código no está en la lista, la línea existe pero no
 * podemos afirmar nada sobre su stock.
 */
export const productoDeLinea = (
  item: ItemBorrador,
  productos: readonly ProductoBuscado[],
): ProductoBuscado | undefined => {
  const codigo = item.codigo?.trim().toUpperCase();
  if (!codigo) return undefined;

  return productos.find((p) => p.sku.trim().toUpperCase() === codigo);
};

/**
 * Cantidad total pedida por producto, sumando todas las líneas.
 *
 * Importa porque una factura puede repetir el mismo SKU en dos líneas (por
 * ejemplo, dos colores del mismo artículo): validar línea por línea dejaría
 * pasar 15 + 15 unidades teniendo 20.
 */
export const cantidadesPorProducto = (
  items: readonly ItemBorrador[],
  productos: readonly ProductoBuscado[],
): Map<string, number> => {
  const acumulado = new Map<string, number>();

  for (const item of items) {
    const producto = productoDeLinea(item, productos);
    if (!producto) continue;

    const clave = producto.sku.trim().toUpperCase();
    acumulado.set(clave, (acumulado.get(clave) ?? 0) + item.cantidad);
  }

  return acumulado;
};

/**
 * Revisa la grilla completa contra el stock.
 *
 * Casos que NO bloquean, y por qué:
 *
 *  - **Servicio escrito a mano (sin código).** No tiene almacén. Bloquearlo
 *    impediría facturar consultoría, que es la mitad de una MYPE.
 *  - **Código que no está en el catálogo.** Puede ser un producto histórico o
 *    que aún no se cargó al sistema. Se avisa y se deja pasar; el backend
 *    tampoco lo bloquea.
 *  - **Stock desconocido (`undefined`).** No se inventa un cero: se avisa de que
 *    no se pudo comprobar.
 *
 * Lo que SÍ bloquea:
 *
 *  - La cantidad pedida supera lo disponible, sumando todas las líneas del
 *    mismo producto.
 *  - La cantidad no es un número positivo.
 */
export const revisarGrilla = (
  items: readonly ItemBorrador[],
  productos: readonly ProductoBuscado[],
  opciones: { nota?: boolean; estado?: 'listo' | 'cargando' | 'error' } = {},
): RevisionGrilla => {
  const pedidoPorProducto = cantidadesPorProducto(items, productos);
  const lineas: RevisionLinea[] = [];

  let errores = 0;
  let avisos = 0;
  let validadas = 0;

  items.forEach((item, indice) => {
    // La cantidad tiene que ser un número útil antes de compararla con nada.
    if (!Number.isFinite(item.cantidad) || item.cantidad <= 0) {
      errores += 1;
      lineas.push({
        indice,
        gravedad: 'error',
        mensaje: 'La cantidad debe ser mayor que cero.',
      });
      return;
    }

    const producto = productoDeLinea(item, productos);
    if (opciones.estado && opciones.estado !== 'listo') {
      avisos += 1; lineas.push({ indice, gravedad: 'aviso', mensaje: opciones.estado === 'cargando' ? 'Consultando catálogo del almacén…' : 'Catálogo no disponible; no se pudo comprobar existencia ni stock.' }); return;
    }
    if (opciones.nota) {
      lineas.push({ indice, gravedad: producto ? 'ok' : 'aviso', mensaje: producto ? 'Línea del comprobante origen; conserva sus datos históricos.' : 'Línea histórica del origen: existencia actual no confirmada; no se reprecifica.' });
      if (!producto) avisos += 1; return;
    }

    if (!producto) {
      // Sin código es un servicio; con código desconocido, un producto no
      // registrado. Se distingue porque el consejo que hay que dar es distinto.
      if (item.codigo?.trim()) {
        avisos += 1;
        lineas.push({
          indice,
          gravedad: 'aviso',
          mensaje:
            `El producto ${item.codigo.trim()} no se encuentra en el catálogo de venta consultado: ` +
            'existencia y stock sin confirmar; revise su configuración.',
        });
      } else {
        lineas.push({
          indice,
          gravedad: 'ok',
          mensaje: '',
        });
      }
      return;
    }

    const disponible = producto.stock;

    if (disponible === undefined) {
      avisos += 1;
      lineas.push({
        indice,
        gravedad: 'aviso',
        mensaje: `No se pudo leer el stock de ${producto.sku}.`,
        disponible,
      });
      return;
    }

    validadas += 1;

    const pedido = pedidoPorProducto.get(producto.sku.trim().toUpperCase()) ?? 0;

    if (pedido > disponible + TOLERANCIA) {
      errores += 1;
      // El mensaje dice el pedido TOTAL, no solo el de esta línea: si el SKU se
      // repite, el usuario no entendería por qué falla una línea de 15 cuando
      // hay 20 en almacén.
      const repetido = pedido > item.cantidad + TOLERANCIA;
      lineas.push({
        indice,
        gravedad: 'error',
        mensaje: repetido
          ? `Se piden ${pedido} ${item.unidad || producto.unidad} de ` +
            `${producto.sku} (repartidos en varias líneas) y hay ${disponible}.`
          : `Se piden ${item.cantidad} ${item.unidad || producto.unidad} de ` +
            `${producto.sku} y hay ${disponible}.`,
        disponible,
      });
      return;
    }

    lineas.push({
      indice,
      gravedad: 'ok',
      mensaje: '',
      disponible,
    });
  });

  return {
    lineas,
    bloquea: errores > 0,
    errores,
    avisos,
    validadas,
  };
};

/**
 * Primera línea con error, para enfocar el mensaje de la pantalla.
 *
 * La emisión se detiene en el primer problema: listar los diez errores cuando
 * el usuario solo puede corregir uno por vez es ruido.
 */
export const primeraLineaConError = (
  revision: RevisionGrilla,
): RevisionLinea | undefined =>
  revision.lineas.find((linea) => linea.gravedad === 'error');
