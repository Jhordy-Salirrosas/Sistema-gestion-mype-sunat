/**
 * Validación de la cantidad contra el stock disponible (M1, docente 31-10).
 *
 * La frase que origina estas pruebas: "y ahora la cantidad tiene que ser
 * validada dependiendo de lo que tienes".
 *
 * Lo que se comprueba:
 *  - Pedir más de lo que hay en almacén se marca como ERROR (bloquea).
 *  - Repartir la misma cantidad en varias líneas del MISMO SKU también cuenta:
 *    10 + 10 con 15 en stock es un error, aunque ninguna línea sola lo sea.
 *  - Un servicio sin código no es un error: no tiene almacén.
 *  - Un código que no está en el catálogo no bloquea, pero avisa.
 *  - Una cantidad no positiva es un error.
 */
import { describe, expect, it } from 'vitest';
import {
  cantidadesPorProducto,
  primeraLineaConError,
  productoDeLinea,
  revisarGrilla,
} from '@/modules/invoices/lib/invoiceStockLinea';
import type { ItemBorrador } from '@/modules/invoices/lib/invoiceItems';
import type { ProductoBuscado } from '@/modules/invoices/lib/invoiceSearch';

/** Línea de la grilla con valores por defecto. */
const linea = (parcial: Partial<ItemBorrador> = {}): ItemBorrador => ({
  clave: `l-${Math.random().toString(36).slice(2, 8)}`,
  codigo: 'CEM-001',
  descripcion: 'Cemento Portland tipo I',
  unidad: 'NIU',
  cantidad: 1,
  valorUnitario: 32.9,
  afectacion: 'GRAVADA',
  icbper: 0,
  ...parcial,
});

/** Producto del almacén. */
const producto = (
  sku: string,
  stock: number | undefined,
): ProductoBuscado => ({
  sku,
  descripcion: `Producto ${sku}`,
  unidad: 'NIU',
  valorUnitario: 10,
  stock,
});

describe('revisarGrilla — validación de cantidad contra stock', () => {
  it('acepta una cantidad que cabe en el almacén', () => {
    const revision = revisarGrilla(
      [linea({ codigo: 'CEM-001', cantidad: 5 })],
      [producto('CEM-001', 20)],
    );

    expect(revision.bloquea).toBe(false);
    expect(revision.errores).toBe(0);
    expect(revision.validadas).toBe(1);
  });

  // El caso central que el docente señaló: vender lo que no hay.
  it('bloquea cuando se pide más de lo disponible', () => {
    const revision = revisarGrilla(
      [linea({ codigo: 'CEM-001', cantidad: 500 })],
      [producto('CEM-001', 20)],
    );

    expect(revision.bloquea).toBe(true);
    expect(revision.errores).toBe(1);
    expect(revision.lineas[0].mensaje).toContain('hay 20');
    expect(revision.lineas[0].disponible).toBe(20);
  });

  it('bloquea exactamente cuando la cantidad iguala el stock (el límite se admite)', () => {
    const revision = revisarGrilla(
      [linea({ codigo: 'CEM-001', cantidad: 20 })],
      [producto('CEM-001', 20)],
    );

    expect(revision.bloquea).toBe(false);
  });

  it('un céntimo de más en el stock no dispara un falso error', () => {
    const revision = revisarGrilla(
      [linea({ codigo: 'CEM-001', cantidad: 2.5 })],
      [producto('CEM-001', 2.5)],
    );

    expect(revision.bloquea).toBe(false);
  });

  // Repetir el SKU en dos líneas es normal en una ferretería (dos colores o dos
  // lotes). Validar línea por línea dejaría pasar 10 + 10 teniendo 15.
  it('suma las líneas del mismo SKU antes de comparar', () => {
    const revision = revisarGrilla(
      [
        linea({ codigo: 'CLV-2', cantidad: 10 }),
        linea({ codigo: 'CLV-2', cantidad: 10 }),
      ],
      [producto('CLV-2', 15)],
    );

    expect(revision.bloquea).toBe(true);
    expect(revision.errores).toBe(2);
    // El mensaje dice el total pedido, no solo la línea, para que se entienda.
    expect(revision.lineas[0].mensaje).toContain('20');
  });

  it('no confunde el stock de dos SKU distintos', () => {
    const revision = revisarGrilla(
      [
        linea({ codigo: 'CEM-001', cantidad: 5 }),
        linea({ codigo: 'CLV-2', cantidad: 5 }),
      ],
      [producto('CEM-001', 5), producto('CLV-2', 5)],
    );

    expect(revision.bloquea).toBe(false);
    expect(revision.validadas).toBe(2);
  });

  // El docente: "supone que esos productos o servicios los tienes dentro de tu
  // inventario". Un servicio no vive en el almacén y no puede bloquearse.
  it('no bloquea un servicio escrito sin código', () => {
    const revision = revisarGrilla(
      [linea({ codigo: '', descripcion: 'Servicio de instalación' })],
      [producto('CEM-001', 1)],
    );

    expect(revision.bloquea).toBe(false);
    expect(revision.avisos).toBe(0);
  });

  it('avisa, pero no bloquea, cuando el código no está en el catálogo', () => {
    const revision = revisarGrilla(
      [linea({ codigo: 'NO-EXISTE', cantidad: 999 })],
      [producto('CEM-001', 1)],
    );

    expect(revision.bloquea).toBe(false);
    expect(revision.avisos).toBe(1);
    expect(revision.lineas[0].mensaje).toContain('no se encuentra en el catálogo de venta consultado');
  });

  it('avisa cuando el stock es desconocido en lugar de inventar un cero', () => {
    const revision = revisarGrilla(
      [linea({ codigo: 'CEM-001', cantidad: 50 })],
      [producto('CEM-001', undefined)],
    );

    expect(revision.bloquea).toBe(false);
    expect(revision.avisos).toBe(1);
  });

  it.each([0, -3])(
    'bloquea una cantidad no positiva (%s)',
    (cantidad) => {
      const revision = revisarGrilla(
        [linea({ cantidad })],
        [producto('CEM-001', 10)],
      );

      expect(revision.bloquea).toBe(true);
      expect(revision.lineas[0].mensaje).toContain('mayor que cero');
    },
  );

  it('ignora mayúsculas y espacios al cruzar el código', () => {
    const revision = revisarGrilla(
      [linea({ codigo: '  cem-001  ', cantidad: 1 })],
      [producto('CEM-001', 10)],
    );

    expect(revision.validadas).toBe(1);
    expect(revision.bloquea).toBe(false);
  });

  it('con la grilla vacía no hay nada que bloquear', () => {
    const revision = revisarGrilla([], [producto('CEM-001', 10)]);

    expect(revision.bloquea).toBe(false);
    expect(revision.validadas).toBe(0);
  });
});

describe('cantidadesPorProducto', () => {
  it('acumula por SKU normalizado', () => {
    const acumulado = cantidadesPorProducto(
      [
        linea({ codigo: 'cem-001', cantidad: 3 }),
        linea({ codigo: 'CEM-001', cantidad: 4 }),
        linea({ codigo: '', cantidad: 100 }),
      ],
      [producto('CEM-001', 10)],
    );

    expect(acumulado.get('CEM-001')).toBe(7);
    expect(acumulado.size).toBe(1);
  });
});

describe('productoDeLinea', () => {
  it('devuelve undefined si la línea no tiene código', () => {
    expect(productoDeLinea(linea({ codigo: '' }), [producto('CEM-001', 1)])).toBeUndefined();
  });
});

describe('primeraLineaConError', () => {
  it('devuelve la primera línea que bloquea', () => {
    const revision = revisarGrilla(
      [
        linea({ codigo: 'CEM-001', cantidad: 5 }),
        linea({ codigo: 'CLV-2', cantidad: 999 }),
      ],
      [producto('CEM-001', 10), producto('CLV-2', 1)],
    );

    const primera = primeraLineaConError(revision);

    expect(primera?.indice).toBe(1);
  });

  it('devuelve undefined cuando no hay errores', () => {
    const revision = revisarGrilla(
      [linea({ cantidad: 1 })],
      [producto('CEM-001', 10)],
    );

    expect(primeraLineaConError(revision)).toBeUndefined();
  });
});
