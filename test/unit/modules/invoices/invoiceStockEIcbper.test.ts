/**
 * Precisión de precio: stock en el modal e ICBPER de la bolsa (M1).
 *
 * Los dos son defectos que la verificación de Emma reprodujo y que NO se veían
 * en los tests: el stock porque el modal nunca recibía el catálogo, y el ICBPER
 * porque la grilla trataba un importe derivado como si fuera un dato tecleado.
 */
import { describe, expect, it } from 'vitest';
import {
  actualizarItem,
  agregarItem,
  esLineaBolsa,
  itemBolsa,
  itemVacio,
  sincronizarIcbper,
} from '@/modules/invoices/lib/invoiceItems';import { revisarGrilla } from '@/modules/invoices/lib/invoiceStockLinea';

describe('stock · la validación necesita el catálogo', () => {
  const producto = {
    sku: 'CEM-001',
    descripcion: 'Cemento Portland tipo I',
    unidad: 'NIU',
    valorUnitario: 30,
    stock: 10,
  };

  it('sin catálogo no se puede afirmar nada del stock', () => {
    // ESTE ERA EL DEFECTO: el modal recibía `productos = []` porque
    // `InvoicesListPage` no se los pasaba. La validación corría, pero sin
    // catálogo toda línea con código era solo un "aviso" y nada bloqueaba.
    const linea = { ...itemVacio('k1'), codigo: 'CEM-001', cantidad: 999 };
    const revision = revisarGrilla([linea], []);

    expect(revision.bloquea).toBe(false);
    expect(revision.validadas).toBe(0);
    expect(revision.avisos).toBe(1);
  });

  it('con el catálogo, pedir más que el stock SÍ bloquea', () => {
    const linea = { ...itemVacio('k1'), codigo: 'CEM-001', cantidad: 999 };
    const revision = revisarGrilla([linea], [producto]);

    expect(revision.bloquea).toBe(true);
    expect(revision.errores).toBe(1);
    expect(revision.lineas[0].mensaje).toContain('999');
    expect(revision.lineas[0].mensaje).toContain('10');
  });

  it('con el catálogo, pedir dentro del stock no bloquea', () => {
    const linea = { ...itemVacio('k1'), codigo: 'CEM-001', cantidad: 10 };
    const revision = revisarGrilla([linea], [producto]);

    expect(revision.bloquea).toBe(false);
    expect(revision.validadas).toBe(1);
  });

  it('dos líneas del mismo SKU suman para el límite', () => {
    const a = { ...itemVacio('a'), codigo: 'CEM-001', cantidad: 6 };
    const b = { ...itemVacio('b'), codigo: 'CEM-001', cantidad: 6 };
    const revision = revisarGrilla([a, b], [producto]);

    // 6 + 6 = 12 > 10: el límite no se esquiva repartiendo la cantidad.
    expect(revision.bloquea).toBe(true);
  });

  it('la bolsa plástica NO genera aviso de stock', () => {
    // El ICBPER no es un producto del almacén: su importe sale de la cantidad.
    // Avisar "no está en el inventario" era cierto e inútil, y tapaba los
    // avisos que sí importan.
    const revision = revisarGrilla([itemBolsa('b', 2)], [producto]);

    expect(revision.avisos).toBe(0);
    expect(revision.errores).toBe(0);
    expect(revision.lineas[0].mensaje).toBe('');
  });

  it('un código desconocido que NO es bolsa sigue avisando', () => {
    // El silencio es solo para el ICBPER; un SKU inventado sí debe avisar.
    const revision = revisarGrilla(
      [{ ...itemVacio('k'), codigo: 'NO-EXISTE', cantidad: 1 }],
      [producto],
    );

    expect(revision.avisos).toBe(1);
    expect(revision.lineas[0].mensaje).toContain('NO-EXISTE');
  });
});

describe('ICBPER · el importe sigue a la cantidad', () => {
  it('la bolsa nueva calcula su impuesto', () => {
    expect(itemBolsa('b', 1).icbper).toBe(0.5);
    expect(itemBolsa('b', 2).icbper).toBe(1);
    expect(itemBolsa('b', 3).icbper).toBe(1.5);
  });

  it('reconoce la línea de bolsa por su código', () => {
    expect(esLineaBolsa(itemBolsa('b', 1))).toBe(true);
    expect(esLineaBolsa(itemVacio('k'))).toBe(false);
    expect(esLineaBolsa({ ...itemVacio('k'), codigo: 'icbper' })).toBe(true);
  });

  it('cambiar la cantidad de la bolsa recalcula el ICBPER', () => {
    // EL DEFECTO: la línea nacía con 0,50 y al poner cantidad 2 el impuesto se
    // quedaba en 0,50, así que la liquidación cobraba la mitad de lo declarado.
    const items = agregarItem([], itemBolsa('b', 1));
    const despues = actualizarItem(items, 0, { cantidad: 2 });

    expect(despues[0].cantidad).toBe(2);
    expect(despues[0].icbper).toBe(1);
  });

  it('cambiar la cantidad de una línea normal NO toca su ICBPER', () => {
    // En una línea que no es bolsa, `icbper` es un dato propio: se respeta.
    const items = [{ ...itemVacio('k'), icbper: 7 }];
    const despues = actualizarItem(items, 0, { cantidad: 5 });

    expect(despues[0].icbper).toBe(7);
  });

  it('la sincronización no arrastra error de coma flotante', () => {
    // 0,50 × 3 en IEEE-754 puede dar 1.5000000000000002.
    const sincronizada = sincronizarIcbper({
      ...itemBolsa('b', 1),
      cantidad: 3,
    });

    expect(sincronizada.icbper).toBe(1.5);
    expect(String(sincronizada.icbper).length).toBeLessThanOrEqual(3);
  });

  it('una cantidad inválida deja el ICBPER en cero, no en NaN', () => {
    const raro = sincronizarIcbper({
      ...itemBolsa('b', 1),
      cantidad: Number.NaN,
    });
    expect(raro.icbper).toBe(0);
    expect(Number.isFinite(raro.icbper)).toBe(true);
  });
});
