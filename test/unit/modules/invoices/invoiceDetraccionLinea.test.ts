/**
 * Detracción por línea (TA-64, corrección del docente).
 *
 * Lo que dijo el docente:
 *   "Pero eso lo manda el producto, no lo manda la factura, porque los productos
 *    son con detracción, no la factura."
 *
 * El caso que protege esta prueba es el de la ferretería: una factura con
 * cemento (no sujeto) y un flete (sujeto al 4 %). Antes se detraía el 4 % de
 * TODO; ahora solo del flete.
 */
import { describe, expect, it } from 'vitest';
import {
  calcularDetraccionPorLineas,
  repartirPago,
} from '@/modules/invoices/lib/invoiceDetraccionLinea';

describe('TA-64 · detracción por línea', () => {
  it('una factura sin líneas sujetas no detrae nada', () => {
    const r = calcularDetraccionPorLineas(
      [{ base: 1000 }, { base: 500 }],
      1770,
    );
    expect(r.aplica).toBe(false);
    expect(r.monto).toBe(0);
    expect(r.motivoNoAplica).toContain('Ninguna línea');
  });

  it('una sola línea sujeta en un comprobante caro: detrae solo esa base', () => {
    // Cemento 1000 (no sujeto) + flete 500 (sujeto al 4 %). Total 1770.
    const r = calcularDetraccionPorLineas(
      [
        { base: 1000 },
        { base: 500, codigoDetraccion: '027' },
      ],
      1770,
    );

    expect(r.aplica).toBe(true);
    // 4 % de 500 = 20, NO el 4 % de 1770.
    expect(r.baseSujeta).toBe(500);
    expect(r.monto).toBe(20);
  });

  it('el umbral de S/ 700 se evalúa sobre el TOTAL, no sobre la línea', () => {
    // El flete solo son 500, pero el comprobante vale 1770: sí se detrae.
    const conTotalAlto = calcularDetraccionPorLineas(
      [{ base: 500, codigoDetraccion: '027' }],
      1770,
    );
    expect(conTotalAlto.aplica).toBe(true);

    // El mismo flete en un comprobante de 600 no supera el umbral.
    const conTotalBajo = calcularDetraccionPorLineas(
      [{ base: 500, codigoDetraccion: '027' }],
      600,
    );
    expect(conTotalBajo.aplica).toBe(false);
    expect(conTotalBajo.motivoNoAplica).toContain('umbral');
  });

  it('el borde exacto de S/ 700.00 no detrae (debe SUPERAR)', () => {
    const r = calcularDetraccionPorLineas(
      [{ base: 700, codigoDetraccion: '027' }],
      700,
    );
    expect(r.aplica).toBe(false);
  });

  it('S/ 700.01 sí detrae', () => {
    const r = calcularDetraccionPorLineas(
      [{ base: 700.01, codigoDetraccion: '027' }],
      700.01,
    );
    expect(r.aplica).toBe(true);
  });

  it('rechaza mezclar dos tipos de detracción en una factura', () => {
    // SUNAT admite una sola operación sujeta por comprobante.
    const r = calcularDetraccionPorLineas(
      [
        { base: 500, codigoDetraccion: '027' }, // 4 %
        { base: 500, codigoDetraccion: '030' }, // 4 % distinto código
      ],
      1770,
    );

    expect(r.aplica).toBe(false);
    expect(r.motivoNoAplica).toContain('mezcla');
    expect(r.codigos).toEqual(['027', '030']);
  });

  it('rechaza un código que no está en el Catálogo 54', () => {
    const r = calcularDetraccionPorLineas(
      [{ base: 1000, codigoDetraccion: '999' }],
      1770,
    );
    expect(r.aplica).toBe(false);
    expect(r.motivoNoAplica).toContain('Catálogo 54');
  });

  it('varias líneas con el MISMO código suman su base', () => {
    const r = calcularDetraccionPorLineas(
      [
        { base: 300, codigoDetraccion: '027' },
        { base: 200, codigoDetraccion: '027' },
      ],
      1770,
    );
    expect(r.baseSujeta).toBe(500);
    expect(r.monto).toBe(20); // 4 % de 500
  });

  it('una línea gratuita sujeta no aporta base', () => {
    const r = calcularDetraccionPorLineas(
      [{ base: 0, codigoDetraccion: '027' }],
      1770,
    );
    expect(r.aplica).toBe(false);
  });

  it('conserva los céntimos de la detracción', () => {
    // 12 % de 1001 = 120.12
    const r = calcularDetraccionPorLineas(
      [{ base: 1001, codigoDetraccion: '012' }],
      1770,
    );
    expect(r.monto).toBe(120.12);
  });
});

describe('TA-64 · reparto del pago', () => {
  it('sin detracción ni retención todo va al proveedor', () => {
    const r = repartirPago(1180, 0, 0);
    expect(r.pagoDirecto).toBe(1180);
  });

  it('la detracción sale del pago directo pero NO del importe total', () => {
    // Este es el error que tenía el modelo anterior: el "neto" sugería que la
    // factura valía menos. El importe total es el mismo; cambia la vía.
    const r = repartirPago(1770, 20, 0);
    expect(r.importeTotal).toBe(1770);
    expect(r.depositoDetraccion).toBe(20);
    expect(r.pagoDirecto).toBe(1750);
  });

  it('detracción y retención se descuentan las dos del pago directo', () => {
    const r = repartirPago(1770, 20, 53.1);
    expect(r.pagoDirecto).toBe(1696.9);
  });

  it('el reparto siempre cuadra al céntimo', () => {
    const r = repartirPago(1770, 20, 53.1);
    const suma = r.pagoDirecto + r.depositoDetraccion + r.retenidoIgv;
    expect(Math.abs(suma - r.importeTotal)).toBeLessThan(0.011);
  });
});
