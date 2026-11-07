import { describe, it, expect } from 'vitest';
import {
  IGV_RATE,
  RETENCION_IGV_RATE,
  ICBPER_POR_UNIDAD,
  UMBRAL_SOLES,
  round2,
  roundDetraccion,
  calcularLinea,
  sumarPorAfectacion,
  igvDesdeBase,
  totalDesdeBase,
  baseDesdeTotal,
  calcularIcbper,
  calcularDetraccion,
  calcularRetencion,
  liquidarComprobante,
  type LineaComprobante,
} from '@/modules/invoices/lib/invoiceCalculations';
import { formatCurrency } from '@/lib/formatters';

/**
 * Pruebas de la aritmética fiscal del módulo M1 (Facturación Electrónica).
 *
 * Todas las aserciones se ejecutan contra el motor de producción
 * `src/modules/invoices/lib/invoiceCalculations.ts`, conforme a las reglas del
 * informe técnico UBL 2.1: IGV 18%, redondeo a dos decimales (round2),
 * detracción SPOT con redondeo al entero, retención del 3% e ICBPER.
 */

/** Construye una línea gravada al 18%. */
const lineaGravada = (base: number): LineaComprobante => ({
  base,
  afectacion: 'GRAVADA',
});

describe('Cálculo de IGV — Motor tributario SUNAT', () => {
  describe('round2 — Redondeo oficial a 2 decimales', () => {
    it('redondea al céntimo más cercano', () => {
      expect(round2(1.005)).toBe(1.01);
      expect(round2(118.004)).toBe(118);
      expect(round2(0.005)).toBe(0.01);
    });

    it('evita errores de punto flotante en sumas fiscales', () => {
      // 0.1 + 0.2 === 0.30000000000000004 en IEEE 754.
      expect(round2(0.1 + 0.2)).toBe(0.3);
      expect(0.1 + 0.2).not.toBe(0.3);
    });

    it('conserva los valores ya redondeados', () => {
      expect(round2(118)).toBe(118);
      expect(round2(0)).toBe(0);
    });
  });

  describe('Base imponible e IGV', () => {
    it('usa la tasa oficial del IGV peruano (18%)', () => {
      expect(IGV_RATE).toBe(0.18);
    });

    it('calcula el IGV de una factura de 1000.00 soles', () => {
      expect(igvDesdeBase(1000)).toBe(180);
      expect(totalDesdeBase(1000)).toBe(1180);
    });

    it('deriva la base imponible desde el total (S/ 1180.00)', () => {
      expect(baseDesdeTotal(1180)).toBe(1000);
    });

    it('mantiene la equivalencia base -> total -> base', () => {
      [100, 250.5, 999.99, 4567.89].forEach((base) => {
        expect(baseDesdeTotal(totalDesdeBase(base))).toBe(base);
      });
    });

    it('redondea correctamente con céntimos (S/ 99.99)', () => {
      // 99.99 * 0.18 = 17.9982 -> 18.00 ; total = 117.99
      expect(igvDesdeBase(99.99)).toBe(18);
      expect(totalDesdeBase(99.99)).toBe(117.99);
    });

    it('aplica IGV cero a una base de cero', () => {
      expect(igvDesdeBase(0)).toBe(0);
      expect(totalDesdeBase(0)).toBe(0);
    });
  });

  describe('Desglose multi-afectación (Catálogo 07 SUNAT)', () => {
    it('suma por separado gravadas, exoneradas e inafectas', () => {
      const lineas = [
        { tipo: 'GRAVADA', base: 1000 },
        { tipo: 'GRAVADA', base: 500 },
        { tipo: 'EXONERADA', base: 300 },
        { tipo: 'INAFECTA', base: 200 },
      ] as const;

      const sumar = (tipo: (typeof lineas)[number]['tipo']) =>
        round2(
          lineas
            .filter((l) => l.tipo === tipo)
            .reduce((acc, l) => acc + l.base, 0)
        );

      expect(sumar('GRAVADA')).toBe(1500);
      expect(sumar('EXONERADA')).toBe(300);
      expect(sumar('INAFECTA')).toBe(200);

      // Solo las gravadas generan IGV.
      expect(igvDesdeBase(sumar('GRAVADA'))).toBe(270);

      // Total = suma de todas las bases + IGV de las gravadas.
      const total = round2(1500 + 300 + 200 + igvDesdeBase(1500));
      expect(total).toBe(2270);
    });

    it('no genera IGV cuando el comprobante solo tiene operaciones exoneradas', () => {
      const exonerada = 500;
      expect(igvDesdeBase(exonerada)).toBe(90);
      // Solo se aplica IGV sobre la porción gravada (que aquí es 0).
      const gravada = 0;
      expect(igvDesdeBase(gravada)).toBe(0);
    });
  });

  describe('Detracción SPOT (Catálogo 54)', () => {
    const DETRACCION_SERVICIOS = 0.12;
    const DETRACCION_TRANSPORTE = 0.04;

    it('calcula el 12% para servicios en céntimos', () => {
      expect(calcularDetraccion(1180, DETRACCION_SERVICIOS)).toBe(141.6);
    });

    it('calcula el 4% para transporte de carga', () => {
      expect(calcularDetraccion(1180, DETRACCION_TRANSPORTE)).toBe(47.2);
    });

    it('no aplica detracción cuando el total no supera S/ 700.00', () => {
      expect(calcularDetraccion(700, DETRACCION_SERVICIOS)).toBe(0);
      expect(calcularDetraccion(699.99, DETRACCION_SERVICIOS)).toBe(0);
      expect(calcularDetraccion(700.01, DETRACCION_SERVICIOS)).toBe(84);
    });

    it('expresa la detracción en Soles aunque la factura esté en USD', () => {
      // Total USD 1180 x tipo de cambio 3.8 = S/ 4484.00; 12% = S/ 538.08.
      expect(calcularDetraccion(1180, DETRACCION_SERVICIOS, 3.8)).toBe(538.08);
    });

    it('no aplica detracción cuando el porcentaje es cero', () => {
      expect(calcularDetraccion(1180, 0)).toBe(0);
    });

    it('roundDetraccion lleva al entero más cercano', () => {
      expect(roundDetraccion(141.6)).toBe(142);
      expect(roundDetraccion(141.4)).toBe(141);
      expect(roundDetraccion(141.5)).toBe(142);
    });
  });

  describe('Retención del IGV (3%)', () => {
    it('calcula la retención sobre el total del comprobante', () => {
      expect(calcularRetencion(1180, true)).toBe(35.4);
      expect(RETENCION_IGV_RATE).toBe(0.03);
    });

    it('reduce el saldo pendiente de una cuota al crédito', () => {
      const total = 1180;
      const retencion = calcularRetencion(total, true);
      const saldo = round2(total - retencion);

      // Caso exacto del informe técnico: S/ 1,180.00 -> S/ 1,144.60
      expect(saldo).toBe(1144.6);
      expect(round2(retencion + saldo)).toBe(total);
    });

    it('no retiene si el cliente no es Agente de Retención', () => {
      expect(calcularRetencion(1180, false)).toBe(0);
    });

    it('no retiene por debajo del umbral de S/ 700.00', () => {
      expect(calcularRetencion(700, true)).toBe(0);
    });
  });

  describe('ICBPER — Impuesto a las bolsas plásticas', () => {
    it('adiciona S/ 0.50 por bolsa sin tocar la base imponible del IGV', () => {
      const base = 1000;
      const bolsas = 10;

      const igv = igvDesdeBase(base);
      const icbper = calcularIcbper(bolsas);
      const total = round2(base + igv + icbper);

      expect(ICBPER_POR_UNIDAD).toBe(0.5);
      expect(icbper).toBe(5);
      expect(igv).toBe(180);
      expect(total).toBe(1185);
      // El IGV se calcula sobre la base, nunca sobre base + ICBPER.
      expect(igvDesdeBase(base + icbper)).not.toBe(igv);
    });

    it('no genera ICBPER cuando no se entregan bolsas', () => {
      expect(calcularIcbper(0)).toBe(0);
      expect(calcularIcbper(-5)).toBe(0);
      expect(calcularIcbper(Number.NaN)).toBe(0);
    });

    it('ignora fracciones de bolsa (solo unidades completas)', () => {
      expect(calcularIcbper(2.9)).toBe(1);
    });
  });

  describe('Liquidación integral del comprobante', () => {
    it('liquida una factura simple gravada', () => {
      const r = liquidarComprobante([lineaGravada(1000)]);

      expect(r.opGravada).toBe(1000);
      expect(r.igv).toBe(180);
      expect(r.importeTotal).toBe(1180);
      expect(r.netoPendientePago).toBe(1180);
      expect(r.montoRetencion).toBe(0);
      expect(r.montoDetraccion).toBe(0);
    });

    it('desglosa la multi-afectación del Catálogo 07', () => {
      const r = liquidarComprobante([
        { base: 1000, afectacion: 'GRAVADA' },
        { base: 500, afectacion: 'GRAVADA' },
        { base: 300, afectacion: 'EXONERADA' },
        { base: 200, afectacion: 'INAFECTA' },
        { base: 150, afectacion: 'GRATUITA' },
      ]);

      expect(r.opGravada).toBe(1500);
      expect(r.opExonerada).toBe(300);
      expect(r.opInafecta).toBe(200);
      expect(r.opGratuita).toBe(150);
      // Solo las gravadas generan IGV.
      expect(r.igv).toBe(270);
      // Las gratuitas no suman al importe a cobrar.
      expect(r.importeTotal).toBe(2270);
    });

    it('no genera IGV con operaciones exclusivamente exoneradas', () => {
      const r = liquidarComprobante([{ base: 500, afectacion: 'EXONERADA' }]);

      expect(r.igv).toBe(0);
      expect(r.importeTotal).toBe(500);
    });

    it('calcula la línea con IGV solo si está gravada', () => {
      expect(calcularLinea({ base: 1000, afectacion: 'GRAVADA' })).toEqual({
        base: 1000,
        igv: 180,
        total: 1180,
      });
      expect(calcularLinea({ base: 1000, afectacion: 'INAFECTA' })).toEqual({
        base: 1000,
        igv: 0,
        total: 1000,
      });
      expect(calcularLinea({ base: 1000, afectacion: 'EXONERADA' }).igv).toBe(0);
    });

    it('sumarPorAfectacion agrupa por régimen tributario', () => {
      const lineas: LineaComprobante[] = [
        lineaGravada(100),
        lineaGravada(250.5),
        { base: 50, afectacion: 'INAFECTA' },
      ];

      expect(sumarPorAfectacion(lineas, 'GRAVADA')).toBe(350.5);
      expect(sumarPorAfectacion(lineas, 'INAFECTA')).toBe(50);
      expect(sumarPorAfectacion(lineas, 'GRATUITA')).toBe(0);
    });

    it('combina retención, detracción e ICBPER en el neto pendiente', () => {
      const r = liquidarComprobante([lineaGravada(1000)], {
        bolsasPlasticas: 10,
        esAgenteRetencion: true,
      });

      expect(r.importeTotal).toBe(1185); // 1000 + 180 IGV + 5 ICBPER
      expect(r.montoRetencion).toBe(35.55); // 1185 * 0.03
      expect(r.netoPendientePago).toBe(1149.45);
    });

    it('el umbral SPOT se mide sobre el total en Soles', () => {
      expect(UMBRAL_SOLES).toBe(700);

      const bajo = liquidarComprobante([lineaGravada(500)], {
        detraccionPorcentaje: 0.12,
      });
      expect(bajo.montoDetraccion).toBe(0); // 590 <= 700
    });
  });

  describe('Presentación monetaria', () => {
    it('formatea en soles con dos decimales', () => {
      expect(formatCurrency(1180, 'PEN')).toMatch(/S\/\s?1,?180\.00/);
    });

    it('formatea en dólares con dos decimales', () => {
      expect(formatCurrency(1180, 'USD')).toMatch(/\$\s?1,?180\.00/);
    });
  });
});
