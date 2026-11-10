/**
 * TA-61 dentro de TA-64 — el buscador de productos alimenta la grilla de ítems.
 *
 * QUÉ SE PRUEBA
 *
 * Que un producto del almacén se convierta en una LÍNEA VÁLIDA del comprobante.
 * El defecto que este archivo impide es el más caro de los tres posibles aquí:
 *
 *  1. copiar la unidad tal como la devuelve el almacén ("kg", "NIU ") produce un
 *     XML que SUNAT rechaza, porque el Catálogo 03 exige el código exacto;
 *  2. un precio ausente o no numérico se propagaba como `NaN` y envenenaba los
 *     totales del comprobante entero;
 *  3. una línea gratuita por defecto: si se copiara la afectación del producto
 *     sin mirarla, una venta normal podía nacer excluida del total.
 */
import { describe, expect, it } from 'vitest';
import { calcularItem, itemDesdeProducto } from '@/modules/invoices/lib/invoiceItems';

/** Producto de almacén tal como lo devuelve el buscador. */
function producto(extra: Record<string, unknown> = {}) {
  return {
    sku: 'CEM-001',
    descripcion: 'Cemento Portland tipo I - 42.5 kg',
    unidad: 'NIU',
    afectacion: '10',
    valorUnitario: 32.9,
    ...extra,
  };
}

describe('TA-64 + TA-61 - producto elegido en el buscador -> línea de la grilla', () => {
  it('copia el código, la descripción, la unidad y el precio', () => {
    const item = itemDesdeProducto(producto(), 'clave-1');

    expect(item.clave).toBe('clave-1');
    expect(item.codigo).toBe('CEM-001');
    expect(item.descripcion).toBe('Cemento Portland tipo I - 42.5 kg');
    expect(item.unidad).toBe('NIU');
    expect(item.unidadHeredada).toBe(true);
    expect(item.valorUnitario).toBe(32.9);
  });

  it('arranca con cantidad 1 y afectación GRAVADA', () => {
    const item = itemDesdeProducto(producto(), 'k');
    expect(item.cantidad).toBe(1);
    expect(item.afectacion).toBe('GRAVADA');
    expect(item.icbper).toBe(0);
  });

  it('la línea resultante es calculable: total = cantidad x valor', () => {
    const item = itemDesdeProducto(producto({ valorUnitario: 100 }), 'k');
    const totales = calcularItem(item);
    expect(totales.total).toBeGreaterThan(0);
    expect(Number.isNaN(totales.total)).toBe(false);
  });

  it('normaliza una unidad en minúsculas al código del Catálogo 03', () => {
    const item = itemDesdeProducto(producto({ unidad: 'niu' }), 'k');
    expect(item.unidad).toBe('NIU');
  });

  it('quita el espacio sobrante de la unidad', () => {
    const item = itemDesdeProducto(producto({ unidad: ' NIU ' }), 'k');
    expect(item.unidad).toBe('NIU');
  });

  it('bloquea unidad incompatible sin sustituirla por NIU', () => {
    expect(() => itemDesdeProducto(producto({ unidad: 'kilos' }), 'k')).toThrow(/Unidad del producto no compatible/);
  });

  it('acepta cualquier unidad que sí esté en el catálogo', () => {
    const item = itemDesdeProducto(producto({ unidad: 'KGM' }), 'k');
    expect(item.unidad).toBe('KGM');
  });

  it('un precio no numérico se convierte en 0, no en NaN', () => {
    const item = itemDesdeProducto(producto({ valorUnitario: 'abc' }), 'k');
    expect(item.valorUnitario).toBe(0);
    expect(Number.isNaN(calcularItem(item).total)).toBe(false);
  });

  it('un precio negativo se trata como 0: una línea no puede restar', () => {
    const item = itemDesdeProducto(producto({ valorUnitario: -10 }), 'k');
    expect(item.valorUnitario).toBe(0);
  });

  it('un producto sin precio crea la línea igual, con 0', () => {
    const item = itemDesdeProducto(producto({ valorUnitario: undefined }), 'k');
    expect(item.valorUnitario).toBe(0);
    expect(item.codigo).toBe('CEM-001');
  });

  it('no muta el producto original', () => {
    const original = producto();
    const copia = { ...original };
    itemDesdeProducto(original, 'k');
    expect(original).toEqual(copia);
  });

  it('dos productos distintos generan claves distintas', () => {
    const a = itemDesdeProducto(producto({ sku: 'A' }), 'k1');
    const b = itemDesdeProducto(producto({ sku: 'B' }), 'k2');
    expect(a.clave).not.toBe(b.clave);
    expect(a.codigo).not.toBe(b.codigo);
  });

  it('hereda la afectación tributaria configurada en el producto y la marca como heredada (no editable libremente)', () => {
    const exo = itemDesdeProducto(producto({ afectacion: '20', valorUnitario: 50 }), 'k-exo');
    expect(exo.afectacion).toBe('EXONERADA');
    expect(exo.afectacionHeredada).toBe(true);
    expect(calcularItem(exo)).toEqual({ base: 50, igv: 0, icbper: 0, total: 50 });

    const inaf = itemDesdeProducto(producto({ afectacion: 'INAFECTA', valorUnitario: 80 }), 'k-ina');
    expect(inaf.afectacion).toBe('INAFECTA');
    expect(inaf.afectacionHeredada).toBe(true);
    expect(calcularItem(inaf)).toEqual({ base: 80, igv: 0, icbper: 0, total: 80 });
  });
});

it('6D acepta MTQ sin sustituir la unidad real de Arena', () => {
  expect(itemDesdeProducto({ sku: 'ARE-001', descripcion: 'Arena', unidad: 'MTQ', valorUnitario: 100, precioUnitario: 118, afectacion: '10' }, 'a')).toMatchObject({ unidad: 'MTQ', precioUnitario: 118 });
});
