/**
 * TA-68 · puente facturación → Kardex + Contabilidad.
 *
 * Lo que se protege, en orden de importancia:
 *
 *  1. El asiento CUADRA. Es la partida doble: si el debe y el haber no dan lo
 *     mismo, el asiento no puede existir. Se comprueba contra el
 *     `DoubleEntryRule` real, no contra un número escrito a mano.
 *  2. Las cuentas son las del PCGE, no nombres inventados: 12121 por cobrar,
 *     40111 el IGV, 70121/70321/70521 las bases, 74111 el ICBPER.
 *  3. Con detracción y con retención el importe cobrado al cliente baja, pero el
 *     asiento sigue cuadrando: la diferencia va a una cuenta por cobrar distinta
 *     y no desaparece.
 *  4. El Kardex mueve solo las líneas inventariables: un servicio o un código de
 *     producto vacío no genera salida de almacén. Inventar salidas descuadraría
 *     el PLE 12.1.
 *  5. Reprocesar la misma factura NO duplica ni el movimiento ni el asiento.
 *     Se comprueba con los dobles: la segunda pasada sale por la rama de
 *     idempotencia.
 */
import { describe, expect, it, jest } from '@jest/globals';
import {
  CUENTAS_VENTA,
  balanceAsiento,
  lineasAsientoVenta,
  periodoDe,
  type DatosAsientoVenta,
} from '../../../src/modules/invoices/application/services/accountingBridge';
import {
  AFECTACIONES_SIN_MOVIMIENTO,
  generaMovimiento,
  movimientosDeFactura,
} from '../../../src/modules/invoices/application/services/kardexBridge';
import { InvoiceAccountingBridgeService } from '../../../src/modules/invoices/application/services/invoiceAccountingBridgeService';
import { DoubleEntryRule } from '../../../src/modules/accounting/domain/rules/doubleEntryRule';
import { AccountingEntryEntity } from '../../../src/modules/accounting/domain/entities/accountingEntryEntity';

// ---------------------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------------------

/** Importes de una venta gravada típica: 1000 de base + 180 de IGV. */
const VENTA_GRAVADA: DatosAsientoVenta = {
  gravado: 1000,
  igv: 180,
  exonerado: 0,
  inafecto: 0,
  icbper: 0,
  detraccion: 0,
  retencion: 0,
  total: 1180,
};

/** Suma las líneas de un lado del asiento. */
const suma = (
  lineas: readonly { debitAmount: number; creditAmount: number }[],
  lado: 'debitAmount' | 'creditAmount',
): number =>
  Math.round(lineas.reduce((acc, l) => acc + l[lado], 0) * 100) / 100;

// ---------------------------------------------------------------------------
// 1 · Asiento contable de una venta
// ---------------------------------------------------------------------------

describe('TA-68 · asiento de venta según el PCGE', () => {
  it('una venta gravada de 1000 + IGV 180 emite tres líneas', () => {
    const lineas = lineasAsientoVenta(VENTA_GRAVADA);

    expect(lineas).toHaveLength(3);
    // Cargo: la cuenta por cobrar por el total.
    expect(lineas[0]).toMatchObject({
      accountCode: '12121',
      debitAmount: 1180,
      creditAmount: 0,
    });
    // Abonos: la base y el IGV por separado, no un "total" agregado.
    expect(lineas[1]).toMatchObject({
      accountCode: '70121',
      debitAmount: 0,
      creditAmount: 1000,
    });
    expect(lineas[2]).toMatchObject({
      accountCode: '40111',
      debitAmount: 0,
      creditAmount: 180,
    });
  });

  it('usa las cuentas configuradas por el mapeador de ventas', () => {
    const lineas = lineasAsientoVenta({
      ...VENTA_GRAVADA,
      cuentas: {
        porCobrar: { codigo: '121210', nombre: 'CxC configurada' },
        gravada: { codigo: '701210', nombre: 'Venta configurada' },
        igv: { codigo: '401110', nombre: 'IGV configurado' },
      },
    });
    expect(lineas.map((l) => l.accountCode)).toEqual(['121210', '701210', '401110']);
  });

  it('el asiento cuadra: debe igual a haber', () => {
    const lineas = lineasAsientoVenta(VENTA_GRAVADA);
    expect(balanceAsiento(lineas).cuadra).toBe(true);
    expect(suma(lineas, 'debitAmount')).toBe(1180);
    expect(suma(lineas, 'creditAmount')).toBe(1180);
  });

  it('el asiento pasa la regla de partida doble del módulo de contabilidad', () => {
    const lineas = lineasAsientoVenta(VENTA_GRAVADA);
    const entrada = new AccountingEntryEntity({
      companyId: 'emp-1',
      period: '2026-10',
      entryNumber: 1,
      entryDate: new Date('2026-10-31T00:00:00Z'),
      glosa: 'Venta según F001-00000143',
      sourceModule: 'M1_INVOICES',
      sourceReferenceId: 'F001-00000143',
      lines: lineas.map((l, i) => ({
        lineOrder: l.lineOrder ?? i + 1,
        accountCode: l.accountCode,
        accountName: l.accountName,
        debitAmount: l.debitAmount,
        creditAmount: l.creditAmount,
      })),
    });

    expect(() => DoubleEntryRule.validate(entrada)).not.toThrow();
  });

  it('las cuentas son las del PCGE y llevan su nombre, no solo el número', () => {
    const lineas = lineasAsientoVenta(VENTA_GRAVADA);
    for (const linea of lineas) {
      expect(linea.accountName.length).toBeGreaterThan(3);
    }
    expect(lineas.map((l) => l.accountCode)).toEqual(['12121', '70121', '40111']);
    // Y coinciden con la tabla exportada, para que no haya dos verdades.
    expect(CUENTAS_VENTA.porCobrar.codigo).toBe('12121');
    expect(CUENTAS_VENTA.igv.codigo).toBe('40111');
    expect(CUENTAS_VENTA.gravada.codigo).toBe('70121');
  });

  it('una venta con exoneradas e inafectas abre una cuenta por cada base', () => {
    const lineas = lineasAsientoVenta({
      gravado: 500,
      igv: 90,
      exonerado: 300,
      inafecto: 200,
      icbper: 0,
      detraccion: 0,
      retencion: 0,
      total: 1090,
    });

    const codigos = lineas.map((l) => l.accountCode);
    expect(codigos).toContain('70121');
    expect(codigos).toContain('70321');
    expect(codigos).toContain('70521');
    expect(balanceAsiento(lineas).cuadra).toBe(true);
  });

  it('el ICBPER se abona en la cuenta 74111 y no se mezcla con el IGV', () => {
    const lineas = lineasAsientoVenta({
      gravado: 1000,
      igv: 180,
      exonerado: 0,
      inafecto: 0,
      icbper: 10,
      detraccion: 0,
      retencion: 0,
      total: 1190,
    });

    const icbper = lineas.find((l) => l.accountCode === '74111');
    expect(icbper?.creditAmount).toBe(10);
    expect(balanceAsiento(lineas).cuadra).toBe(true);
  });

  it('con detracción baja el importe por cobrar y aparece la cuenta de SPOT', () => {
    // Total 1180, detracción 142 (12 % redondeado).
    const lineas = lineasAsientoVenta({
      gravado: 1000,
      igv: 180,
      exonerado: 0,
      inafecto: 0,
      icbper: 0,
      detraccion: 142,
      retencion: 0,
      total: 1180,
    });

    const porCobrar = lineas.find(
      (l) => l.accountCode === '12121' && l.debitAmount > 0,
    );
    // El cliente paga 1038; los 142 los deposita en el Banco de la Nación.
    expect(porCobrar?.debitAmount).toBe(1038);
    // El debe total sigue siendo 1180 y el asiento cuadra.
    expect(suma(lineas, 'debitAmount')).toBe(1180);
    expect(balanceAsiento(lineas).cuadra).toBe(true);
  });

  it('con retención del 3 % el asiento sigue cuadrando', () => {
    // 1180 × 3 % = 35.40 retenidos por el cliente.
    const lineas = lineasAsientoVenta({
      gravado: 1000,
      igv: 180,
      exonerado: 0,
      inafecto: 0,
      icbper: 0,
      detraccion: 0,
      retencion: 35.4,
      total: 1180,
    });

    expect(suma(lineas, 'debitAmount')).toBe(1180);
    expect(balanceAsiento(lineas).cuadra).toBe(true);
  });

  it('con detracción Y retención a la vez el asiento sigue cuadrando', () => {
    const lineas = lineasAsientoVenta({
      gravado: 1000,
      igv: 180,
      exonerado: 0,
      inafecto: 0,
      icbper: 0,
      detraccion: 142,
      retencion: 35.4,
      total: 1180,
    });

    expect(balanceAsiento(lineas).cuadra).toBe(true);
  });

  it('las líneas se numeran en orden desde 1', () => {
    const lineas = lineasAsientoVenta(VENTA_GRAVADA);
    expect(lineas.map((l) => l.lineOrder)).toEqual([1, 2, 3]);
  });

  it('un importe en cero no genera línea vacía', () => {
    const lineas = lineasAsientoVenta({
      gravado: 1000,
      igv: 180,
      exonerado: 0,
      inafecto: 0,
      icbper: 0,
      detraccion: 0,
      retencion: 0,
      total: 1180,
    });
    // Sin exonerado, inafecto ni ICBPER no deben aparecer sus cuentas.
    const codigos = lineas.map((l) => l.accountCode);
    expect(codigos).not.toContain('70321');
    expect(codigos).not.toContain('70521');
    expect(codigos).not.toContain('74111');
  });

  it('el periodo sale de la fecha de emisión en formato AAAA-MM', () => {
    expect(periodoDe('2026-10-31')).toBe('2026-10');
    expect(periodoDe('2026-01-05')).toBe('2026-01');
  });
});

// ---------------------------------------------------------------------------
// 2 · Movimientos de Kardex
// ---------------------------------------------------------------------------

describe('TA-68 · movimientos de Kardex de una factura', () => {
  const DOCUMENTO = {
    tipoComprobante: '01',
    serie: 'F001',
    correlativo: 143,
    fechaEmision: '2026-10-31',
  };

  it('genera una SALIDA por cada línea inventariable', () => {
    const movimientos = movimientosDeFactura(
      [
        {
          itemCode: 'CEM-001',
          descripcion: 'Cemento Portland tipo I',
          unidad: 'BG',
          cantidad: 20,
          valorUnitario: 25,
          afectacion: '10',
        },
        {
          itemCode: 'FIE-001',
          descripcion: 'Fierro corrugado 1/2"',
          unidad: 'MTR',
          cantidad: 60,
          valorUnitario: 9.5,
          afectacion: '10',
        },
      ],
      DOCUMENTO,
    );

    expect(movimientos).toHaveLength(2);
    expect(movimientos[0]).toMatchObject({
      sku: 'CEM-001',
      direction: 'SALIDA',
      // Tabla 12 de SUNAT: 01 = venta nacional.
      operation_type_code: '01',
      quantity: 20,
      unit_cost: 25,
      document_type_code: '01',
      document_serial: 'F001',
    });
  });

  it('el número de documento va con el correlativo de 8 dígitos', () => {
    const [movimiento] = movimientosDeFactura(
      [
        {
          itemCode: 'CEM-001',
          descripcion: 'Cemento',
          unidad: 'BG',
          cantidad: 1,
          valorUnitario: 25,
          afectacion: '10',
        },
      ],
      DOCUMENTO,
    );

    expect(movimiento.document_number).toBe('F001-00000143');
    // La misma cadena sirve de llave de idempotencia.
    expect(movimiento.source_reference_id).toBe('F001-00000143');
  });

  it('un servicio sin código de producto no mueve stock', () => {
    const movimientos = movimientosDeFactura(
      [
        {
          descripcion: 'Servicio de pintura',
          unidad: 'NIU',
          cantidad: 1,
          valorUnitario: 300,
          afectacion: '30',
        },
      ],
      DOCUMENTO,
    );

    expect(movimientos).toEqual([]);
  });

  it('un código vacío o en blanco tampoco mueve stock', () => {
    const movimientos = movimientosDeFactura(
      [
        {
          itemCode: '   ',
          descripcion: 'Producto sin código',
          unidad: 'NIU',
          cantidad: 1,
          valorUnitario: 10,
          afectacion: '10',
        },
      ],
      DOCUMENTO,
    );

    expect(movimientos).toEqual([]);
  });

  it('una cantidad de cero no genera movimiento', () => {
    expect(
      generaMovimiento({
        itemCode: 'CEM-001',
        descripcion: 'Cemento',
        unidad: 'BG',
        cantidad: 0,
        valorUnitario: 25,
        afectacion: '10',
      }),
    ).toBe(false);
  });

  it('las afectaciones gratuitas no se mueven y las onerosas sí', () => {
    // Las gratuitas sacan mercadería física pero el sistema no puede valuarlas
    // sin costo de referencia: se excluyen a propósito y queda documentado.
    for (const afectacion of AFECTACIONES_SIN_MOVIMIENTO) {
      expect(
        generaMovimiento({
          itemCode: 'X-1',
          descripcion: 'Regalo',
          unidad: 'NIU',
          cantidad: 1,
          valorUnitario: 10,
          afectacion,
        }),
      ).toBe(false);
    }

    // Exoneradas, inafectas y de exportación sí son mercadería real.
    for (const afectacion of ['10', '20', '30', '40']) {
      expect(
        generaMovimiento({
          itemCode: 'X-1',
          descripcion: 'Producto',
          unidad: 'NIU',
          cantidad: 1,
          valorUnitario: 10,
          afectacion,
        }),
      ).toBe(true);
    }
  });

  it('la glosa del movimiento cita el comprobante', () => {
    const [movimiento] = movimientosDeFactura(
      [
        {
          itemCode: 'CEM-001',
          descripcion: 'Cemento Portland',
          unidad: 'BG',
          cantidad: 1,
          valorUnitario: 25,
          afectacion: '10',
        },
      ],
      DOCUMENTO,
    );

    expect(movimiento.notes).toMatch(/F001-00000143/);
    expect(movimiento.notes).toMatch(/Cemento Portland/);
  });

  it('procesa Nota de Crédito de devolución generando movimiento de ENTRADA', () => {
    const movimientos = movimientosDeFactura(
      [
        {
          itemCode: 'CEM-001',
          descripcion: 'Cemento Portland',
          unidad: 'BG',
          cantidad: 2,
          valorUnitario: 25,
          afectacion: '10',
        },
      ],
      {
        tipoComprobante: '07',
        serie: 'FC01',
        correlativo: 10,
        fechaEmision: '2026-11-01',
        motivoNota: '07',
      },
    );

    expect(movimientos.length).toBe(1);
    expect(movimientos[0].direction).toBe('ENTRADA');
    expect(movimientos[0].operation_type_code).toBe('05');
  });

  it('una Nota de Débito 08 genera SALIDA de Kardex', () => {
    const movimientos = movimientosDeFactura(
      [{ itemCode: 'CEM-001', descripcion: 'Cemento', unidad: 'NIU', cantidad: 2, valorUnitario: 50, afectacion: '10' }],
      { tipoComprobante: '08', serie: 'FD01', correlativo: 3, fechaEmision: '2026-11-06' },
    );
    expect(movimientos).toHaveLength(1);
    expect(movimientos[0].direction).toBe('SALIDA');
    expect(movimientos[0].operation_type_code).toBe('01');
  });

  it('omite movimientos si la Nota de Crédito es por motivo económico / descuento', () => {
    const movimientos = movimientosDeFactura(
      [
        {
          itemCode: 'CEM-001',
          descripcion: 'Cemento Portland',
          unidad: 'BG',
          cantidad: 2,
          valorUnitario: 25,
          afectacion: '10',
        },
      ],
      {
        tipoComprobante: '07',
        serie: 'FC01',
        correlativo: 11,
        fechaEmision: '2026-11-01',
        motivoNota: '04', // Descuento global
      },
    );

    expect(movimientos).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// 3 · Servicio puente: idempotencia y no-bloqueo
// ---------------------------------------------------------------------------

describe('TA-68 · servicio puente', () => {
  /** Factura mínima para el puente. */
  function facturaPrueba() {
    return {
      id: 'inv-1',
      companyId: 'emp-1',
      tipoComprobante: '01',
      serie: 'F001',
      correlativo: 143,
      fechaEmision: '2026-10-31',
      cliente: { razonSocial: 'CONSTRUCTORA DEL NORTE S.A.C.' },
      items: [
        {
          itemCode: 'CEM-001',
          descripcion: 'Cemento Portland tipo I',
          unidad: 'BG',
          cantidad: 20,
          valorUnitario: 25,
          afectacion: '10',
        },
      ],
      importes: {
        gravado: 500,
        igv: 90,
        exonerado: 0,
        inafecto: 0,
        icbper: 0,
        detraccion: 0,
        retencion: 0,
        total: 590,
      },
    };
  }

  /** Dobles de Prisma y de los dos casos de uso. */
  function dobles(opciones: {
    productoExiste?: boolean;
    movimientoYaExiste?: boolean;
    asientoYaExiste?: boolean;
    costoVenta?: number;
    originalExiste?: boolean;
  } = {}) {
    const movimientoCreado = jest.fn<(dto: unknown) => Promise<unknown>>(
      async () => ({ id: 'mov-1' }),
    );
    const asientoCreado = jest.fn<(dto: unknown) => Promise<unknown>>(
      async () => ({ id: 'asiento-1' }),
    );

    const prisma = {
      inventoryProduct: {
        findFirst: jest.fn(async () =>
          opciones.productoExiste === false ? null : { id: 'prod-1' },
        ),
      },
      inventoryMovement: {
        findFirst: jest.fn(async () =>
          opciones.movimientoYaExiste ? { id: 'mov-0' } : null,
        ),
        findMany: jest.fn(async () => opciones.costoVenta
          ? [{ quantity: 2, previous_unit_cost: opciones.costoVenta / 2, product: { sku: 'CEM-001' } }]
          : []),
      },
      accountingEntry: {
        findFirst: jest.fn(async () =>
          opciones.asientoYaExiste ? { id: 'asiento-0' } : null,
        ),
      },
      invoice: {
        findUnique: jest.fn(async () => opciones.originalExiste === false ? null : ({ serie: 'F001', correlativo: 100 })),
      },
    };

    const puente = new InvoiceAccountingBridgeService(
      prisma as never,
      { execute: movimientoCreado } as never,
      { execute: asientoCreado } as never,
    );

    return { puente, prisma, movimientoCreado, asientoCreado };
  }

  it('registra el movimiento de Kardex y crea el asiento', async () => {
    const { puente, movimientoCreado, asientoCreado } = dobles();

    const resultado = await puente.registrar(facturaPrueba());

    expect(resultado.completo).toBe(true);
    expect(resultado.movimientosRegistrados).toBe(1);
    expect(resultado.asientoId).toBe('asiento-1');
    expect(movimientoCreado).toHaveBeenCalledTimes(1);
    expect(asientoCreado).toHaveBeenCalledTimes(1);
  });

  it('contabiliza el costo de ventas con la salida de almacén', async () => {
    const { puente, asientoCreado } = dobles({ costoVenta: 600 });
    const resultado = await puente.registrar(facturaPrueba());
    expect(resultado.costoVenta).toBe(600);
    expect(resultado.asientoCostoId).toBe('asiento-1');
    expect(asientoCreado).toHaveBeenCalledTimes(2);
  });

  it('revierte el costo original en una nota de crédito por devolución', async () => {
    const { puente, asientoCreado } = dobles({ costoVenta: 600 });
    const resultado = await puente.registrar({
      ...facturaPrueba(),
      tipoComprobante: '07',
      motivoNota: '06',
      documentoAfectadoId: 'inv-original',
    });
    expect(resultado.costoVenta).toBe(-6000);
    expect(resultado.asientoCostoId).toBe('asiento-1');
    expect(asientoCreado).toHaveBeenCalledTimes(2);
  });

  it('avisa si la nota no tiene comprobante original para revertir costo', async () => {
    const { puente } = dobles();
    const resultado = await puente.registrar({ ...facturaPrueba(), tipoComprobante: '07', motivoNota: '06' });
    expect(resultado.errores.join(' ')).toContain('falta el comprobante original');
  });

  it('avisa si el comprobante original de la nota no existe', async () => {
    const { puente } = dobles({ originalExiste: false });
    const resultado = await puente.registrar({ ...facturaPrueba(), tipoComprobante: '07', motivoNota: '06', documentoAfectadoId: 'inv-original' });
    expect(resultado.errores.join(' ')).toContain('el comprobante original no existe');
  });

  it('no genera costo si la venta original no tuvo salida valorizada', async () => {
    const { puente } = dobles();
    const resultado = await puente.registrar({ ...facturaPrueba(), tipoComprobante: '07', motivoNota: '06', documentoAfectadoId: 'inv-original' });
    expect(resultado.costoVenta).toBe(0);
  });

  it('con bloqueo contable conserva Kardex y avisa sin crear asiento', async () => {
    const { puente, movimientoCreado, asientoCreado } = dobles();
    const resultado = await puente.registrar({ ...facturaPrueba(), motivoBloqueoAsiento: 'Contabilidad: asiento automático bloqueado por descuento 01/03; requiere revisión contable.' });
    expect(movimientoCreado).toHaveBeenCalledTimes(1);
    expect(asientoCreado).not.toHaveBeenCalled();
    expect(resultado.asientoOmitido).toBe(true);
    expect(resultado.completo).toBe(false);
    expect(resultado.errores).toContain('Contabilidad: asiento automático bloqueado por descuento 01/03; requiere revisión contable.');
  });

  it('el asiento recibe el módulo de origen y la referencia del comprobante', async () => {
    const { puente, asientoCreado } = dobles();

    await puente.registrar(facturaPrueba());

    const dto = asientoCreado.mock.calls[0][0] as unknown as {
      sourceModule: string;
      sourceReferenceId: string;
      period: string;
      lines: readonly { accountCode: string }[];
    };

    expect(dto.sourceModule).toBe('M1_INVOICES');
    expect(dto.sourceReferenceId).toBe('inv-1');
    expect(dto.idempotencyKey).toBe('m1:invoice:inv-1');
    expect(dto.period).toBe('2026-10');
    expect(dto.lines.map((l) => l.accountCode)).toContain('12121');
  });

  it('reprocesar la factura NO duplica el movimiento de Kardex', async () => {
    const { puente, movimientoCreado } = dobles({ movimientoYaExiste: true });

    const resultado = await puente.registrar(facturaPrueba());

    expect(resultado.movimientosRegistrados).toBe(0);
    expect(resultado.movimientosOmitidos).toBe(1);
    expect(movimientoCreado).not.toHaveBeenCalled();
  });

  it('reprocesar la factura NO duplica el asiento contable', async () => {
    const { puente, asientoCreado } = dobles({ asientoYaExiste: true });

    const resultado = await puente.registrar(facturaPrueba());

    expect(resultado.asientoOmitido).toBe(true);
    expect(resultado.asientoId).toBe('asiento-0');
    expect(asientoCreado).not.toHaveBeenCalled();
  });

  it('un producto que no está en el inventario se informa pero no rompe la factura', async () => {
    const { puente } = dobles({ productoExiste: false });

    const resultado = await puente.registrar(facturaPrueba());

    // La factura ya está aceptada por SUNAT: el puente informa, no lanza.
    expect(resultado.completo).toBe(false);
    expect(resultado.errores.join(' ')).toMatch(/Kardex CEM-001/);
    // El asiento sí se creó: la venta existe aunque el producto no esté en el
    // almacén.
    expect(resultado.asientoId).toBe('asiento-1');
  });

  it('un fallo contable no impide registrar el Kardex', async () => {
    const { puente, asientoCreado } = dobles();
    asientoCreado.mockRejectedValueOnce(new Error('periodo cerrado'));

    const resultado = await puente.registrar(facturaPrueba());

    expect(resultado.movimientosRegistrados).toBe(1);
    expect(resultado.completo).toBe(false);
    expect(resultado.errores.join(' ')).toMatch(/periodo cerrado/);
  });

  it('la glosa del asiento cita el comprobante y el cliente', async () => {
    const { puente, asientoCreado } = dobles();

    await puente.registrar(facturaPrueba());

    const dto = asientoCreado.mock.calls[0][0] as unknown as { glosa: string };
    expect(dto.glosa).toContain('F001-00000143');
    expect(dto.glosa).toContain('CONSTRUCTORA DEL NORTE');
  });
});
