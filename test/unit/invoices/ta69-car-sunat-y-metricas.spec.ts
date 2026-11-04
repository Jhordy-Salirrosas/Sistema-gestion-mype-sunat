/**
 * TA-69 · CAR de SUNAT y métricas del módulo.
 *
 * Lo que se protege:
 *
 *  1. El CAR tiene exactamente 27 dígitos y su anatomía es la que exige SUNAT:
 *     moneda, par reservado, tipo de operación, RUC del recaudador y número de
 *     depósito. Un CAR con un dígito de más o de menos hace rechazar el registro.
 *  2. Si falta un dato, se lanza. Rellenar con ceros un campo que el usuario no
 *     informó produce un depósito atribuido a otra operación, que es peor que
 *     un error visible.
 *  3. Las métricas restan las notas de crédito y no cuentan los rechazados como
 *     venta. Un resumen que suma todo da una cifra inflada y falsa.
 *  4. El rango del periodo cierra bien los meses de 30, 31 y 28 días.
 */
import { describe, expect, it } from '@jest/globals';
import { BadRequestException } from '@nestjs/common';
import {
  LONGITUD_CAR,
  construirCar,
  descomponerCar,
  esCarValido,
  rucRecaudadorCar,
} from '../../../src/modules/sire/application/sireCarService';
import {
  calcularMetricas,
  expandirGrupos,
  periodoActual,
  rangoDelPeriodo,
} from '../../../src/modules/invoices/application/services/invoiceMetricsService';

// ---------------------------------------------------------------------------
// 1 · CAR de SUNAT
// ---------------------------------------------------------------------------

describe('TA-69 · código CAR de SUNAT', () => {
  it('el CAR tiene exactamente 27 dígitos', () => {
    const car = construirCar({
      moneda: 'PEN',
      rucRecaudador: '20131312955',
      numeroOperacion: '123456789',
    });

    expect(car).toHaveLength(LONGITUD_CAR);
    expect(esCarValido(car)).toBe(true);
  });

  it('el primer dígito es la moneda: 1 soles y 2 dólares', () => {
    const soles = construirCar({
      moneda: 'PEN',
      rucRecaudador: '20131312955',
      numeroOperacion: '1',
    });
    const dolares = construirCar({
      moneda: 'USD',
      rucRecaudador: '20131312955',
      numeroOperacion: '1',
    });

    expect(soles[0]).toBe('1');
    expect(dolares[0]).toBe('2');
  });

  it('el par reservado va en 00', () => {
    const car = construirCar({
      moneda: 'PEN',
      rucRecaudador: '20131312955',
      numeroOperacion: '1',
    });

    expect(car.slice(1, 3)).toBe('00');
  });

  it('el número de operación se rellena con ceros a la izquierda', () => {
    const car = construirCar({
      moneda: 'PEN',
      rucRecaudador: '20131312955',
      numeroOperacion: '42',
    });

    const partes = descomponerCar(car);
    expect(partes?.operacion).toBe('42'.padStart(19, '0'));
  });

  it('el CAR se descompone en sus partes', () => {
    const car = construirCar({
      moneda: 'USD',
      rucRecaudador: '20131312955',
      numeroOperacion: '987654321',
    });

    const partes = descomponerCar(car);
    expect(partes?.moneda).toBe('2');
    expect(partes?.parReservado).toBe('00');
    expect(partes?.tipoOperacion).toBe('1');
    expect(partes).not.toBeNull();
  });

  it('una moneda que no está en el catálogo se rechaza', () => {
    expect(() =>
      construirCar({
        moneda: 'EUR',
        rucRecaudador: '20131312955',
        numeroOperacion: '1',
      }),
    ).toThrow(BadRequestException);
  });

  it('un RUC de recaudador que no tiene 11 dígitos se rechaza', () => {
    expect(() => rucRecaudadorCar('12345')).toThrow(/11 dígitos/);
  });

  it('un número de operación vacío se rechaza en lugar de rellenarse', () => {
    // Es la regla clave: no se inventa un depósito que no existe.
    expect(() =>
      construirCar({
        moneda: 'PEN',
        rucRecaudador: '20131312955',
        numeroOperacion: '',
      }),
    ).toThrow(/obligatorio/);
  });

  it('un número de operación que no cabe en 19 dígitos se rechaza', () => {
    expect(() =>
      construirCar({
        moneda: 'PEN',
        rucRecaudador: '20131312955',
        numeroOperacion: '1'.repeat(20),
      }),
    ).toThrow(/19/);
  });

  it('un tipo de operación no soportado se rechaza', () => {
    expect(() =>
      construirCar({
        moneda: 'PEN',
        rucRecaudador: '20131312955',
        numeroOperacion: '1',
        tipoOperacion: '2',
      }),
    ).toThrow(/solo el 1/);
  });

  it('el número de operación con separadores se limpia antes de usarse', () => {
    const car = construirCar({
      moneda: 'PEN',
      rucRecaudador: '20131312955',
      numeroOperacion: '001-2345678',
    });

    // Solo los dígitos: 0012345678.
    expect(descomponerCar(car)?.operacion.trim().replace(/^0+/, '')).toBe(
      '12345678',
    );
  });

  it('un CAR que no tiene 27 dígitos no se considera válido', () => {
    expect(esCarValido('123')).toBe(false);
    expect(esCarValido('1'.repeat(27))).toBe(true);
    expect(esCarValido('1'.repeat(28))).toBe(false);
    expect(esCarValido('1'.repeat(26) + 'A')).toBe(false);
  });

  it('descomponer uno inválido devuelve null en lugar de lanzar', () => {
    expect(descomponerCar('abc')).toBeNull();
    expect(descomponerCar('')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 2 · Métricas del periodo
// ---------------------------------------------------------------------------

describe('TA-69 · métricas de facturación', () => {
  it('suma facturas y boletas como importe facturado', () => {
    const metricas = calcularMetricas(
      [
        { tipoComprobante: '01', estado: 'ACEPTADO', total: 1180 },
        { tipoComprobante: '03', estado: 'ACEPTADO', total: 590 },
      ],
      '2026-10',
    );

    expect(metricas.facturadoBruto).toBe(1770);
    expect(metricas.facturado).toBe(1770);
    expect(metricas.aceptados).toBe(2);
  });

  it('las notas de crédito RESTAN del importe facturado', () => {
    const metricas = calcularMetricas(
      [
        { tipoComprobante: '01', estado: 'ACEPTADO', total: 1180 },
        { tipoComprobante: '07', estado: 'ACEPTADO', total: 180 },
      ],
      '2026-10',
    );

    // Sin restar, el resumen diría 1360 de venta cuando la venta neta es 1180.
    expect(metricas.acreditado).toBe(180);
    expect(metricas.facturado).toBe(1000);
    expect(metricas.facturadoBruto).toBe(1180);
  });

  it('las notas de débito SUMAN al importe facturado', () => {
    const metricas = calcularMetricas(
      [
        { tipoComprobante: '01', estado: 'ACEPTADO', total: 1180 },
        { tipoComprobante: '08', estado: 'ACEPTADO', total: 35.4 },
      ],
      '2026-10',
    );

    expect(metricas.debitado).toBe(35.4);
    expect(metricas.facturado).toBe(1215.4);
  });

  it('los rechazados no cuentan como venta', () => {
    const metricas = calcularMetricas(
      [
        { tipoComprobante: '01', estado: 'ACEPTADO', total: 1180 },
        { tipoComprobante: '01', estado: 'RECHAZADO', total: 5000 },
      ],
      '2026-10',
    );

    // Un comprobante rechazado no existe ante SUNAT: contarlo es cómodo y falso.
    expect(metricas.facturado).toBe(1180);
    expect(metricas.rechazados).toBe(1);
    expect(metricas.emitidos).toBe(1);
  });

  it('los anulados no cuentan para nada', () => {
    const metricas = calcularMetricas(
      [{ tipoComprobante: '01', estado: 'ANULADO', total: 900 }],
      '2026-10',
    );

    expect(metricas.emitidos).toBe(0);
    expect(metricas.facturado).toBe(0);
    expect(metricas.rechazados).toBe(0);
  });

  /*
   * CAMBIO DE CRITERIO (3 nov): `ERROR_RED` deja de contarse como emitido.
   *
   * Antes este test fijaba `emitidos = 3` contando también el ERROR_RED. Con la
   * base real eso significaba que una factura que nunca llegó a SUNAT sostenía
   * la cifra de venta y la tasa de aceptación. Un error de red no es una venta
   * confirmada ni un rechazo: se informa aparte y su importe NO se factura.
   */
  it('cuenta los pendientes por separado', () => {
    const metricas = calcularMetricas(
      [
        { tipoComprobante: '01', estado: 'EN_COLA', total: 100 },
        { tipoComprobante: '01', estado: 'ERROR_RED', total: 200 },
        { tipoComprobante: '01', estado: 'ACEPTADO', total: 300 },
      ],
      '2026-10',
    );

    expect(metricas.pendientes).toBe(2);
    // EN_COLA + ACEPTADO; el ERROR_RED va en su propio contador.
    expect(metricas.emitidos).toBe(2);
    expect(metricas.erroresRed).toBe(1);
    // El importe del error de red queda fuera de lo facturado.
    expect(metricas.facturado).toBe(400);
  });

  it('la tasa de aceptación es el porcentaje de procesados aceptados', () => {
    const metricas = calcularMetricas(
      [
        { tipoComprobante: '01', estado: 'ACEPTADO', total: 100 },
        { tipoComprobante: '01', estado: 'ACEPTADO', total: 100 },
        { tipoComprobante: '01', estado: 'ACEPTADO', total: 100 },
        { tipoComprobante: '01', estado: 'RECHAZADO', total: 100 },
      ],
      '2026-10',
    );

    // 3 aceptados de 4 procesados = 75 %.
    expect(metricas.tasaAceptacion).toBe(75);
  });

  it('sin comprobantes procesados la tasa es cero y no NaN', () => {
    const metricas = calcularMetricas([], '2026-10');
    expect(metricas.tasaAceptacion).toBe(0);
    expect(metricas.facturado).toBe(0);
  });

  it('un comprobante observado cuenta como aceptado para la tasa', () => {
    const metricas = calcularMetricas(
      [{ tipoComprobante: '01', estado: 'OBSERVADO', total: 100 }],
      '2026-10',
    );

    expect(metricas.aceptados).toBe(1);
    expect(metricas.tasaAceptacion).toBe(100);
  });

  it('los importes no arrastran error de coma flotante', () => {
    const metricas = calcularMetricas(
      [
        { tipoComprobante: '01', estado: 'ACEPTADO', total: 0.1 },
        { tipoComprobante: '01', estado: 'ACEPTADO', total: 0.2 },
      ],
      '2026-10',
    );

    expect(metricas.facturado).toBe(0.3);
  });

  it('las métricas devuelven el periodo consultado', () => {
    expect(calcularMetricas([], '2026-09').periodo).toBe('2026-09');
  });
});

// ---------------------------------------------------------------------------
// 2b · Expansión de los grupos de Prisma
//
// Estos casos cubren el defecto que las tarjetas de la bandeja mostraron el
// 1 de noviembre: las métricas decían "3 aceptadas, 1 rechazada, 75 %" con 23
// comprobantes en la base (18 aceptados, 5 rechazados). La causa no estaba en
// la aritmética de `calcularMetricas` —probada arriba— sino en que recibía los
// grupos de `groupBy`, que son una fila por combinación y no por comprobante.
// ---------------------------------------------------------------------------

describe('TA-69 · expansión de grupos antes de calcular', () => {
  it('un grupo con 14 comprobantes produce 14 filas, no una', () => {
    const filas = expandirGrupos([
      { tipo_comprobante: '01', estado: 'ACEPTADO', _sum: { monto_total: 1400 }, _count: { _all: 14 } },
    ]);

    expect(filas).toHaveLength(14);
    // El importe se reparte y la suma se conserva al céntimo.
    const suma = filas.reduce((acumulado, fila) => acumulado + fila.total, 0);
    expect(Math.round(suma * 100) / 100).toBe(1400);
  });

  it('reproduce el caso real del 1 de noviembre y da 18 y 5', () => {
    // Estos son los cuatro grupos que devolvió PostgreSQL con los datos reales.
    const filas = expandirGrupos([
      { tipo_comprobante: '01', estado: 'ACEPTADO', _sum: { monto_total: 9420.62 }, _count: { _all: 14 } },
      { tipo_comprobante: '01', estado: 'RECHAZADO', _sum: { monto_total: 42.48 }, _count: { _all: 5 } },
      { tipo_comprobante: '03', estado: 'ACEPTADO', _sum: { monto_total: 177 }, _count: { _all: 2 } },
      { tipo_comprobante: '07', estado: 'ACEPTADO', _sum: { monto_total: 59 }, _count: { _all: 2 } },
    ]);

    const metricas = calcularMetricas(filas, '2026-11');

    // Antes: aceptados === 3 y rechazados === 1, que es lo que se veía en pantalla.
    expect(metricas.aceptados).toBe(18);
    expect(metricas.rechazados).toBe(5);
    expect(metricas.emitidos).toBe(18);
    // 18 aceptados sobre 23 procesados = 78,26 %.
    expect(metricas.tasaAceptacion).toBe(78.26);
  });

  it('el importe facturado no cambia al expandir los grupos', () => {
    const grupos = [
      { tipo_comprobante: '01', estado: 'ACEPTADO', _sum: { monto_total: 9420.62 }, _count: { _all: 14 } },
      { tipo_comprobante: '03', estado: 'ACEPTADO', _sum: { monto_total: 177 }, _count: { _all: 2 } },
      { tipo_comprobante: '07', estado: 'ACEPTADO', _sum: { monto_total: 59 }, _count: { _all: 2 } },
    ];

    const metricas = calcularMetricas(expandirGrupos(grupos), '2026-11');

    expect(metricas.facturadoBruto).toBe(9597.62);
    expect(metricas.acreditado).toBe(59);
    // 9420,62 + 177 − 59 = 9538,62.
    expect(metricas.facturado).toBe(9538.62);
  });

  it('un grupo sin conteo se trata como un solo documento', () => {
    // Si Prisma no devolviera `_count`, colapsar a cero perdería el documento;
    // colapsar a uno es la lectura conservadora.
    const filas = expandirGrupos([
      { tipo_comprobante: '01', estado: 'ACEPTADO', _sum: { monto_total: 500 } },
    ]);

    expect(filas).toHaveLength(1);
    expect(filas[0]?.total).toBe(500);
  });

  it('un grupo con conteo cero se descarta', () => {
    const filas = expandirGrupos([
      { tipo_comprobante: '01', estado: 'ACEPTADO', _sum: { monto_total: 0 }, _count: { _all: 0 } },
    ]);

    expect(filas).toHaveLength(0);
  });

  it('un monto que no es número no rompe la suma', () => {
    const filas = expandirGrupos([
      { tipo_comprobante: '01', estado: 'ACEPTADO', _sum: { monto_total: null }, _count: { _all: 2 } },
    ]);

    expect(filas).toHaveLength(2);
    expect(filas.every((fila) => fila.total === 0)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 3 · Periodo
// ---------------------------------------------------------------------------

describe('TA-69 · rango del periodo', () => {
  it('el rango de un mes de 31 días llega hasta el siguiente', () => {
    const { desde, hasta } = rangoDelPeriodo('2026-10');
    expect(desde.toISOString().slice(0, 10)).toBe('2026-10-01');
    expect(hasta.toISOString().slice(0, 10)).toBe('2026-11-01');
  });

  it('el rango de un mes de 30 días está bien cerrado', () => {
    const { desde, hasta } = rangoDelPeriodo('2026-11');
    expect(desde.toISOString().slice(0, 10)).toBe('2026-11-01');
    expect(hasta.toISOString().slice(0, 10)).toBe('2026-12-01');
  });

  it('febrero no se desborda', () => {
    const { hasta } = rangoDelPeriodo('2026-02');
    expect(hasta.toISOString().slice(0, 10)).toBe('2026-03-01');
  });

  it('diciembre pasa al año siguiente sin caso especial', () => {
    const { desde, hasta } = rangoDelPeriodo('2026-12');
    expect(desde.toISOString().slice(0, 10)).toBe('2026-12-01');
    expect(hasta.toISOString().slice(0, 10)).toBe('2027-01-01');
  });

  it('el periodo actual tiene formato YYYY-MM', () => {
    expect(periodoActual()).toMatch(/^\d{4}-\d{2}$/);
  });
});
