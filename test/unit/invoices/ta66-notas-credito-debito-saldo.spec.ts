/**
 * TA-66 · notas de crédito y débito con control de saldo.
 *
 * Lo que se protege, en orden de importancia:
 *
 *  1. **Una Nota de Crédito no puede devolver más de lo que vale la factura.**
 *     SUNAT acepta cada nota por separado y el exceso aparece recién en la
 *     determinación del impuesto, así que este control es el único que existe.
 *     El exceso responde 409, no 400: es un conflicto con el estado del
 *     comprobante.
 *  2. Los motivos son códigos de los Catálogos 09 y 10, no texto libre. Un
 *     motivo del catálogo equivocado hace que la nota se rechace aunque el XML
 *     esté bien formado.
 *  3. Los motivos de anulación y devolución TOTAL toman el saldo entero: pedir
 *     el importe dejaría dos fuentes de verdad para el mismo número.
 *  4. Solo un comprobante ACEPTADO u OBSERVADO admite notas.
 *  5. Las notas rechazadas o anuladas no consumen saldo: no existen ante SUNAT.
 */
import { describe, expect, it, jest } from '@jest/globals';
import { BadRequestException, ConflictException } from '@nestjs/common';
import {
  saldoDisponible,
  verificarSaldoNota,
} from '../../../src/modules/invoices/application/services/creditNoteBalanceGuard';
import {
  CATALOGO_09_MOTIVOS,
  CATALOGO_10_MOTIVOS,
  InvoiceNoteService,
} from '../../../src/modules/invoices/application/services/invoiceNoteService';

// ---------------------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------------------

/**
 * Construye el servicio con dobles de Prisma.
 *
 * `notas` son las Notas de Crédito ya emitidas contra el comprobante; su suma es
 * lo que consume el saldo.
 */
function servicio(opciones: {
  estado?: string;
  total?: number;
  notas?: readonly number[];
  noExiste?: boolean;
} = {}) {
  const {
    estado = 'ACEPTADO',
    total = 1180,
    notas = [],
    noExiste = false,
  } = opciones;

  const findFirst = jest.fn<(args: unknown) => Promise<unknown>>(async () =>
    noExiste
      ? null
      : {
          id: 'inv-1',
          estado,
          serie: 'F001',
          correlativo: 143,
          monto_total: total,
        },
  );

  const findMany = jest.fn<(args: unknown) => Promise<unknown>>(async () =>
    notas.map((monto) => ({ monto_total: monto })),
  );

  const prisma = {
    invoice: { findFirst, findMany },
  } as never;

  return { notas: new InvoiceNoteService(prisma), findFirst, findMany };
}

// ---------------------------------------------------------------------------
// 1 · Cálculo del saldo
// ---------------------------------------------------------------------------

describe('TA-66 · saldo disponible', () => {
  it('sin notas emitidas el saldo es el total de la factura', () => {
    const saldo = saldoDisponible(1180, 0);
    expect(saldo).toEqual({ total: 1180, devuelto: 0, disponible: 1180 });
  });

  it('una nota parcial reduce el saldo en su importe', () => {
    const saldo = saldoDisponible(1180, 180);
    expect(saldo.disponible).toBe(1000);
  });

  it('varias notas parciales se acumulan', () => {
    const saldo = saldoDisponible(1180, 180 + 400);
    expect(saldo.disponible).toBe(600);
  });

  it('el saldo nunca queda negativo aunque los datos históricos lo superen', () => {
    // Antes de existir este control se pudieron emitir notas de más: devolver
    // un saldo negativo confundiría al usuario y rompería la comparación.
    const saldo = saldoDisponible(1000, 1500);
    expect(saldo.disponible).toBe(0);
    expect(saldo.devuelto).toBe(1500);
  });

  it('el saldo se redondea a céntimos', () => {
    expect(saldoDisponible(0.3, 0.1).disponible).toBe(0.2);
    expect(saldoDisponible(1180.55, 0.05).disponible).toBe(1180.5);
  });
});

// ---------------------------------------------------------------------------
// 2 · Verificación del importe contra el saldo
// ---------------------------------------------------------------------------

describe('TA-66 · verificación del importe de la nota', () => {
  it('acepta una nota que cabe exactamente en el saldo', () => {
    expect(() =>
      verificarSaldoNota(saldoDisponible(1180, 0), 1180),
    ).not.toThrow();
  });

  it('rechaza una nota que se pasa en un céntimo', () => {
    expect(() =>
      verificarSaldoNota(saldoDisponible(1180, 0), 1180.01),
    ).toThrow(ConflictException);
  });

  it('el mensaje del exceso dice cuánto queda y cuánto se acreditó', () => {
    try {
      verificarSaldoNota(saldoDisponible(1180, 180), 1001);
      throw new Error('Se esperaba una excepción');
    } catch (error) {
      const mensaje = (error as Error).message;
      expect(mensaje).toContain('1001.00');
      expect(mensaje).toContain('1000.00');
      expect(mensaje).toContain('180.00');
    }
  });

  it('el 409 del exceso lleva su código para que el front lo distinga', () => {
    try {
      verificarSaldoNota(saldoDisponible(100, 0), 200);
    } catch (error) {
      const respuesta = (error as ConflictException).getResponse() as {
        code: string;
      };
      expect(respuesta.code).toBe('NOTA_EXCEDE_SALDO');
    }
  });

  it('una nota de importe cero o negativo se rechaza', () => {
    expect(() => verificarSaldoNota(saldoDisponible(100, 0), 0)).toThrow(
      ConflictException,
    );
    expect(() => verificarSaldoNota(saldoDisponible(100, 0), -50)).toThrow(
      ConflictException,
    );
  });

  it('con el saldo ya en cero cualquier nota se rechaza', () => {
    expect(() => verificarSaldoNota(saldoDisponible(1000, 1000), 0.01)).toThrow(
      /supera el saldo disponible/,
    );
  });
});

// ---------------------------------------------------------------------------
// 3 · Catálogos 09 y 10
// ---------------------------------------------------------------------------

describe('TA-66 · motivos de los catálogos de SUNAT', () => {
  it('el Catálogo 09 trae los motivos de Nota de Crédito', () => {
    const codigos = CATALOGO_09_MOTIVOS.map((m) => m.codigo);
    expect(codigos).toContain('01');
    expect(codigos).toContain('06');
    expect(codigos).toContain('07');
    expect(codigos).toContain('13');
  });

  it('el Catálogo 10 trae los motivos de Nota de Débito', () => {
    const codigos = CATALOGO_10_MOTIVOS.map((m) => m.codigo);
    expect(codigos).toContain('01');
    expect(codigos).toContain('02');
    expect(codigos).toContain('03');
  });

  it('los motivos de anulación y devolución total están marcados como totales', () => {
    const totales = CATALOGO_09_MOTIVOS.filter((m) => m.total).map((m) => m.codigo);
    expect(totales).toContain('01');
    expect(totales).toContain('06');
    // Una devolución por ítem NO devuelve todo.
    expect(totales).not.toContain('07');
  });
});

// ---------------------------------------------------------------------------
// 4 · Autorización de la Nota de Crédito
// ---------------------------------------------------------------------------

describe('TA-66 · autorización de Nota de Crédito', () => {
  it('autoriza una nota parcial que cabe en el saldo', async () => {
    const { notas } = servicio();
    const autorizada = await notas.autorizarCredito('emp-1', {
      comprobanteOrigenId: 'inv-1',
      motivoCodigo: '07',
      importe: 500,
      sustento: 'Devolución de 20 bolsas',
    });

    expect(autorizada.tipo).toBe('07');
    expect(autorizada.importe).toBe(500);
    expect(autorizada.motivoDescripcion).toBe('Devolución de 20 bolsas');
    expect(autorizada.origen.serie).toBe('F001');
  });

  it('rechaza una nota que supera el saldo disponible', async () => {
    const { notas } = servicio({ notas: [800] });

    await expect(
      notas.autorizarCredito('emp-1', {
        comprobanteOrigenId: 'inv-1',
        motivoCodigo: '07',
        importe: 500,
      }),
    ).rejects.toThrow(ConflictException);
  });

  it('un motivo de anulación total toma el saldo entero y no el importe pedido', async () => {
    const { notas } = servicio({ notas: [180] });

    const autorizada = await notas.autorizarCredito('emp-1', {
      comprobanteOrigenId: 'inv-1',
      motivoCodigo: '01',
      // Se manda un importe a propósito: debe ignorarse.
      importe: 10,
    });

    expect(autorizada.importe).toBe(1000);
    expect(autorizada.saldo.disponible).toBe(1000);
  });

  it('rechaza un motivo que no pertenece al Catálogo 09', async () => {
    const { notas } = servicio();

    await expect(
      notas.autorizarCredito('emp-1', {
        comprobanteOrigenId: 'inv-1',
        motivoCodigo: '99',
        importe: 10,
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('el mensaje de motivo inválido lista los códigos válidos', async () => {
    const { notas } = servicio();

    await expect(
      notas.autorizarCredito('emp-1', {
        comprobanteOrigenId: 'inv-1',
        motivoCodigo: 'XX',
        importe: 10,
      }),
    ).rejects.toThrow(/01, 02, 03/);
  });

  it('un comprobante en cola no admite notas', async () => {
    const { notas } = servicio({ estado: 'EN_COLA' });

    await expect(
      notas.autorizarCredito('emp-1', {
        comprobanteOrigenId: 'inv-1',
        motivoCodigo: '07',
        importe: 10,
      }),
    ).rejects.toThrow(ConflictException);
  });

  it('un comprobante rechazado no admite notas', async () => {
    const { notas } = servicio({ estado: 'RECHAZADO' });

    await expect(
      notas.autorizarCredito('emp-1', {
        comprobanteOrigenId: 'inv-1',
        motivoCodigo: '01',
      }),
    ).rejects.toThrow(/no admite notas/);
  });

  it('un comprobante de otra empresa responde 404', async () => {
    const { notas, findFirst } = servicio({ noExiste: true });

    await expect(
      notas.autorizarCredito('emp-2', {
        comprobanteOrigenId: 'inv-1',
        motivoCodigo: '01',
      }),
    ).rejects.toThrow(/no existe o no pertenece/);

    const args = findFirst.mock.calls[0][0] as unknown as {
      where: { company_id: string };
    };
    expect(args.where.company_id).toBe('emp-2');
  });

  it('la consulta de notas excluye las rechazadas y las anuladas', async () => {
    const { notas, findMany } = servicio();

    await notas.autorizarCredito('emp-1', {
      comprobanteOrigenId: 'inv-1',
      motivoCodigo: '07',
      importe: 100,
    });

    const args = findMany.mock.calls[0][0] as unknown as {
      where: { estado: { notIn: string[] } };
    };
    expect(args.where.estado.notIn).toContain('RECHAZADO');
    expect(args.where.estado.notIn).toContain('ANULADO');
  });

  it('solo se suman las notas de tipo 07, no los débitos', async () => {
    const { notas, findMany } = servicio();

    await notas.autorizarCredito('emp-1', {
      comprobanteOrigenId: 'inv-1',
      motivoCodigo: '07',
      importe: 100,
    });

    const args = findMany.mock.calls[0][0] as unknown as {
      where: { tipo_comprobante: string };
    };
    expect(args.where.tipo_comprobante).toBe('07');
  });
});

// ---------------------------------------------------------------------------
// 5 · Nota de Débito y series
// ---------------------------------------------------------------------------

describe('TA-66 · autorización de Nota de Débito', () => {
  it('acepta un motivo del Catálogo 10 y un importe positivo', async () => {
    const { notas } = servicio();

    const autorizada = await notas.autorizarDebito('emp-1', {
      comprobanteOrigenId: 'inv-1',
      motivoCodigo: '01',
      importe: 35.4,
      sustento: 'Intereses por mora 20 días',
    });

    expect(autorizada.tipo).toBe('08');
    expect(autorizada.importe).toBe(35.4);
    expect(autorizada.motivoDescripcion).toBe('Intereses por mora 20 días');
  });

  it('una nota de débito NO consume saldo: puede cobrarse aunque el saldo sea cero', async () => {
    // El comprobante ya fue anulado por completo con una nota de crédito, pero
    // los intereses por mora se siguen cobrando.
    const { notas } = servicio({ notas: [1180] });

    const autorizada = await notas.autorizarDebito('emp-1', {
      comprobanteOrigenId: 'inv-1',
      motivoCodigo: '01',
      importe: 50,
    });

    expect(autorizada.importe).toBe(50);
    expect(autorizada.saldo.disponible).toBe(0);
  });

  it('rechaza un motivo que no pertenece al Catálogo 10', async () => {
    const { notas } = servicio();

    await expect(
      notas.autorizarDebito('emp-1', {
        comprobanteOrigenId: 'inv-1',
        motivoCodigo: '07',
        importe: 10,
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('rechaza una nota de débito sin importe', async () => {
    const { notas } = servicio();

    await expect(
      notas.autorizarDebito('emp-1', {
        comprobanteOrigenId: 'inv-1',
        motivoCodigo: '01',
      }),
    ).rejects.toThrow(/mayor que cero/);
  });

  it('la serie de la nota depende del comprobante origen', () => {
    const { notas } = servicio();

    // Nota de crédito a una factura: serie FC.
    expect(notas.serieDeNota('07', 'F001')).toBe('FC01');
    // Nota de crédito a una boleta: serie BC.
    expect(notas.serieDeNota('07', 'B001')).toBe('BC01');
    // Nota de débito: FD / BD.
    expect(notas.serieDeNota('08', 'F001')).toBe('FD01');
    expect(notas.serieDeNota('08', 'B001')).toBe('BD01');
  });
});
