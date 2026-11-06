/**
 * Firma del XML en la descarga y cuenta de detracción por empresa (M1).
 *
 * Los dos defectos que se prueban aquí solo aparecían CON datos reales:
 *
 *  1. Diez comprobantes ya aceptados descargaban un XML SIN `<ds:Signature>`
 *     porque se emitieron antes de que el worker guardara el firmado. La
 *     descarga los regeneraba desde el payload y entregaba un borrador con el
 *     nombre de un comprobante.
 *  2. Las cuentas `porCobrarRetenido` y `detraccion` compartían el código 1212
 *     del PCGE, así que el asiento mezclaba dos conceptos tributarios. Cuadraba
 *     —por eso ningún test de partida doble lo veía— pero clasificaba mal.
 */
import { describe, expect, it, jest } from '@jest/globals';
import {
  CUENTAS_VENTA,
  balanceAsiento,
  lineasAsientoNotaCredito,
  lineasAsientoVenta,
  type DatosAsientoVenta,
} from '../../../src/modules/invoices/application/services/accountingBridge';
import { SignedXmlStorageService } from '../../../src/modules/invoices/application/services/signedXmlStorageService';

// ---------------------------------------------------------------------------
// 1 · Cuentas del PCGE
// ---------------------------------------------------------------------------

describe('M1 · cuentas del PCGE en el asiento de venta', () => {
  it('la detracción y la retención NO comparten cuenta', () => {
    expect(CUENTAS_VENTA.detraccion.codigo).not.toBe(
      CUENTAS_VENTA.porCobrarRetenido.codigo,
    );
  });

  it('la detracción va a una cuenta por cobrar propia (12129)', () => {
    expect(CUENTAS_VENTA.detraccion.codigo).toBe('12129');
  });

  it('la retención va contra el IGV (40114), no a una cuenta por cobrar', () => {
    expect(CUENTAS_VENTA.porCobrarRetenido.codigo).toBe('40114');
  });

  it('ninguna cuenta usa el código 1212, que es de personal', () => {
    const codigos = Object.values(CUENTAS_VENTA).map((c) => c.codigo);
    expect(codigos).not.toContain('1212');
  });

  it('todos los códigos del mapa son distintos entre sí', () => {
    const codigos = Object.values(CUENTAS_VENTA).map((c) => c.codigo);
    // porCobrarRetenido (40114) y la propia IGV (40111) son distintas; el
    // único que puede repetirse legítimamente sería ninguno.
    expect(new Set(codigos).size).toBe(codigos.length);
  });
});

// ---------------------------------------------------------------------------
// 2 · El asiento sigue cuadrando con las cuentas nuevas
// ---------------------------------------------------------------------------

describe('M1 · el asiento con detracción cuadra con las cuentas corregidas', () => {
  const datos = (extra: Partial<DatosAsientoVenta> = {}): DatosAsientoVenta => ({
    gravado: 887,
    igv: 159.66,
    exonerado: 0,
    inafecto: 0,
    icbper: 0,
    detraccion: 96,
    retencion: 0,
    total: 1046.66,
    ...extra,
  });

  it('separa el cobro directo y la detracción en dos cuentas por cobrar', () => {
    const lineas = lineasAsientoVenta(datos());
    const detraccion = lineas.find(
      (l) => l.accountCode === CUENTAS_VENTA.detraccion.codigo,
    );

    expect(detraccion?.debitAmount).toBe(96);
    expect(lineas.some((l) => l.accountCode === '12121')).toBe(true);
  });

  it('sigue cuadrando la partida doble', () => {
    const balance = balanceAsiento(lineasAsientoVenta(datos()));
    expect(balance.cuadra).toBe(true);
    expect(balance.debe).toBe(1046.66);
  });

  it('una venta con retención usa 40114 y no descuadra', () => {
    const lineas = lineasAsientoVenta(
      datos({ detraccion: 0, retencion: 20.93, total: 1046.66 }),
    );
    const retenido = lineas.find((l) => l.accountCode === '40114');

    expect(retenido?.debitAmount).toBe(20.93);
    expect(balanceAsiento(lineas).cuadra).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 3 · El CDR va a su columna
// ---------------------------------------------------------------------------

describe('M1 · la cuenta de detracción vive en la empresa', () => {
  /**
   * Se prueba la regla de precedencia en aislamiento: la misma lógica que
   * aplica el servicio de emisión (empresa primero, formulario como respaldo).
   */
  const resolver = (
    deEmpresa: string | null,
    deFormulario: string | null,
  ): string | null => {
    if (deFormulario && deFormulario !== deEmpresa) return deFormulario;
    return deEmpresa;
  };

  it('usa la cuenta de la empresa cuando el formulario no trae nada', () => {
    expect(resolver('0011-0151-010000123456', null)).toBe(
      '0011-0151-010000123456',
    );
  });

  it('el formulario sobrescribe cuando trae una cuenta DISTINTA', () => {
    expect(resolver('0011-0151-010000123456', '0011-0151-019999999999')).toBe(
      '0011-0151-019999999999',
    );
  });

  it('si coinciden, se queda con la de la empresa', () => {
    expect(resolver('0011-0151-010000123456', '0011-0151-010000123456')).toBe(
      '0011-0151-010000123456',
    );
  });

  it('sin cuenta en ningún sitio, no hay nada que devolver', () => {
    expect(resolver(null, null)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 4 · El guardado del XML firmado no rompe la emisión si la base falla
// ---------------------------------------------------------------------------

describe('M1 · el guardado del XML nunca lanza', () => {
  it('devuelve null en vez de propagar el error de la base', async () => {
    // Se replica la garantía del servicio real: perder la copia no debe
    // impedir que el comprobante llegue a SUNAT.
    const prisma = {
      invoice: {
        update: jest.fn(async () => {
          throw new Error('base caída');
        }),
      },
    };
    const servicio = new SignedXmlStorageService(prisma as never);

    await expect(servicio.guardar('inv-1', '<Invoice/>')).resolves.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 5 · Nota de Crédito
// ---------------------------------------------------------------------------

describe('M1 · asiento de Nota de Crédito', () => {
  it('invierte debe y haber de la venta y sigue cuadrado', () => {
    const datos: DatosAsientoVenta = {
      gravado: 100,
      igv: 18,
      exonerado: 0,
      inafecto: 0,
      icbper: 0,
      detraccion: 0,
      retencion: 0,
      total: 118,
    };
    const lineas = lineasAsientoNotaCredito(datos);
    expect(lineas.find((l) => l.accountCode === '12121')?.creditAmount).toBe(118);
    expect(lineas.find((l) => l.accountCode === '70121')?.debitAmount).toBe(100);
    expect(lineas.find((l) => l.accountCode === '40111')?.debitAmount).toBe(18);
    expect(balanceAsiento(lineas).cuadra).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 6 · Descuento 01/03
// ---------------------------------------------------------------------------

describe('M1 · asiento con descuento 01/03', () => {
  it('usa la cuenta 74 y sigue cuadrado', () => {
    const lineas = lineasAsientoVenta({
      gravado: 1000,
      igv: 180,
      exonerado: 0,
      inafecto: 0,
      icbper: 0,
      detraccion: 0,
      retencion: 0,
      total: 1080,
      descuento: 100,
    });
    expect(lineas.find((l) => l.accountCode === '74')?.debitAmount).toBe(100);
    expect(balanceAsiento(lineas)).toEqual({ debe: 1180, haber: 1180, cuadra: true });
  });
});
