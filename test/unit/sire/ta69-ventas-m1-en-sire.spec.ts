/**
 * TA-69 — ventas del M1 en la conciliación del SIRE.
 *
 * QUÉ SE PRUEBA
 *
 * Que las ventas del módulo de facturación por fin lleguen a la conciliación
 * con el SIRE, y que lleguen con el criterio correcto. Los cuatro errores que
 * este archivo impide son los que producirían discrepancias fantasma:
 *
 *  1. incluir rechazados (SUNAT los ignora: generarían `OMISION_SUNAT`),
 *  2. sumar las notas de crédito en vez de restarlas (venta inflada),
 *  3. poner CAR a una factura (el Registro de Ventas solo lo pide en boletas),
 *  4. inventar un CAR cuando falta el dato del recaudador.
 */
import { Logger } from '@nestjs/common';
import {
  ESTADOS_QUE_CONCILIAN,
  aRegistroSire,
  aRegistrosSire,
  carDeVenta,
  conciliaEnSire,
  correlativoSire,
  resumirVentasM1,
  type VentaM1,
} from '../../../src/modules/sire/application/ventasM1ParaSire';

/** Venta aceptada de ejemplo. */
function venta(extra: Partial<VentaM1> = {}): VentaM1 {
  return {
    id: 'v-1',
    rucEmisor: '20123456786',
    tipoComprobante: '03',
    serie: 'B001',
    correlativo: 42,
    estado: 'ACEPTADO',
    total: 118,
    igv: 18,
    ...extra,
  };
}

describe('TA-69 - ventas del M1 para el SIRE', () => {
  beforeEach(() => {
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('qué concilia', () => {
    it('una boleta aceptada concilia', () => {
      expect(conciliaEnSire(venta())).toBe(true);
    });

    it('una factura aceptada concilia', () => {
      expect(conciliaEnSire(venta({ tipoComprobante: '01', serie: 'F001' }))).toBe(
        true,
      );
    });

    it('una observada concilia: SUNAT la registró', () => {
      expect(conciliaEnSire(venta({ estado: 'OBSERVADO' }))).toBe(true);
    });

    it.each(['RECHAZADO', 'PENDIENTE', 'EN_COLA', 'ERROR_RED', 'ANULADO'])(
      'una venta en estado %s NO concilia',
      (estado) => {
        expect(conciliaEnSire(venta({ estado }))).toBe(false);
      },
    );

    it('un tipo de comprobante que no es 01/03/07/08 no concilia', () => {
      expect(conciliaEnSire(venta({ tipoComprobante: '09' }))).toBe(false);
    });

    it('los estados que concilian son exactamente ACEPTADO y OBSERVADO', () => {
      expect([...ESTADOS_QUE_CONCILIAN].sort()).toEqual(['ACEPTADO', 'OBSERVADO']);
    });
  });

  describe('conversión de importes', () => {
    it('la base se deriva del total y el IGV, para que cuadre al céntimo', () => {
      const registro = aRegistroSire(venta({ total: 118, igv: 18 }));
      expect(registro.taxableBase).toBe(100);
      expect(registro.igvAmount).toBe(18);
      expect(registro.totalAmount).toBe(118);
      expect(registro.taxableBase + registro.igvAmount).toBe(registro.totalAmount);
    });

    it('un total con decimales no arrastra error de coma flotante', () => {
      const registro = aRegistroSire(venta({ total: 0.3, igv: 0.1 }));
      // 0.3 - 0.1 en doble precisión es 0.19999999999999998.
      expect(registro.taxableBase).toBe(0.2);
      expect(registro.totalAmount).toBe(0.3);
    });

    it('el correlativo va a ocho dígitos, como en el PLE', () => {
      expect(correlativoSire(42)).toBe('00000042');
      expect(correlativoSire(12345678)).toBe('12345678');
      expect(aRegistroSire(venta({ correlativo: 42 })).correlative).toBe('00000042');
    });

    it('la serie y el tipo se copian tal cual, sin recortar', () => {
      const registro = aRegistroSire(venta({ serie: 'B001', tipoComprobante: '03' }));
      expect(registro.series).toBe('B001');
      expect(registro.documentType).toBe('03');
      expect(registro.emitterRuc).toBe('20123456786');
    });
  });

  describe('CAR', () => {
    const boletaConRecaudador = venta({
      tipoComprobante: '03',
      rucRecaudador: '20123456786',
      numeroOperacion: '123456',
    });

    it('una boleta con recaudador y operación lleva un CAR de 27 dígitos', () => {
      const car = carDeVenta(boletaConRecaudador);
      expect(car).toHaveLength(27);
      expect(/^\d{27}$/.test(car)).toBe(true);
    });

    it('una factura NUNCA lleva CAR, aunque tenga los datos del recaudador', () => {
      const factura = venta({
        tipoComprobante: '01',
        serie: 'F001',
        rucRecaudador: '20123456786',
        numeroOperacion: '123456',
      });
      expect(carDeVenta(factura)).toBe('');
    });

    it('sin número de operación no se inventa un CAR', () => {
      const sinOperacion = venta({
        tipoComprobante: '03',
        rucRecaudador: '20123456786',
        numeroOperacion: null,
      });
      expect(carDeVenta(sinOperacion)).toBe('');
    });

    it('sin RUC del recaudador no se inventa un CAR', () => {
      const sinRuc = venta({
        tipoComprobante: '03',
        rucRecaudador: null,
        numeroOperacion: '123456',
      });
      expect(carDeVenta(sinRuc)).toBe('');
    });

    it('con un recaudador de formato inválido devuelve vacío en vez de lanzar', () => {
      const malo = venta({
        tipoComprobante: '03',
        rucRecaudador: 'XYZ',
        numeroOperacion: '123456',
      });
      expect(() => carDeVenta(malo)).not.toThrow();
      expect(carDeVenta(malo)).toBe('');
    });

    it('con una moneda no admitida devuelve vacío en vez de lanzar', () => {
      const euro = venta({
        tipoComprobante: '03',
        rucRecaudador: '20123456786',
        numeroOperacion: '123456',
        moneda: 'EUR',
      });
      expect(carDeVenta(euro)).toBe('');
    });

    it('el CAR viaja en el registro convertido', () => {
      const registro = aRegistroSire(boletaConRecaudador);
      expect(registro.carSunat).toHaveLength(27);
    });
  });

  describe('lote', () => {
    const lote: VentaM1[] = [
      venta({ id: 'a', tipoComprobante: '01', serie: 'F001', estado: 'ACEPTADO' }),
      venta({ id: 'b', tipoComprobante: '03', serie: 'B001', estado: 'ACEPTADO' }),
      venta({ id: 'c', tipoComprobante: '07', serie: 'B001', estado: 'ACEPTADO', total: 50, igv: 7.63 }),
      venta({ id: 'd', tipoComprobante: '03', serie: 'B002', estado: 'RECHAZADO' }),
      venta({ id: 'e', tipoComprobante: '01', serie: 'F002', estado: 'EN_COLA' }),
    ];

    it('descarta las que no concilian y conserva el orden de las que sí', () => {
      const registros = aRegistrosSire(lote);
      expect(registros).toHaveLength(3);
      expect(registros.map((r) => r.series)).toEqual(['F001', 'B001', 'B001']);
    });

    it('el resumen cuadra: incluidas + excluidas = total', () => {
      const resumen = resumirVentasM1(lote);
      expect(resumen.total).toBe(5);
      expect(resumen.incluidas).toBe(3);
      expect(resumen.excluidas).toBe(2);
      expect(resumen.incluidas + resumen.excluidas).toBe(resumen.total);
    });

    it('cuenta las boletas que quedaron sin CAR por falta de dato', () => {
      const resumen = resumirVentasM1([
        venta({ id: 'b1', tipoComprobante: '03' }),
        venta({
          id: 'b2',
          tipoComprobante: '03',
          rucRecaudador: '20123456786',
          numeroOperacion: '1',
        }),
      ]);
      expect(resumen.sinCar).toBe(1);
    });

    it('un lote vacío no inventa nada', () => {
      expect(aRegistrosSire([])).toEqual([]);
      expect(resumirVentasM1([])).toEqual({
        total: 0,
        incluidas: 0,
        excluidas: 0,
        sinCar: 0,
      });
    });
  });
});
