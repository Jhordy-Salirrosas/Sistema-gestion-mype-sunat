/**
 * D9 · fecha de emisión editable (M1).
 *
 * Lo que se prueba, y por qué cada cosa importa:
 *
 *  1. La fecha nace con HOY en Lima, no con la del equipo en UTC.
 *  2. La validación rechaza fechas inexistentes, futuras y demasiado antiguas.
 *  3. Al cambiar la emisión, las cuotas CONSERVAN SU PLAZO (regla 3267) y el
 *     cronograma sigue cuadrando al céntimo (regla 3319).
 *  4. El plazo editado a mano no se borra: si el usuario puso «la primera a 15
 *     días y la segunda a 90», sigue diciendo 15 y 90 con la fecha nueva.
 */
import { describe, expect, it } from 'vitest';
import {
  DIAS_MAXIMOS_ATRASO,
  diasEntreFechas,
  fechaIsoValida,
  hoyEnLima,
} from '@/modules/invoices/lib/invoiceFecha';
import {
  minimoDeFechaEmision,
  problemaDeFechaEmision,
  topeDeFechaEmision,
} from '@/modules/invoices/lib/invoiceEmitFecha';
import {
  borradorInicial,
  cambiarFechaEmision,
} from '@/modules/invoices/lib/invoiceEmitDraft';
import { repartirEnCuotas } from '@/modules/invoices/lib/invoiceDetraccion';

const HOY = '2026-11-03';

describe('D9 · fecha de hoy en Lima', () => {
  it('hoyEnLima devuelve una fecha ISO que existe', () => {
    const hoy = hoyEnLima();
    expect(hoy).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(fechaIsoValida(hoy)).toBe(true);
  });

  it('fechaIsoValida rechaza fechas imposibles que Date.parse aceptaría', () => {
    // `new Date('2026-02-30')` NO da NaN: rueda al 2 de marzo. Por eso se
    // compara la cadena de ida y vuelta.
    expect(fechaIsoValida('2026-02-30')).toBe(false);
    expect(fechaIsoValida('2026-13-01')).toBe(false);
    expect(fechaIsoValida('2026-2-3')).toBe(false);
    expect(fechaIsoValida('')).toBe(false);
    expect(fechaIsoValida('2026-02-28')).toBe(true);
    expect(fechaIsoValida('2028-02-29')).toBe(true); // bisiesto
    expect(fechaIsoValida('2026-02-29')).toBe(false); // no bisiesto
  });

  it('diasEntreFechas cuenta días de calendario', () => {
    expect(diasEntreFechas('2026-11-03', '2026-11-03')).toBe(0);
    expect(diasEntreFechas('2026-11-03', '2026-11-04')).toBe(1);
    expect(diasEntreFechas('2026-11-10', '2026-11-03')).toBe(-7);
    expect(diasEntreFechas('2026-11-03', 'no-es-fecha')).toBeNull();
  });
});

describe('D9 · validación de la fecha de emisión', () => {
  it('acepta hoy', () => {
    expect(problemaDeFechaEmision(HOY, HOY)).toBeNull();
  });

  it('acepta los días anteriores dentro del plazo del resumen', () => {
    expect(problemaDeFechaEmision('2026-10-27', HOY)).toBeNull(); // 7 días
    expect(problemaDeFechaEmision('2026-11-01', HOY)).toBeNull();
  });

  it('rechaza una fecha vacía', () => {
    expect(problemaDeFechaEmision('', HOY)).toContain('Indique la fecha');
  });

  it('rechaza una fecha que no existe en el calendario', () => {
    expect(problemaDeFechaEmision('2026-02-30', HOY)).toContain('no existe');
  });

  it('rechaza una fecha futura', () => {
    expect(problemaDeFechaEmision('2026-11-04', HOY)).toContain('futura');
  });

  it('rechaza una fecha más antigua que el plazo de la regla 2957', () => {
    // 8 días atrás: una boleta ya no se podría informar por resumen diario.
    const mensaje = problemaDeFechaEmision('2026-10-26', HOY);
    expect(mensaje).toContain('2957');
    expect(mensaje).toContain(DIAS_MAXIMOS_ATRASO.toString());
  });

  it('los topes del formulario coinciden con la validación', () => {
    expect(topeDeFechaEmision(HOY)).toBe(HOY);
    expect(minimoDeFechaEmision(HOY)).toBe('2026-10-27');
    // El máximo es hoy: mañana ya es inválido.
    expect(diasEntreFechas(topeDeFechaEmision(HOY), '2026-11-04')).toBe(1);
    // El mínimo es exactamente el último día permitido.
    expect(problemaDeFechaEmision(minimoDeFechaEmision(HOY), HOY)).toBeNull();
  });
});

describe('D9 · cambiar la fecha re-deriva el cronograma', () => {
  const credito = () => ({
    ...borradorInicial('01', '2026-11-03'),
    formaPago: 'Credito' as const,
    cuotas: repartirEnCuotas(1000, 2, '2026-11-03').map((c) => ({
      monto: c.monto,
      vencimiento: c.vencimiento,
    })),
  });

  it('las cuotas conservan su plazo respecto de la nueva emisión', () => {
    const antes = credito();
    // Cuotas repartidas cada 30 días: vencen el 03-12 y el 03-01.
    expect(antes.cuotas.map((c) => c.vencimiento)).toEqual([
      '2026-12-03',
      '2027-01-02',
    ]);

    // Se mueve la emisión 5 días hacia atrás.
    const despues = cambiarFechaEmision(antes, '2026-10-29');
    expect(despues.fecha).toBe('2026-10-29');

    // Cada vencimiento se movió los mismos 5 días: el plazo sigue siendo 30 y 60.
    expect(despues.cuotas.map((c) => c.vencimiento)).toEqual([
      '2026-11-28',
      '2026-12-28',
    ]);
    expect(diasEntreFechas(despues.fecha, despues.cuotas[0].vencimiento)).toBe(30);
    expect(diasEntreFechas(despues.fecha, despues.cuotas[1].vencimiento)).toBe(60);
  });

  it('los importes NO se tocan al mover la fecha', () => {
    const antes = credito();
    const despues = cambiarFechaEmision(antes, '2026-10-30');

    expect(despues.cuotas.map((c) => c.monto)).toEqual(
      antes.cuotas.map((c) => c.monto),
    );
    // Regla 3319: sigue cuadrando al céntimo con el neto.
    const suma = despues.cuotas.reduce((acc, c) => acc + c.monto, 0);
    expect(Math.round(suma * 100) / 100).toBe(1000);
  });

  it('respeta un plazo editado a mano (15 y 90 días)', () => {
    const aMedida = {
      ...borradorInicial('01', '2026-11-03'),
      formaPago: 'Credito' as const,
      cuotas: [
        { monto: 500, vencimiento: '2026-11-18' }, // 15 días
        { monto: 500, vencimiento: '2027-02-01' }, // 90 días
      ],
    };

    const despues = cambiarFechaEmision(aMedida, '2026-11-01');
    // Se movieron al 01-11 conservando 15 y 90 días, en lugar de volver a
    // repartir cada 30.
    expect(diasEntreFechas(despues.fecha, despues.cuotas[0].vencimiento)).toBe(15);
    expect(diasEntreFechas(despues.fecha, despues.cuotas[1].vencimiento)).toBe(90);
  });

  it('con la emisión movida, TODAS las cuotas siguen venciendo después (regla 3267)', () => {
    // Este es el defecto que D9 podía introducir: fechar hoy y arrastrar un
    // cronograma que nació con otra base dejaría cuotas en el pasado.
    const antes = credito();
    for (const nueva of ['2026-10-27', '2026-10-29', '2026-11-01', '2026-11-03']) {
      const despues = cambiarFechaEmision(antes, nueva);
      for (const cuota of despues.cuotas) {
        expect(
          diasEntreFechas(despues.fecha, cuota.vencimiento) ?? -1,
        ).toBeGreaterThan(0);
      }
    }
  });

  it('una fecha inválida se guarda pero no mueve el cronograma', () => {
    const antes = credito();
    const despues = cambiarFechaEmision(antes, '2026-02-30');

    expect(despues.fecha).toBe('2026-02-30');
    // No se re-deriva sobre una fecha rota: los vencimientos quedan igual y la
    // validación de la fecha es la que bloquea el envío.
    expect(despues.cuotas).toEqual(antes.cuotas);
  });

  it('al contado no hay cronograma que mover', () => {
    const contado = borradorInicial('01', '2026-11-03');
    const despues = cambiarFechaEmision(contado, '2026-10-29');

    expect(despues.fecha).toBe('2026-10-29');
    expect(despues.cuotas).toEqual([]);
  });
});
