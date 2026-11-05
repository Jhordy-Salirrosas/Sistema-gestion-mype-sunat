/**
 * Emisión desde la pantalla: validaciones de orden y de origen (M1, 31-10).
 *
 * Lo que fija esta suite es el ORDEN de las comprobaciones, que es una decisión
 * con consecuencias fiscales:
 *
 *  1. El correlativo se reserva AL FINAL. Si se reservara antes, una factura
 *     rechazada por stock o por falta de documento de origen dejaría un hueco
 *     permanente en la serie (el número ya se consumió).
 *  2. Una nota sin comprobante de origen no llega a reservar número.
 *  3. La nota de crédito no puede devolver más de lo que costó la venta.
 */
import { describe, expect, it, jest, beforeEach } from '@jest/globals';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { EmitirComprobanteService } from '../../../src/modules/invoices/application/services/emitirComprobanteService';
import type { EmitirComprobanteDto } from '../../../src/modules/invoices/application/dto/emitirComprobanteDto';

const COMPANY_ID = '5eaccb4e-a6ec-4f23-9909-85fe7fc9e879';

/** Formulario de factura mínima. */
const factura = (
  parcial: Partial<EmitirComprobanteDto> = {},
): EmitirComprobanteDto =>
  ({
    tipo_comprobante: '01',
    serie: 'F001',
    customer_identity_type: '6',
    customer_identity_number: '20100070970',
    customer_legal_name: 'FERRETERÍA LOS ANDES S.A.C.',
    items: [
      {
        descripcion: 'Cemento Portland tipo I',
        codigo: 'CEM-001',
        unidad: 'NIU',
        cantidad: 2,
        valorUnitario: 50,
        afectacion: '10',
      },
    ],
    ...parcial,
  }) as EmitirComprobanteDto;

/**
 * Arma el servicio con dobles mínimos.
 *
 * `facturas` simula la tabla `invoices`; `notasPrevias` se usa para el saldo.
 */
const montar = (
  opciones: {
    facturas?: Array<Record<string, unknown>>;
    notasPrevias?: Array<Record<string, unknown>>;
    errorStock?: Error;
    errorSerie?: Error;
  } = {},
) => {
  const creadas: Array<Record<string, unknown>> = [];
  const lineasGuardadas: Array<Record<string, unknown>> = [];
  const actualizaciones: Array<Record<string, unknown>> = [];

  const prisma = {
    company: {
      findUnique: jest.fn(async () => ({
        ruc: '20100070970',
        legal_name: 'FERRETERÍA LOS ANDES S.A.C.',
        trade_name: null,
      })),
    },
    invoice: {
      findFirst: jest.fn(async () => opciones.facturas?.[0] ?? null),
      /**
       * Notas de crédito anteriores, para el saldo (TA-66).
       *
       * Se declara el parámetro aunque no se use: sin firma, `toHaveBeenCalledWith`
       * no acepta argumentos y no se podría comprobar POR QUÉ clave se consulta.
       * Y esa clave es el defecto: con `referenced_invoice_id` en NULL esta
       * consulta no devolvía nunca una nota previa.
       */
      findMany: jest.fn<(args: unknown) => Promise<unknown>>(
        async () => opciones.notasPrevias ?? [],
      ),
      create: jest.fn(async ({ data }: { data: Record<string, unknown> }) => {
        creadas.push(data);
        return data;
      }),
      /**
       * Actualización de los importes desglosados.
       *
       * `taxable_operations` y `total_igv` son columnas propias de la tabla; al
       * quedarse en 0 la trama QR mostraba `|0.00|` en el IGV de una factura de
       * S/ 1,046.66.
       */
      update: jest.fn(async ({ data }: { data: Record<string, unknown> }) => {
        actualizaciones.push(data);
        return data;
      }),
    },
    /**
     * Líneas del comprobante.
     *
     * El puente contable las lee de esta tabla y no del `payload_ubl`: sin ellas
     * el comprobante se acepta en SUNAT pero el Kardex queda en cero.
     */
    invoiceItem: {
      createMany: jest.fn(
        async ({ data }: { data: readonly Record<string, unknown>[] }) => {
          lineasGuardadas.push(...data);
          return { count: data.length };
        },
      ),
    },
  };

  const series = {
    reservarCorrelativo: jest.fn(async () => {
      if (opciones.errorSerie) throw opciones.errorSerie;
      return 1;
    }),
  };

  const stock = {
    // Los parámetros se declaran aunque no se usen: sin ellos, `jest.fn` tipa la
    // función como `() => ...` y `toHaveBeenCalledWith` no acepta argumentos.
    validar: jest.fn(
      async (
        _companyId: string,
        _items: readonly { codigo?: string | null; cantidad: number }[],
      ) => {
        if (opciones.errorStock) throw opciones.errorStock;
        return { validados: 1, omitidos: 0, avisos: [] };
      },
    ),
  };

  const notas = {};

  /**
   * Repositorio de comprobantes.
   *
   * Es el que encola el envío a SUNAT dentro de la misma transacción. Si el
   * servicio escribiera con un `prisma.invoice.create` directo, el comprobante
   * quedaría guardado como PENDIENTE y nadie lo encolaría: se detectó emitiendo
   * de verdad y viendo que el estado nunca cambiaba.
   */
  const repositorio = {
    saveWithTransactionalOutbox: jest.fn(
      async (entidad: { serie: string; correlativo: number }) => {
        creadas.push({ ...entidad });
        return {
          id: 'inv-generado',
          estado: 'PENDIENTE',
          created_at: new Date(),
        };
      },
    ),
  };

  const servicio = new EmitirComprobanteService(
    prisma as never,
    series as never,
    stock as never,
    notas as never,
    repositorio as never,
  );

  return {
    servicio,
    prisma,
    series,
    stock,
    repositorio,
    creadas,
    lineasGuardadas,
    actualizaciones,
  };
};

describe('EmitirComprobanteService — emisión de factura', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('emite una factura válida y devuelve el número real', async () => {
    const { servicio, creadas } = montar();

    const resultado = await servicio.emitir(factura(), COMPANY_ID);

    expect(resultado.success).toBe(true);
    expect(resultado.numero).toBe('F001-00000001');
    expect(resultado.correlativo).toBe(1);
    expect(resultado.monto_total).toBe(118);
    expect(creadas).toHaveLength(1);
  });

  it('persiste el payload UBL, no solo los cabeceros', async () => {
    const { servicio, repositorio } = montar();

    await servicio.emitir(factura(), COMPANY_ID);

    const entidad = repositorio.saveWithTransactionalOutbox.mock
      .calls[0][0] as unknown as Record<string, unknown>;
    expect(entidad.payload_ubl).toBeDefined();
    expect(entidad.company_id).toBe(COMPANY_ID);
  });

  // El comprobante TIENE que pasar por el repositorio: es el único camino que
  // encola el envío a SUNAT en la misma transacción.
  it('usa saveWithTransactionalOutbox, que es quien encola el envío', async () => {
    const { servicio, repositorio, prisma } = montar();

    await servicio.emitir(factura(), COMPANY_ID);

    expect(repositorio.saveWithTransactionalOutbox).toHaveBeenCalledTimes(1);
    // Y NO escribe directo contra la tabla: eso dejaría el comprobante sin cola.
    expect(prisma.invoice.create).not.toHaveBeenCalled();
  });

  /**
   * Las líneas tienen que quedar en `invoice_items`.
   *
   * El puente contable las lee de esa tabla y NO del `payload_ubl`. Si solo se
   * guardara el payload, el comprobante se aceptaría en SUNAT, el asiento
   * cuadraría y el Kardex quedaría en 0: la mercadería vendida nunca saldría del
   * almacén. Se detectó emitiendo contra SUNAT BETA el 31-10 (la factura salió
   * ACEPTADA y el stock no se movió).
   */
  /**
   * Los importes desglosados van a sus columnas, no solo a `monto_total`.
   *
   * Al quedarse en 0, el detalle de la API devolvía `total_igv: 0` en una
   * factura con S/ 159.66 de IGV y la trama QR del modal salía con `|0.00|`
   * en el IGV. Se detectó abriendo el modal en el navegador el 31-10.
   */
  it('guarda el IGV y la base gravada en sus columnas', async () => {
    const { servicio, actualizaciones } = montar();

    await servicio.emitir(factura(), COMPANY_ID);

    expect(actualizaciones).toHaveLength(1);
    expect(actualizaciones[0]).toMatchObject({
      taxable_operations: 100,
      total_igv: 18,
    });
  });

  it('persiste las líneas en invoice_items para que el Kardex pueda mover stock', async () => {
    const { servicio, lineasGuardadas } = montar();

    await servicio.emitir(
      factura({
        items: [
          {
            descripcion: 'Cemento',
            codigo: 'CEM-001',
            unidad: 'NIU',
            cantidad: 3,
            valorUnitario: 25,
            afectacion: '10',
          },
        ],
      }),
      COMPANY_ID,
    );

    expect(lineasGuardadas).toHaveLength(1);
    expect(lineasGuardadas[0]).toMatchObject({
      item_code: 'CEM-001',
      quantity: 3,
      unit_value: 25,
      igv_affectation_type: '10',
    });
  });

  it('devuelve el detalle por línea con su IGV', async () => {
    const { servicio } = montar();

    const resultado = await servicio.emitir(factura(), COMPANY_ID);

    expect(resultado.lineas).toHaveLength(1);
    expect(resultado.lineas[0].igv).toBe(18);
    // El "total" de la línea va CON IGV (base 100 + IGV 18).
    expect(resultado.lineas[0].total).toBe(118);
  });

  it('exige empresa en el token', async () => {
    const { servicio } = montar();

    // Falta de empresa es un problema de AUTENTICACIÓN (403), no de datos: el
    // token llegó sin companyId.
    await expect(servicio.emitir(factura(), '')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });
});

describe('EmitirComprobanteService — descuento global', () => {
  it('no reserva correlativo si el descuento global excede la base', async () => {
    const { servicio, series, creadas } = montar();
    await expect(servicio.emitir(factura({ descuento_global: { codigo: '02', monto: 101 } }), COMPANY_ID)).rejects.toThrow(/excede su base/);
    expect(series.reservarCorrelativo).not.toHaveBeenCalled();
    expect(creadas).toHaveLength(0);
  });
});

describe('EmitirComprobanteService — stock antes que correlativo', () => {
  // El orden importa: un número reservado por una venta que no se puede emitir
  // queda quemado para siempre en la serie.
  it('no reserva correlativo cuando falta stock', async () => {
    const { servicio, series, creadas } = montar({
      errorStock: new BadRequestException(
        'Stock insuficiente: CEM-001 se pide 500 y hay 20',
      ),
    });

    await expect(servicio.emitir(factura(), COMPANY_ID)).rejects.toThrow(
      /Stock insuficiente/,
    );

    expect(series.reservarCorrelativo).not.toHaveBeenCalled();
    expect(creadas).toHaveLength(0);
  });

  it('valida el stock de las líneas con código', async () => {
    const { servicio, stock } = montar();

    await servicio.emitir(factura(), COMPANY_ID);

    expect(stock.validar).toHaveBeenCalledWith(
      COMPANY_ID,
      expect.arrayContaining([
        expect.objectContaining({ codigo: 'CEM-001', cantidad: 2 }),
      ]),
    );
  });
});

describe('EmitirComprobanteService — nota sobre comprobante existente', () => {
  const nota = (parcial: Record<string, unknown> = {}) =>
    factura({
      tipo_comprobante: '07' as never,
      documento_afectado: 'F001-00000042',
      codigo_motivo_nota: '01',
      items: [
        {
          descripcion: 'Devolución parcial',
          codigo: 'CEM-001',
          unidad: 'NIU',
          cantidad: 1,
          valorUnitario: 50,
          afectacion: '10',
        },
      ],
      ...parcial,
    } as never);

  it('rechaza una nota sin documento afectado, sin reservar número', async () => {
    const { servicio, series } = montar();

    await expect(
      servicio.emitir(nota({ documento_afectado: undefined }), COMPANY_ID),
    ).rejects.toThrow(/comprobante existente/);

    expect(series.reservarCorrelativo).not.toHaveBeenCalled();
  });

  it('rechaza una nota cuyo documento no existe en la empresa', async () => {
    const { servicio, series } = montar({ facturas: [] });

    await expect(servicio.emitir(nota(), COMPANY_ID)).rejects.toBeInstanceOf(
      NotFoundException,
    );

    expect(series.reservarCorrelativo).not.toHaveBeenCalled();
  });

  it('rechaza una nota sin motivo del Catálogo 09', async () => {
    const { servicio } = montar({
      facturas: [{ id: 'x', monto_total: 118, estado: 'ACEPTADO' }],
    });

    await expect(
      servicio.emitir(nota({ codigo_motivo_nota: undefined }), COMPANY_ID),
    ).rejects.toThrow(/motivo/);
  });

  it('rechaza una nota de crédito mayor que el saldo del comprobante', async () => {
    // La nota pide S/ 59 (una línea de 50 + IGV) y el comprobante original fue
    // de S/ 30: devolvería más de lo que se cobró.
    const { servicio, series } = montar({
      facturas: [{ id: 'origen-1', monto_total: 30, estado: 'ACEPTADO' }],
      notasPrevias: [],
    });

    await expect(servicio.emitir(nota(), COMPANY_ID)).rejects.toThrow(
      /supera el saldo/,
    );

    expect(series.reservarCorrelativo).not.toHaveBeenCalled();
  });

  it('descuenta las notas previas del saldo disponible', async () => {
    const { servicio } = montar({
      facturas: [{ id: 'origen-1', monto_total: 200, estado: 'ACEPTADO' }],
      notasPrevias: [{ monto_total: 100 }],
    });

    // Quedan S/ 100 de saldo y la nota pide S/ 50: cabe.
    await expect(servicio.emitir(nota(), COMPANY_ID)).resolves.toMatchObject({
      success: true,
    });
  });

  it('admite la nota cuando el comprobante existe y hay saldo', async () => {
    const { servicio } = montar({
      facturas: [{ id: 'origen-1', monto_total: 500, estado: 'ACEPTADO' }],
    });

    const resultado = await servicio.emitir(nota(), COMPANY_ID);

    expect(resultado.success).toBe(true);
    expect(resultado.tipo_comprobante).toBe('07');
  });

  /**
   * El importe que consume saldo es el TOTAL con IGV, no la base imponible.
   *
   * La nota de esta suite es de S/ 50 sin IGV → S/ 59 con IGV. Con el
   * comprobante en S/ 55 hay base de sobra (50 ≤ 55) pero el documento que se
   * emite devuelve 59: comparar la base dejaba pasar ese exceso. Se detectó
   * contra el servidor el 4 nov, con una nota de S/ 753,01 sobre S/ 703 libres.
   */
  it('el saldo se compara contra el total con IGV, no contra la base (TA-66)', async () => {
    const { servicio, series } = montar({
      facturas: [{ id: 'origen-1', monto_total: 55, estado: 'ACEPTADO' }],
      notasPrevias: [],
    });

    await expect(servicio.emitir(nota(), COMPANY_ID)).rejects.toThrow(
      /supera el saldo/,
    );

    expect(series.reservarCorrelativo).not.toHaveBeenCalled();
  });

  /**
   * Una nota rechazada no existe ante SUNAT y una anulada no debe nada: ninguna
   * de las dos consume saldo. Sumarlas cerraba el saldo con documentos que no
   * devolvieron dinero.
   */
  it('las notas rechazadas o anuladas no consumen saldo (TA-66)', async () => {
    const { servicio, prisma } = montar({
      facturas: [{ id: 'origen-1', monto_total: 500, estado: 'ACEPTADO' }],
    });

    await servicio.emitir(nota(), COMPANY_ID);

    expect(prisma.invoice.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          estado: { notIn: expect.arrayContaining(['RECHAZADO', 'ANULADO']) },
        }),
      }),
    );
  });

  /**
   * TA-66: el UUID del comprobante afectado TIENE que quedar escrito.
   *
   * Esta es la prueba del defecto real. `ControlSaldoNotas` suma las notas
   * anteriores con `WHERE referenced_invoice_id = origen.id`; mientras esa
   * columna se quedaba en NULL, la consulta no devolvía NUNCA una nota previa,
   * el saldo era siempre el total de la factura y una segunda Nota de Crédito
   * podía devolver más de lo que la factura vale. SUNAT no lo impide: acepta
   * cada nota por separado y el exceso aparece recién en la determinación del
   * impuesto.
   */
  it('persiste el UUID del comprobante afectado en la nota (TA-66)', async () => {
    const { servicio, repositorio } = montar({
      facturas: [
        { id: 'origen-1', monto_total: 500, estado: 'ACEPTADO' },
      ],
    });

    await servicio.emitir(nota(), COMPANY_ID);

    // El formulario solo manda el número fiscal; el UUID lo resuelve el propio
    // servicio al buscar el origen, así que no se acepta desde el cliente.
    expect(repositorio.saveWithTransactionalOutbox).toHaveBeenCalledWith(
      expect.objectContaining({ referenced_invoice_id: 'origen-1' }),
    );
  });

  it('el saldo se consulta por el UUID del origen, no por el número', async () => {
    const { servicio, prisma } = montar({
      facturas: [{ id: 'origen-1', monto_total: 500, estado: 'ACEPTADO' }],
    });

    await servicio.emitir(nota(), COMPANY_ID);

    // Si la consulta buscara por `referenced_series_correlative` ('F001-00000042')
    // tampoco encontraría nada: la columna guarda el número, pero la suma de
    // notas se hace por id.
    expect(prisma.invoice.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ referenced_invoice_id: 'origen-1' }),
      }),
    );  });

  it('una nota se emite con el UUID del origen, sin aceptarlo del cliente', async () => {
    // El usuario no puede colar un id ajeno: se sobrescribe con el que resuelve
    // la búsqueda por número dentro de SU empresa.
    const { servicio, repositorio } = montar({
      facturas: [{ id: 'origen-1', monto_total: 500, estado: 'ACEPTADO' }],
    });

    await servicio.emitir(
      nota({ referenced_invoice_id: 'id-de-otra-empresa' }),
      COMPANY_ID,
    );

    expect(repositorio.saveWithTransactionalOutbox).toHaveBeenCalledWith(
      expect.objectContaining({ referenced_invoice_id: 'origen-1' }),
    );
  });

  it('una factura normal no consulta el documento de origen', async () => {    const { servicio, prisma } = montar();

    await servicio.emitir(factura(), COMPANY_ID);

    // Solo se consulta `company`; `invoice.findFirst` es la búsqueda del
    // documento afectado, que una factura no necesita.
    expect(prisma.invoice.findFirst).not.toHaveBeenCalled();
  });
});

describe('EmitirComprobanteService — fallos de la serie', () => {
  it('propaga el error cuando la serie no existe o está inactiva', async () => {
    const { servicio, creadas } = montar({
      errorSerie: new NotFoundException('La serie F001 no está configurada'),
    });

    await expect(servicio.emitir(factura(), COMPANY_ID)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(creadas).toHaveLength(0);
  });
});
