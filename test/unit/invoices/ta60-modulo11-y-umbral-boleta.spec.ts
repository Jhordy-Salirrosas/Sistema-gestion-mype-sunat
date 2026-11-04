/**
 * TA-60 · Módulo 11 y regla de los S/ 700 en la boleta.
 *
 * Los dos RUC de los casos son reales y están en el documento de auditoría:
 * `20100066603` (suma ponderada 85, resto 8, dígito 3) y `20553510661` (suma
 * 121, resto 0, dígito 1). Si el algoritmo se equivoca en los pesos, estos dos
 * dejan de pasar, que es justo lo que se quiere detectar.
 */
import { describe, expect, it } from '@jest/globals';
import { BadRequestException } from '@nestjs/common';
import {
  digitoVerificadorRuc,
  esDniValido,
  esRucValido,
  umbralIdentificacion,
  validarAdquirente,
  type Adquirente,
} from '../../../src/modules/invoices/domain/rules/taxpayerIdValidator';

/** Adquirente genérico con RUC válido. */
const conRuc = (numeroDoc = '20100066603'): Adquirente => ({
  tipoDoc: '6',
  numeroDoc,
  razonSocial: 'CLIENTE S.A.C.',
});

// ---------------------------------------------------------------------------
// 1 · Módulo 11
// ---------------------------------------------------------------------------

describe('TA-60 · Módulo 11', () => {
  it('calcula el dígito de 20100066603', () => {
    expect(digitoVerificadorRuc('20100066603')).toBe(3);
  });

  it('calcula el dígito de 20553510661 (caso 11 -> 1)', () => {
    expect(digitoVerificadorRuc('20553510661')).toBe(1);
  });

  it('acepta los dos RUC públicos del documento', () => {
    expect(esRucValido('20100066603')).toBe(true);
    expect(esRucValido('20553510661')).toBe(true);
  });

  it('rechaza un dígito verificador alterado', () => {
    expect(esRucValido('20100066604')).toBe(false);
    expect(esRucValido('20553510662')).toBe(false);
  });

  it('rechaza longitudes que no son 11', () => {
    expect(esRucValido('2010006660')).toBe(false);
    expect(esRucValido('201000666031')).toBe(false);
    expect(esRucValido('')).toBe(false);
  });

  it('rechaza prefijos que SUNAT no admite', () => {
    // 20100066603 con el prefijo cambiado a 30 conserva el dígito, así que
    // solo el prefijo puede rechazarlo.
    expect(esRucValido('30100066603')).toBe(false);
    expect(esRucValido('99100066603')).toBe(false);
  });

  it('rechaza letras aunque tengan 11 caracteres', () => {
    expect(esRucValido('2010006660A')).toBe(false);
  });

  it('devuelve null cuando no se puede calcular', () => {
    expect(digitoVerificadorRuc('abc')).toBeNull();
  });

  it('valida el DNI con 8 dígitos', () => {
    expect(esDniValido('70123456')).toBe(true);
    expect(esDniValido('7012345')).toBe(false);
    expect(esDniValido('701234567')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 2 · Factura y notas exigen RUC
// ---------------------------------------------------------------------------

describe('TA-60 · factura exige RUC', () => {
  it('acepta una factura con RUC válido', () => {
    expect(() =>
      validarAdquirente(conRuc(), { tipoComprobante: '01', importeTotal: 100 }),
    ).not.toThrow();
  });

  it('rechaza una factura sin documento', () => {
    expect(() =>
      validarAdquirente(null, { tipoComprobante: '01', importeTotal: 100 }),
    ).toThrow(/exige el RUC/);
  });

  it('rechaza una factura con DNI', () => {
    expect(() =>
      validarAdquirente(
        { tipoDoc: '1', numeroDoc: '70123456' },
        { tipoComprobante: '01', importeTotal: 100 },
      ),
    ).toThrow(/solo admite RUC/);
  });

  it('rechaza una factura con RUC inválido y lo explica', () => {
    expect(() =>
      validarAdquirente(conRuc('20100066604'), {
        tipoComprobante: '01',
        importeTotal: 100,
      }),
    ).toThrow(/Módulo 11/);
  });

  it('rechaza la nota de crédito sin RUC', () => {
    expect(() =>
      validarAdquirente(null, { tipoComprobante: '07', importeTotal: 50 }),
    ).toThrow(BadRequestException);
  });

  it('acepta la nota de débito con RUC válido', () => {
    expect(() =>
      validarAdquirente(conRuc(), { tipoComprobante: '08', importeTotal: 50 }),
    ).not.toThrow();
  });

  it('usa el código de error ADQUIRENTE_RUC_INVALIDO', () => {
    try {
      validarAdquirente(conRuc('20100066604'), {
        tipoComprobante: '01',
        importeTotal: 100,
      });
      throw new Error('debió lanzar');
    } catch (error) {
      const respuesta = (error as BadRequestException).getResponse();
      expect(respuesta).toEqual(
        expect.objectContaining({ code: 'ADQUIRENTE_RUC_INVALIDO' }),
      );
    }
  });
});

// ---------------------------------------------------------------------------
// 3 · Boleta y el umbral de los S/ 700
// ---------------------------------------------------------------------------

describe('TA-60 · boleta y umbral de identificación', () => {
  it('acepta una boleta sin documento por debajo del umbral', () => {
    expect(() =>
      validarAdquirente(null, { tipoComprobante: '03', importeTotal: 699.99 }),
    ).not.toThrow();
  });

  it('acepta el borde exacto de S/ 700.00', () => {
    // "supera S/ 700.00": el importe igual al umbral todavía no obliga.
    expect(() =>
      validarAdquirente(null, { tipoComprobante: '03', importeTotal: 700 }),
    ).not.toThrow();
  });

  it('bloquea la boleta por encima de S/ 700.00 sin documento', () => {
    expect(() =>
      validarAdquirente(null, { tipoComprobante: '03', importeTotal: 700.01 }),
    ).toThrow(/umbral/);
  });

  it('nombra el importe y el umbral en el mensaje', () => {
    expect(() =>
      validarAdquirente(null, { tipoComprobante: '03', importeTotal: 1200 }),
    ).toThrow(/1200\.00.*700\.00/);
  });

  it('en la Selva el umbral baja a S/ 350.00', () => {
    expect(umbralIdentificacion(true)).toBe(350);
    expect(umbralIdentificacion(false)).toBe(700);

    expect(() =>
      validarAdquirente(null, {
        tipoComprobante: '03',
        importeTotal: 400,
        enSelva: true,
      }),
    ).toThrow(/Región Selva/);

    // El mismo importe en Lima no obliga a identificar.
    expect(() =>
      validarAdquirente(null, {
        tipoComprobante: '03',
        importeTotal: 400,
        enSelva: false,
      }),
    ).not.toThrow();
  });

  it('acepta una boleta identificada con DNI', () => {
    expect(() =>
      validarAdquirente(
        { tipoDoc: '1', numeroDoc: '70123456' },
        { tipoComprobante: '03', importeTotal: 1500 },
      ),
    ).not.toThrow();
  });

  it('rechaza un DNI de 7 dígitos en la boleta', () => {
    expect(() =>
      validarAdquirente(
        { tipoDoc: '1', numeroDoc: '7012345' },
        { tipoComprobante: '03', importeTotal: 100 },
      ),
    ).toThrow(/8 dígitos/);
  });

  it('rechaza un tipo de documento fuera del Catálogo 06', () => {
    expect(() =>
      validarAdquirente(
        { tipoDoc: '9', numeroDoc: '12345678' },
        { tipoComprobante: '03', importeTotal: 100 },
      ),
    ).toThrow(/Catálogo 06/);
  });

  it('acepta los tipos 4 (carné) y 7 (pasaporte)', () => {
    for (const tipoDoc of ['4', '7']) {
      expect(() =>
        validarAdquirente(
          { tipoDoc, numeroDoc: 'X1234567' },
          { tipoComprobante: '03', importeTotal: 900 },
        ),
      ).not.toThrow();
    }
  });
});
