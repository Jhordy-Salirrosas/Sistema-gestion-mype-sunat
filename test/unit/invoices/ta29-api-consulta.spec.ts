/**
 * TA-29 — API de consulta de comprobantes.
 *
 * Cubre los seis criterios del backlog:
 *   1. Listado paginado con filtros.
 *   2. Detalle con CDR e historial.
 *   3. Reintento de CDR que reencola y audita.
 *   4. Filtro por empresa del token y 404 para recursos ajenos.
 *   5. Contrato alineado con el frontend.
 *   6. Pruebas de controlador (el e2e está en test/e2e/invoices).
 */
import { BadRequestException, NotFoundException } from '@nestjs/common';
import {
  construirRangoFechas,
  construirWhere,
  fechaFinDelDia,
  fechaInicioDelDia,
  normalizarPaginacion,
} from '../../../src/modules/invoices/application/services/invoiceQueryFilters';
import {
  aCdr,
  aDetalle,
  aHistorial,
  aListado,
  numeroComprobante,
  type FilaDetalle,
  type FilaListado,
} from '../../../src/modules/invoices/application/services/invoiceQueryMapper';
import { InvoiceQueryService } from '../../../src/modules/invoices/application/services/invoiceQueryService';
import { InvoiceQueryController } from '../../../src/modules/invoices/infrastructure/controllers/invoiceQueryController';
import { InvoiceStatus } from '../../../src/generated/client/enums';

const EMPRESA = 'empresa-propia';

function filaListado(overrides: Partial<FilaListado> = {}): FilaListado {
  return {
    id: 'inv-1',
    tipo_comprobante: '01',
    serie: 'F001',
    correlativo: 7,
    fecha_emision: new Date('2026-10-30T15:00:00Z'),
    estado: InvoiceStatus.ACEPTADO,
    monto_total: { toString: () => '118.00' },
    currency_code: 'PEN',
    customer_identity_number: '20100070970',
    customer_legal_name: 'CLIENTE SAC',
    sunat_response_code: '0',
    ...overrides,
  };
}

describe('TA-29 - filtros del listado (criterio 1)', () => {
  it('el where SIEMPRE lleva la empresa del token', () => {
    const where = construirWhere(EMPRESA, {});
    expect(where.company_id).toBe(EMPRESA);
  });

  it('filtra por estado, tipo y serie', () => {
    const where = construirWhere(EMPRESA, {
      estado: 'aceptado',
      tipo: '1',
      serie: 'f001',
    });

    expect(where.estado).toBe('ACEPTADO');
    expect(where.tipo_comprobante).toBe('01');
    expect(where.serie).toBe('F001');
  });

  it('rechaza un estado inexistente con 400', () => {
    expect(() => construirWhere(EMPRESA, { estado: 'PAGADO' })).toThrow(
      BadRequestException,
    );
  });

  it('rechaza una fecha mal formada con 400', () => {
    expect(() => construirWhere(EMPRESA, { desde: '30/10/2026' })).toThrow(
      BadRequestException,
    );
  });

  it('rechaza un rango invertido con 400', () => {
    expect(() =>
      construirWhere(EMPRESA, { desde: '2026-10-30', hasta: '2026-10-01' }),
    ).toThrow(/no puede ser posterior/);
  });
});

describe('TA-29 - rango de fechas en hora de Perú', () => {
  it('el inicio del día es medianoche de Lima, no de UTC', () => {
    // 2026-10-30 00:00 en Lima (UTC-5) = 2026-10-30T05:00:00Z
    expect(fechaInicioDelDia('2026-10-30').toISOString()).toBe(
      '2026-10-30T05:00:00.000Z',
    );
  });

  it('el fin del día incluye la última hora de Lima', () => {
    // 2026-10-30 23:59:59.999 en Lima = 2026-10-31T04:59:59.999Z
    expect(fechaFinDelDia('2026-10-30').toISOString()).toBe(
      '2026-10-31T04:59:59.999Z',
    );
  });

  it('un comprobante de las 20:00 de Lima entra en el filtro de su día', () => {
    const emitido = new Date('2026-10-31T01:00:00Z'); // 30/10 20:00 en Lima
    const rango = construirRangoFechas({
      desde: '2026-10-30',
      hasta: '2026-10-30',
    });

    expect(rango?.gte && emitido >= rango.gte).toBe(true);
    expect(rango?.lte && emitido <= rango.lte).toBe(true);
  });
});

describe('TA-29 - paginación', () => {
  it('aplica valores por defecto', () => {
    expect(normalizarPaginacion()).toEqual({
      page: 1,
      page_size: 20,
      skip: 0,
    });
  });

  it('calcula el offset de la página pedida', () => {
    expect(normalizarPaginacion('3', '10').skip).toBe(20);
  });

  it('limita el tamaño de página para no permitir un full scan', () => {
    expect(normalizarPaginacion('1', '100000').page_size).toBe(100);
  });

  it('corrige una página inválida a la primera', () => {
    expect(normalizarPaginacion('-5', '10').page).toBe(1);
  });
});

describe('TA-29 - mapeo al contrato del frontend (criterio 5)', () => {
  it('arma el número con el relleno de 8 dígitos', () => {
    expect(numeroComprobante('F001', 7)).toBe('F001-00000007');
  });

  it('convierte los Decimal de Prisma a número', () => {
    const dto = aListado(filaListado());
    expect(dto.monto_total).toBe(118);
    expect(typeof dto.monto_total).toBe('number');
  });

  it('devuelve las claves que espera la grilla', () => {
    const dto = aListado(filaListado());
    expect(dto).toEqual(
      expect.objectContaining({
        id: 'inv-1',
        numero: 'F001-00000007',
        estado: 'ACEPTADO',
        cliente_documento: '20100070970',
        cliente_nombre: 'CLIENTE SAC',
      }),
    );
  });

  it('aplana el CDR guardado en la base', () => {
    const cdr = aCdr({
      responseCode: '0',
      description: 'Aceptado',
      responseDate: '2026-10-30',
      observaciones: [{ codigo: '4000', texto: 'Presentado antes' }],
    });

    expect(cdr).toEqual({
      codigo: '0',
      descripcion: 'Aceptado',
      fecha_respuesta: '2026-10-30',
      observaciones: [{ codigo: '4000', texto: 'Presentado antes' }],
    });
  });

  it('devuelve null si el comprobante no tiene CDR', () => {
    expect(aCdr(null)).toBeNull();
    expect(aCdr(undefined)).toBeNull();
  });

  it('ordena el historial del más antiguo al más reciente', () => {
    const historia = aHistorial([
      {
        id: 'h2',
        intento: 2,
        estado_anterior: InvoiceStatus.PROCESANDO,
        estado_nuevo: InvoiceStatus.ACEPTADO,
        codigo_error: '0',
        mensaje_error: 'Aceptado',
        tiempo_respuesta_ms: 900,
        created_at: new Date('2026-10-30T10:01:00Z'),
      },
      {
        id: 'h1',
        intento: 1,
        estado_anterior: InvoiceStatus.PENDIENTE,
        estado_nuevo: InvoiceStatus.PROCESANDO,
        codigo_error: null,
        mensaje_error: null,
        tiempo_respuesta_ms: null,
        created_at: new Date('2026-10-30T10:00:00Z'),
      },
    ]);

    expect(historia.map((h) => h.id)).toEqual(['h1', 'h2']);
  });
});

describe('TA-29 - servicio (criterios 2, 3 y 4)', () => {
  function crearServicio(filaDetalle: unknown, cola = {}) {
    const prisma = {
      invoice: {
        findFirst: jest.fn().mockResolvedValue(filaDetalle),
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
      },
      auditLog: { create: jest.fn().mockResolvedValue({}) },
      $transaction: jest.fn(async (ops: unknown) =>
        Array.isArray(ops) ? Promise.all(ops) : ops,
      ),
    };
    const queue = {
      enqueueInvoiceInTx: jest.fn().mockResolvedValue('job-1'),
      ...cola,
    };
    return {
      servicio: new InvoiceQueryService(prisma as never, queue as never),
      prisma,
      queue,
    };
  }

  const detalle = (): FilaDetalle => ({
    ...filaListado(),
    ruc_emisor: '20601012341',
    taxable_operations: { toString: () => '100.00' },
    total_igv: { toString: () => '18.00' },
    cdr_sunat: { responseCode: '0', description: 'Aceptado' },
    created_at: new Date('2026-10-30T10:00:00Z'),
    updated_at: new Date('2026-10-30T10:00:05Z'),
    history: [],
  });

  it('el detalle incluye CDR e historial', async () => {
    const { servicio } = crearServicio(detalle());
    const dto = await servicio.detalle(EMPRESA, 'inv-1');

    expect(dto.cdr?.codigo).toBe('0');
    expect(dto.historial).toEqual([]);
    expect(dto.base_imponible).toBe(100);
    expect(dto.total_igv).toBe(18);
  });

  it('responde 404 si el comprobante es de otra empresa', async () => {
    const { servicio, prisma } = crearServicio(null);

    await expect(servicio.detalle(EMPRESA, 'de-otra')).rejects.toThrow(
      NotFoundException,
    );

    // El filtro por empresa viaja en la consulta: no se trae la fila y luego
    // se compara, para no leer datos ajenos ni siquiera desde la BD.
    expect(prisma.invoice.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'de-otra', company_id: EMPRESA } }),
    );
  });

  it('reencola y audita el reintento de CDR', async () => {
    const { servicio, prisma, queue } = crearServicio({
      id: 'inv-1',
      estado: InvoiceStatus.ERROR_RED,
    });

    const resultado = await servicio.reintentarCdr(EMPRESA, 'inv-1');

    expect(resultado.encolado).toBe(true);
    expect(queue.enqueueInvoiceInTx).toHaveBeenCalled();
    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: 'RETRY_CDR' }),
      }),
    );
  });

  it('no reencola un comprobante ya aceptado (evita el duplicado 1033)', async () => {
    const { servicio, queue } = crearServicio({
      id: 'inv-1',
      estado: InvoiceStatus.ACEPTADO,
    });

    const resultado = await servicio.reintentarCdr(EMPRESA, 'inv-1');

    expect(resultado.encolado).toBe(false);
    expect(resultado.estado).toBe(InvoiceStatus.ACEPTADO);
    expect(queue.enqueueInvoiceInTx).not.toHaveBeenCalled();
  });

  it('informa cuando la cola no está disponible', async () => {
    const { servicio } = crearServicio(
      { id: 'inv-1', estado: InvoiceStatus.ERROR_RED },
      { enqueueInvoiceInTx: jest.fn().mockResolvedValue(null) },
    );

    const resultado = await servicio.reintentarCdr(EMPRESA, 'inv-1');

    expect(resultado.encolado).toBe(false);
    expect(resultado.mensaje).toMatch(/cola no está disponible/);
  });
});

describe('TA-29 - controlador', () => {
  it('responde el listado con la forma que espera invoicesApi', async () => {
    const servicio = {
      listar: jest.fn().mockResolvedValue({
        data: [aListado(filaListado())],
        total: 1,
        page: 1,
        page_size: 20,
        total_pages: 1,
      }),
      detalle: jest.fn(),
      reintentarCdr: jest.fn(),
    };
    const controlador = new InvoiceQueryController(servicio as never);

    const respuesta = await controlador.listar(EMPRESA, undefined, undefined, undefined, undefined, undefined, '1', '20');

    expect(respuesta).toEqual(
      expect.objectContaining({
        data: expect.any(Array),
        total: 1,
        page: 1,
      }),
    );
    expect(servicio.listar).toHaveBeenCalledWith(
      EMPRESA,
      expect.objectContaining({ estado: undefined }),
      '1',
      '20',
    );
  });

  it('pasa la empresa del token al detalle', async () => {
    const servicio = {
      listar: jest.fn(),
      detalle: jest.fn().mockResolvedValue({ id: 'inv-1' }),
      reintentarCdr: jest.fn(),
    };
    const controlador = new InvoiceQueryController(servicio as never);

    await controlador.detalle(EMPRESA, 'inv-1');

    expect(servicio.detalle).toHaveBeenCalledWith(EMPRESA, 'inv-1');
  });

  it('mapea el detalle completo con todos sus campos', () => {
    const dto = aDetalle({
      ...filaListado(),
      ruc_emisor: '20601012341',
      taxable_operations: 100,
      total_igv: 18,
      cdr_sunat: null,
      created_at: new Date('2026-10-30T10:00:00Z'),
      updated_at: new Date('2026-10-30T10:00:00Z'),
      history: [],
    });

    expect(dto.ruc_emisor).toBe('20601012341');
    expect(dto.cdr).toBeNull();
    expect(dto.numero).toBe('F001-00000007');
  });
});
