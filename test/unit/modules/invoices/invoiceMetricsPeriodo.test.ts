/**
 * TA-69 (front) — barra de métricas del periodo.
 *
 * QUÉ SE PRUEBA
 *
 * La barra muestra cifras que vienen del servidor. Los errores que este archivo
 * impide son los que se ven en una demostración y no en el desarrollo:
 *
 *  1. `undefined` pintado como "NaN" en medio de un importe,
 *  2. el mes equivocado cuando se consulta de noche en Lima (UTC-5),
 *  3. mostrar un porcentaje calculado cuando en realidad no se procesó nada,
 *  4. que las cifras no cuadren entre sí (bruto − acreditado ≠ neto).
 */
import { describe, expect, it } from 'vitest';
import {
  METRICAS_VACIAS,
  esPeriodoValido,
  metricasCuadran,
  normalizarMetricas,
  periodoActual,
  type MetricasFacturacion,
} from '@/modules/invoices/lib/invoiceMetricsPeriodo';

/** Métricas coherentes de ejemplo. */
function metricas(extra: Partial<MetricasFacturacion> = {}): MetricasFacturacion {
  return {
    emitidos: 10,
    aceptados: 8,
    rechazados: 1,
    pendientes: 1,
    erroresRed: 0,
    facturadoBruto: 1180,
    acreditado: 118,
    debitado: 236,
    facturado: 1062,
    tasaAceptacion: 88.9,
    periodo: '2026-10',
    ...extra,
  };
}

describe('TA-69 - métricas del periodo (front)', () => {
  describe('periodoActual', () => {
    it('usa la fecha local y no la UTC: el 31 a las 20:00 en Lima sigue siendo octubre', () => {
      // 2026-11-01T01:00:00Z == 2026-10-31T20:00:00 en Lima.
      const enLima = new Date('2026-11-01T01:00:00Z');
      // Se construye la fecha en local para no depender de la zona de la máquina.
      const local = new Date(2026, 9, 31, 20, 0, 0);
      expect(periodoActual(local)).toBe('2026-10');
      // Y la comprobación de que toISOString() habría fallado:
      expect(enLima.toISOString().slice(0, 7)).toBe('2026-11');
    });

    it('el mes va a dos dígitos', () => {
      expect(periodoActual(new Date(2026, 0, 15))).toBe('2026-01');
      expect(periodoActual(new Date(2026, 11, 1))).toBe('2026-12');
    });
  });

  describe('esPeriodoValido', () => {
    it.each(['2026-10', '2025-01', '2026-12'])('acepta %p', (p) => {
      expect(esPeriodoValido(p)).toBe(true);
    });

    it.each(['2026-13', '2026-00', '2026-1', '26-10', '', 'abc'])(
      'rechaza %p',
      (p) => {
        expect(esPeriodoValido(p)).toBe(false);
      },
    );
  });

  describe('normalizarMetricas', () => {
    it('un campo ausente queda en 0, no en undefined', () => {
      const normal = normalizarMetricas({ emitidos: 3 }, '2026-10');
      expect(normal.emitidos).toBe(3);
      expect(normal.rechazados).toBe(0);
      expect(normal.facturado).toBe(0);
      expect(normal.tasaAceptacion).toBe(0);
    });

    it('el periodo pedido se usa cuando el backend no lo devuelve', () => {
      expect(normalizarMetricas({}, '2026-07').periodo).toBe('2026-07');
    });

    it('el periodo del backend tiene prioridad cuando viene', () => {
      expect(
        normalizarMetricas({ periodo: '2026-09' }, '2026-07').periodo,
      ).toBe('2026-09');
    });

    it('un valor no numérico no se propaga como NaN', () => {
      const normal = normalizarMetricas({
        facturado: 'mucho' as unknown as number,
        emitidos: null as unknown as number,
      });
      expect(normal.facturado).toBe(0);
      expect(normal.emitidos).toBe(0);
      expect(Number.isNaN(normal.facturado)).toBe(false);
    });

    it('normalizar el objeto vacío devuelve el mismo contrato que METRICAS_VACIAS', () => {
      expect(normalizarMetricas(null, '2026-10')).toEqual({
        ...METRICAS_VACIAS,
        periodo: '2026-10',
      });
    });

    /*
     * `erroresRed` se agregó al backend DESPUÉS del front. Si el contrato no
     * llegara (backend anterior, caché, respuesta parcial), el campo tiene que
     * quedar en 0 y nunca en `undefined`: la tarjeta lo compara con `> 0` y un
     * `undefined` la dejaría siempre oculta aunque hubiera errores.
     */
    it('erroresRed ausente se normaliza a 0, no a undefined', () => {
      const normal = normalizarMetricas({ pendientes: 3 }, '2026-10');
      expect(normal.erroresRed).toBe(0);
      expect(normal.erroresRed > 0).toBe(false);
    });

    it('erroresRed del backend se conserva', () => {
      expect(normalizarMetricas({ erroresRed: 2 }).erroresRed).toBe(2);
    });
  });

  describe('metricasCuadran', () => {
    it('bruto (incluido débito) menos acreditado debe dar el neto', () => {
      expect(metricasCuadran(metricas())).toBe(true);
    });

    it('detecta un neto inflado (el backend restó dos veces, o ninguna)', () => {
      expect(metricasCuadran(metricas({ facturado: 1180 }))).toBe(false);
    });

    it('tolera menos de un céntimo de redondeo', () => {
      expect(metricasCuadran(metricas({ facturado: 1062.005 }))).toBe(true);
    });

    it('rechaza sumar el débito por segunda vez', () => {
      expect(metricasCuadran(metricas({ facturado: 1298 }))).toBe(false);
    });

    it('las métricas vacías cuadran', () => {
      expect(metricasCuadran(METRICAS_VACIAS)).toBe(true);
    });
  });
});
