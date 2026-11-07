import { describe, expect, it } from 'vitest';
import {
  generarCronogramaCuotas,
  generarTramaQrSunat,
  montoEnLetrasSunat,
  validarPlazoEnvioSunat,
} from '@/modules/invoices/lib/invoiceCalculations';

describe('generarCronogramaCuotas', () => {
  it('cuadra exactamente el neto en 3 cuotas', () => {
    const cuotas = generarCronogramaCuotas(1000, 3, '2026-10-16');

    expect(cuotas).toHaveLength(3);
    expect(cuotas[0].monto).toBe(333.33);
    expect(cuotas[1].monto).toBe(333.33);
    expect(cuotas[2].monto).toBe(333.34);

    const suma = cuotas.reduce((acc, c) => acc + c.monto, 0);
    expect(Math.round(suma * 100) / 100).toBe(1000);
  });

  it('genera identificadores Cuota001, Cuota002 y vencimientos mensuales', () => {
    const cuotas = generarCronogramaCuotas(600, 2, '2026-10-16');

    expect(cuotas[0].numero).toBe('Cuota001');
    expect(cuotas[1].numero).toBe('Cuota002');
    expect(cuotas[0].vencimiento).toBe('2026-11-15');
    expect(cuotas[1].vencimiento).toBe('2026-12-15');
  });

  it('devuelve lista vacía ante montos o cuotas inválidas', () => {
    expect(generarCronogramaCuotas(0, 3, '2026-10-16')).toEqual([]);
    expect(generarCronogramaCuotas(-50, 3, '2026-10-16')).toEqual([]);
    expect(generarCronogramaCuotas(1000, 0, '2026-10-16')).toEqual([]);
  });
});

describe('validarPlazoEnvioSunat', () => {
  it('marca VIGENTE dentro de los 3 días', () => {
    const r = validarPlazoEnvioSunat('2026-10-16', '2026-10-17', '01');
    expect(r.diasMaximos).toBe(3);
    expect(r.dentroDePlazo).toBe(true);
    expect(r.estadoPlazo).toBe('VIGENTE');
  });

  it('marca POR_VENCER en el día límite', () => {
    const r = validarPlazoEnvioSunat('2026-10-16', '2026-10-20', '01');
    expect(r.estadoPlazo).toBe('POR_VENCER');
    expect(r.dentroDePlazo).toBe(true);
  });

  it('marca VENCIDO fuera del plazo', () => {
    const r = validarPlazoEnvioSunat('2026-10-16', '2026-10-25', '01');
    expect(r.estadoPlazo).toBe('VENCIDO');
    expect(r.dentroDePlazo).toBe(false);
  });

  it('otorga 7 días a los resúmenes diarios', () => {
    const r = validarPlazoEnvioSunat('2026-10-16', '2026-10-20', 'RC');
    expect(r.diasMaximos).toBe(7);
    expect(r.estadoPlazo).toBe('VIGENTE');
  });
});

describe('montoEnLetrasSunat', () => {
  it('convierte importes en soles', () => {
    expect(montoEnLetrasSunat(1180, 'PEN')).toBe(
      'SON: UN MIL CIENTO OCHENTA Y 00/100 SOLES',
    );
  });

  it('convierte importes en dólares con céntimos', () => {
    expect(montoEnLetrasSunat(2550.5, 'USD')).toBe(
      'SON: DOS MIL QUINIENTOS CINCUENTA Y 50/100 DÓLARES AMERICANOS',
    );
  });

  it('maneja el cero', () => {
    expect(montoEnLetrasSunat(0)).toBe('SON: CERO Y 00/100 SOLES');
  });
});

describe('generarTramaQrSunat', () => {
  it('produce exactamente 10 campos separados por barra', () => {
    const trama = generarTramaQrSunat({
      rucEmisor: '20601234567',
      tipo: '01',
      serie: 'F001',
      correlativo: 42,
      igv: 180,
      total: 1180,
      fecha: '2026-10-16',
      tipoDocCliente: '6',
      numDocCliente: '20100070970',
      hashCpe: 'abc=',
    });

    const campos = trama.split('|');
    expect(campos).toHaveLength(11);
    expect(campos[10]).toBe('');
    expect(trama).toBe(
      '20601234567|01|F001|42|180.00|1180.00|2026-10-16|6|20100070970|abc=|',
    );
  });
});
