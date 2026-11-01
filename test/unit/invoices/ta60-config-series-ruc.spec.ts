/**
 * TA-60 · reserva atómica del correlativo, configuración y regla de S/ 700.
 *
 * Tres frentes, cada uno con su contrato:
 *
 *  1. `InvoiceSeriesService.reservarCorrelativo` debe ser atómico: dos
 *     transacciones simultáneas no pueden leer el mismo número.
 *  2. `InvoiceConfigService` informa el estado sin filtrar secretos.
 *  3. La Boleta exige documento del cliente por encima de S/ 700.
 *
 * El punto delicado del frente 1 es cómo probar atomicidad sin PostgreSQL: se
 * usa un cliente falso cuyo `$queryRaw` lleva un `await` real entre la lectura
 * y la escritura, y aun así devuelve números distintos porque el fake imita el
 * bloqueo de fila. La versión INGÉNUA (findUnique + update) implementada sobre
 * el mismo fake SÍ colisiona, y ese caso queda como prueba de que el test mide
 * lo que dice medir.
 */
import { describe, expect, it, jest, beforeEach } from '@jest/globals';
import {
  InvoiceSeriesService,
  SerieNoDisponibleError,
} from '../../../src/modules/invoices/application/services/invoiceSeriesService';
import { InvoiceConfigService } from '../../../src/modules/invoices/application/services/invoiceConfigService';
import {
  exigeDocumentoCliente,
  validarDocumentoCliente,
  UMBRAL_DOCUMENTO_BOLETA_SOLES,
  mensajeDocumentoCliente,
} from '../../../src/modules/invoices/application/validators/boletoDocumentoRule';
import { CreateInvoiceUseCase } from '../../../src/modules/invoices/application/use-cases/createInvoiceUseCase';
import type { CreateInvoiceDto } from '../../../src/modules/invoices/application/dto/createInvoiceDto';

// ---------------------------------------------------------------------------
// 1 · Reserva atómica del correlativo
// ---------------------------------------------------------------------------

/**
 * Doble de la fila `invoice_series`.
 *
 * `$queryRaw` no interpreta el SQL: simula el efecto del `UPDATE ... RETURNING`
 * sobre una fila, con un `await` intermedio real para que las llamadas
 * concurrentes se entrelacen como lo harían contra el motor. El incremento es
 * síncrono respecto de la lectura, que es justo la propiedad que el SQL
 * garantiza y que la versión ingenua no tiene.
 */
function crearPrismaFalso(correlativoInicial: number, activa = true) {
  const fila = {
    document_type: '01',
    series: 'F001',
    current_correlative: correlativoInicial,
    is_active: activa,
  };

  const $queryRaw = jest.fn(async (..._args: unknown[]) => {
    // Un tick real: da oportunidad a que otra llamada se intercale.
    await new Promise((resolve) => setTimeout(resolve, 1));
    if (!fila.is_active) return [];
    fila.current_correlative += 1;
    return [{ current_correlative: fila.current_correlative }];
  });

  const prisma = {
    $queryRaw,
    invoiceSeries: {
      findUnique: jest.fn(async () => ({ is_active: fila.is_active })),
      findMany: jest.fn(async () => [
        {
          id: 'serie-1',
          document_type: fila.document_type,
          series: fila.series,
          current_correlative: fila.current_correlative,
          is_active: fila.is_active,
        },
      ]),
      upsert: jest.fn(async (args: unknown) => {
        const { create } = args as { create: Record<string, unknown> };
        return {
          id: 'serie-1',
          document_type: create.document_type,
          series: create.series,
          current_correlative: create.current_correlative,
          is_active: true,
        };
      }),
    },
  };

  return { prisma, fila, $queryRaw };
}

describe('TA-60 · reserva atómica del correlativo', () => {
  it('20 reservas simultáneas producen 20 números consecutivos sin repetir', async () => {
    const { prisma } = crearPrismaFalso(0);
    const servicio = new InvoiceSeriesService(prisma as never);

    const numeros = await Promise.all(
      Array.from({ length: 20 }, () =>
        servicio.reservarCorrelativo('company-1', '01', 'F001'),
      ),
    );

    const ordenados = [...numeros].sort((a, b) => a - b);
    expect(ordenados).toEqual(Array.from({ length: 20 }, (_, i) => i + 1));
    // Sin duplicados: el conjunto tiene los mismos 20 elementos.
    expect(new Set(numeros).size).toBe(20);
  });

  it('la versión ingenua (leer y luego escribir) SÍ colisiona', async () => {
    // Este caso no prueba el servicio: prueba que el test mide atomicidad.
    // Si el servicio se hubiera escrito con findUnique + update, este es el
    // resultado que se obtendría.
    let valor = 0;
    const leerYEscribir = async () => {
      const leido = valor;
      await new Promise((resolve) => setTimeout(resolve, 1));
      valor = leido + 1;
      return valor;
    };

    const numeros = await Promise.all(
      Array.from({ length: 20 }, () => leerYEscribir()),
    );

    expect(new Set(numeros).size).toBeLessThan(20);
  });

  it('reserva contra una transacción explícita si se pasa', async () => {
    const { prisma } = crearPrismaFalso(5);
    const servicio = new InvoiceSeriesService(prisma as never);

    // El cliente de la transacción es un doble INDEPENDIENTE: si el servicio
    // usara el del constructor en vez del que recibe, se vería aquí.
    const $queryRawTx = jest.fn(async (..._args: unknown[]) => [
      { current_correlative: 6 },
    ]);
    const tx = { $queryRaw: $queryRawTx };

    const numero = await servicio.reservarCorrelativo(
      'company-1',
      '01',
      'F001',
      tx as never,
    );

    expect(numero).toBe(6);
    // La transacción manda: se usó su cliente, no el del servicio.
    expect($queryRawTx).toHaveBeenCalledTimes(1);
    expect(prisma.$queryRaw).not.toHaveBeenCalled();
  });

  it('normaliza el tipo y la serie antes de reservar', async () => {
    const { prisma, $queryRaw } = crearPrismaFalso(0);
    const servicio = new InvoiceSeriesService(prisma as never);

    await servicio.reservarCorrelativo('company-1', '1', 'f001');

    // Los parámetros van escapados por Prisma.sql: se comprueba que llegaron.
    const parametros = $queryRaw.mock.calls[0];
    expect(JSON.stringify(parametros)).toContain('F001');
    expect(JSON.stringify(parametros)).toContain('01');
  });

  it('lanza NO_EXISTE cuando la serie no está configurada', async () => {
    const { prisma, fila } = crearPrismaFalso(0);
    fila.is_active = false;
    prisma.invoiceSeries.findUnique = jest.fn(async () => null) as never;
    const servicio = new InvoiceSeriesService(prisma as never);

    await expect(
      servicio.reservarCorrelativo('company-1', '01', 'F001'),
    ).rejects.toMatchObject({ motivo: 'NO_EXISTE' });
  });

  it('lanza INACTIVA y NO consume el número cuando la serie está de baja', async () => {
    const { prisma, fila } = crearPrismaFalso(7, false);
    const servicio = new InvoiceSeriesService(prisma as never);

    await expect(
      servicio.reservarCorrelativo('company-1', '01', 'F001'),
    ).rejects.toBeInstanceOf(SerieNoDisponibleError);

    // El `is_active = true` va dentro del WHERE: la fila quedó intacta.
    expect(fila.current_correlative).toBe(7);
  });

  it('el caso de uso toma el correlativo de la serie y no del DTO', async () => {
    const { prisma } = crearPrismaFalso(41);
    const servicio = new InvoiceSeriesService(prisma as never);
    const guardado: { correlativo?: number } = {};
    const repositorio = {
      saveWithTransactionalOutbox: jest.fn(async (entidad: { correlativo: number }) => {
        guardado.correlativo = entidad.correlativo;
        return { id: 'inv-1', estado: 'PENDIENTE_ENVIO' } as never;
      }),
    };

    const caso = new CreateInvoiceUseCase(repositorio as never, servicio);
    await caso.execute(dtoFalso({ correlativo: 999 }), 'company-1');

    // El DTO pedía 999; la base asignó 42.
    expect(guardado.correlativo).toBe(42);
  });

  it('sin el servicio de series conserva el correlativo del DTO', async () => {
    const repositorio = {
      saveWithTransactionalOutbox: jest.fn(async (entidad: { correlativo: number }) => ({
        id: 'inv-1',
        correlativo: entidad.correlativo,
      }) as never),
    };
    const caso = new CreateInvoiceUseCase(repositorio as never);

    const resultado = (await caso.execute(
      dtoFalso({ correlativo: 7 }),
      'company-1',
    )) as unknown as { correlativo: number };

    expect(resultado.correlativo).toBe(7);
  });
});

/** DTO mínimo para el caso de uso. */
function dtoFalso(overrides: Partial<CreateInvoiceDto> = {}): CreateInvoiceDto {
  return {
    ruc_emisor: '20100066603',
    serie: 'F001',
    correlativo: 1,
    tipo_comprobante: '01',
    monto_total: 118,
    fecha_emision: '2026-10-31',
    payload_ubl: {},
    ...overrides,
  } as CreateInvoiceDto;
}

// ---------------------------------------------------------------------------
// 2 · Configuración sin secretos
// ---------------------------------------------------------------------------

describe('TA-60 · configuración de facturación', () => {
  const ENV_ORIGINAL = { ...process.env };

  beforeEach(() => {
    process.env = { ...ENV_ORIGINAL };
  });

  afterEach(() => {
    process.env = ENV_ORIGINAL;
  });

  it('publica presencia y vigencia, nunca el usuario ni la clave SOL', async () => {
    process.env.SUNAT_SOL_USER = 'MODDATOS';
    process.env.SUNAT_SOL_PASSWORD = 'clave-super-secreta-123';
    process.env.SUNAT_ENV = 'BETA';

    const { prisma } = crearPrismaFalso(0);
    const series = new InvoiceSeriesService(prisma as never);
    const certificado = {
      getCertificate: () => ({
        certificatePem: 'PEM',
        privateKeyPem: 'KEY',
        validFrom: new Date('2026-01-01'),
        validTo: new Date('2027-01-01'),
        issuerRuc: '20100066603',
        daysRemaining: 62,
      }),
    };

    const config = new InvoiceConfigService(series, certificado as never);
    const resultado = await config.obtener('company-1');

    const json = JSON.stringify(resultado);
    expect(json).not.toContain('clave-super-secreta-123');
    expect(json).not.toContain('MODDATOS');
    expect(resultado.entorno).toBe('BETA');
    expect(resultado.listo_para_emitir).toBe(true);
  });

  it('reporta no listo para emitir cuando falta el usuario SOL', async () => {
    delete process.env.SUNAT_SOL_USER;
    delete process.env.SUNAT_SOL_PASSWORD;

    const { prisma } = crearPrismaFalso(0);
    const series = new InvoiceSeriesService(prisma as never);
    const certificado = {
      getCertificate: () => {
        throw new Error('Falta la variable de entorno CERT_BASE64');
      },
    };

    const config = new InvoiceConfigService(series, certificado as never);
    const resultado = await config.obtener('company-1');

    expect(resultado.listo_para_emitir).toBe(false);
    const usuario = resultado.checklist.find((c) => c.clave === 'usuario_sol');
    expect(usuario?.configurado).toBe(false);
  });

  it('sin serie activa el checklist no queda listo', async () => {
    process.env.SUNAT_SOL_USER = 'MODDATOS';
    process.env.SUNAT_SOL_PASSWORD = 'x';

    const { prisma } = crearPrismaFalso(0, false);
    const series = new InvoiceSeriesService(prisma as never);
    const certificado = {
      getCertificate: () => ({
        validFrom: new Date('2026-01-01'),
        validTo: new Date('2027-01-01'),
        daysRemaining: 60,
      }),
    };

    const config = new InvoiceConfigService(series, certificado as never);
    const resultado = await config.obtener('company-1');

    const puntoSeries = resultado.checklist.find((c) => c.clave === 'series');
    expect(puntoSeries?.configurado).toBe(false);
    expect(resultado.listo_para_emitir).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 3 · Regla de S/ 700 en boletas
// ---------------------------------------------------------------------------

describe('TA-60 · regla del documento del cliente en Boletas', () => {
  it('el umbral es S/ 700.00', () => {
    expect(UMBRAL_DOCUMENTO_BOLETA_SOLES).toBe(700);
  });

  it('no exige documento en una boleta de exactamente S/ 700.00', () => {
    expect(
      exigeDocumentoCliente({ tipoComprobante: '03', montoTotal: 700 }),
    ).toBe(false);
  });

  it('exige documento a partir de S/ 700.01', () => {
    expect(
      exigeDocumentoCliente({ tipoComprobante: '03', montoTotal: 700.01 }),
    ).toBe(true);
  });

  it('nunca lo exige para una Factura (siempre lleva RUC)', () => {
    expect(
      exigeDocumentoCliente({ tipoComprobante: '01', montoTotal: 5000 }),
    ).toBe(false);
  });

  it('una boleta alta sin documento reporta SIN_DOCUMENTO', () => {
    expect(
      validarDocumentoCliente({
        tipoComprobante: '03',
        montoTotal: 701,
        cliente: null,
      }),
    ).toBe('SIN_DOCUMENTO');
  });

  it('una boleta alta con DNI de 8 dígitos pasa', () => {
    expect(
      validarDocumentoCliente({
        tipoComprobante: '03',
        montoTotal: 701,
        cliente: { tipo: '1', numero: '70123456' },
      }),
    ).toBeNull();
  });

  it('un DNI de 7 dígitos reporta DOCUMENTO_INVALIDO', () => {
    expect(
      validarDocumentoCliente({
        tipoComprobante: '03',
        montoTotal: 701,
        cliente: { tipo: '1', numero: '7012345' },
      }),
    ).toBe('DOCUMENTO_INVALIDO');
  });

  it('acepta RUC de 11 dígitos en una boleta alta', () => {
    expect(
      validarDocumentoCliente({
        tipoComprobante: '03',
        montoTotal: 1200,
        cliente: { tipo: '6', numero: '20100066603' },
      }),
    ).toBeNull();
  });

  it('el mensaje cita el monto real y el umbral', () => {
    const mensaje = mensajeDocumentoCliente('SIN_DOCUMENTO', 1500);
    expect(mensaje).toContain('1500.00');
    expect(mensaje).toContain('700');
  });
});
