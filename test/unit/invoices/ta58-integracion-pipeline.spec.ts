/**
 * TA-58 · cierre de la integración del pipeline en dev.
 *
 * Las piezas existían por separado y ninguna las unía. Este spec protege las
 * cuatro uniones que faltaban:
 *
 *  1. `InvoiceJobConsumer` invoca la compuerta XSL de TA-31 antes de enviar y,
 *     si el XML está mal emitido, NO se abre socket SOAP.
 *  2. `ErrorValidacionBloqueada` (falta la hoja oficial) no marca el
 *     comprobante como rechazado ni lo manda a la DLQ: el job vuelve a la cola.
 *  3. `SunatStatusConsultaService` reconoce 0127 y 0011 como NO_ENCONTRADO y
 *     solo consulta al billConsultService para series F.
 *  4. Un lote de 10 comprobantes se drena cuando el Circuit Breaker vuelve a
 *     CLOSED, y `InvoiceRetryService` recibe la consulta de estado ya enlazada
 *     (deja de verla como `undefined`).
 *
 * Los dobles son objetos planos: se prueba el cableado, no la base de datos.
 */
import { describe, expect, it, jest, beforeEach, afterEach } from '@jest/globals';
import { Logger } from '@nestjs/common';
import { InvoiceStatus } from '../../../src/generated/client/enums';
import {
  ErrorValidacionBloqueada,
  validarAntesDeEnviar,
} from '../../../src/modules/invoices/application/services/invoiceSendGate';
import type { ResultadoValidacionXsl } from '../../../src/modules/invoices/application/services/sunatXslValidatorService';
import { InvoiceJobConsumer } from '../../../src/modules/invoices/invoiceJobConsumer';
import { ResilienceStateService } from '../../../src/modules/resilience/application/resilienceStateService';
import { InvoiceDlqService } from '../../../src/modules/resilience/infrastructure/queue/invoiceDlqService';
import {
  InvoiceRetryService,
  type ConsultaEstadoPort,
} from '../../../src/modules/resilience/infrastructure/queue/invoiceRetryService';
import type { QueueService } from '../../../src/modules/resilience/infrastructure/queue/queue.service';
import type { PrismaService } from '../../../src/database/prismaService';
import { SunatStatusConsultaService } from '../../../src/modules/sunat/statusConsultaService';
import type { SunatBillService } from '../../../src/modules/sunat/sunat-bill.service';
import type {
  ProcessCdrResult,
  SendInvoiceParams,
} from '../../../src/modules/sunat/soap/sunatBillTypes';

// ---------------------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------------------

function silenciarLogger(): void {
  jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
  jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
  jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
}

/** Resultado de la hoja oficial: válido por defecto. */
const VALIDO: ResultadoValidacionXsl = {
  valido: true,
  errores: [],
  codigosDesconocidos: [],
  bloqueado: false,
  motivoBloqueo: null,
  validadoDeVerdad: true,
};

/** La hoja oficial encontró una regla incumplida (código 2xxx). */
function conErrores(...codigos: string[]): ResultadoValidacionXsl {
  return {
    valido: false,
    errores: codigos.map((codigo) => ({
      codigo,
      mensaje: `El XML no cumple la regla ${codigo} de SUNAT`,
      regla: null,
    })),
    codigosDesconocidos: [],
    bloqueado: false,
    motivoBloqueo: null,
    validadoDeVerdad: true,
  };
}

/** No se pudo ejecutar la validación: falta la hoja o falló. */
function bloqueada(motivo: string): ResultadoValidacionXsl {
  return {
    valido: false,
    errores: [],
    codigosDesconocidos: [],
    bloqueado: true,
    motivoBloqueo: motivo,
    validadoDeVerdad: false,
  };
}

/** Comprobante que devuelve Prisma. `xml_storage_url` trae el XML ya firmado. */
function comprobante(serie = 'F001', correlativo = 1) {
  return {
    fecha_emision: new Date('2026-11-08'),
    id: `inv-${serie}-${correlativo}`,
    ruc_emisor: '20601012341',
    tipo_comprobante: serie.startsWith('F') ? '01' : '03',
    serie,
    correlativo,
    estado: InvoiceStatus.EN_COLA,
    payload_ubl: { rucEmisor: '20601012341', tipoComprobante: '01' },
    xml_storage_url:
      '<?xml version="1.0"?><Invoice><ds:Signature/></Invoice>',
  };
}

// ---------------------------------------------------------------------------
// 1 y 2 · La compuerta XSL dentro del consumidor
// ---------------------------------------------------------------------------

interface DoblesConsumidor {
  consumidor: InvoiceJobConsumer;
  processWithRetry: jest.Mock<(params: SendInvoiceParams) => Promise<unknown>>;
  validarXsl: jest.Mock<(xml: string, tipo: string) => Promise<ResultadoValidacionXsl>>;
  persistFailure: jest.Mock<(args: unknown) => Promise<unknown>>;
  update: jest.Mock<(args: unknown) => Promise<unknown>>;
}

function crearConsumidor(
  filas: Record<string, ReturnType<typeof comprobante>>,
  xsl: (xml: string, tipo: string) => ResultadoValidacionXsl,
): DoblesConsumidor {
  const processWithRetry = jest.fn(async (params: SendInvoiceParams) => ({
    invoiceId: params.invoiceId,
    estado: InvoiceStatus.ACEPTADO,
  }));
  const validarXsl = jest.fn(async (xml: string, tipo: string) => xsl(xml, tipo));
  const persistFailure = jest.fn(async (_args: unknown) => ({}));

  const findUnique = jest.fn(async (args: unknown) => {
    const { where } = args as { where: { id: string } };
    return filas[where.id] ?? null;
  });
  const update = jest.fn(async (_args: unknown) => ({}));

  const consumidor = new InvoiceJobConsumer(
    { registerInvoiceWorker: jest.fn() } as never,
    { processWithRetry } as never,
    { invoice: { findUnique, update } } as never,
    { generateInvoiceXml: jest.fn() } as never,
    { validateInvoiceUbl21: jest.fn() } as never,
    { verifySignature: jest.fn(() => true), signXml: jest.fn() } as never,
    { validar: validarXsl } as never,
    { persistFailure } as never,
    // TA-68: el puente contable se ejercita en su propia suite; aqui es un
    // doble inerte para no mezclar dos responsabilidades en las mismas pruebas.
    { registrar: jest.fn(async () => ({ completo: true, asientoOmitido: true, errores: [], movimientosRegistrados: 0, movimientosOmitidos: 0 })) } as never,
    // Guarda el XML firmado para que la descarga entregue el documento real.
    { guardar: jest.fn(async () => 'hash-de-prueba') } as never,
  );

  return { consumidor, processWithRetry, validarXsl, persistFailure, update };
}

describe('TA-58 · compuerta XSL dentro del consumidor', () => {
  beforeEach(() => {
    silenciarLogger();
    process.env.CERT_BASE64 = 'certificado-de-prueba';
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('ejecuta la hoja oficial sobre el XML firmado antes de enviar', async () => {
    const d = crearConsumidor({ 'inv-F001-1': comprobante() }, () => VALIDO);

    const aprobado = await d.consumidor.preparar('inv-F001-1');

    expect(d.validarXsl).toHaveBeenCalledTimes(1);
    const [xml, tipo] = d.validarXsl.mock.calls[0];
    // Se valida el XML FIRMADO: la hoja oficial lee el ds:Signature.
    expect(xml).toContain('<ds:Signature');
    expect(tipo).toBe('01');
    expect(aprobado.bloqueoXsl).toBeNull();
  });

  it('bloquea un XML inválido sin abrir socket SOAP', async () => {
    const d = crearConsumidor({ 'inv-F001-1': comprobante() }, () =>
      conErrores('2027', '3284'),
    );

    const resultado = await d.consumidor.procesar({ invoice_id: 'inv-F001-1' });

    // Lo que importa: SUNAT no se toca desde este archivo.
    expect(d.processWithRetry).not.toHaveBeenCalled();
    expect(resultado).toBeNull();
    // El rechazo queda auditado igual que un rechazo de SUNAT.
    expect(d.persistFailure).toHaveBeenCalledWith(
      expect.objectContaining({
        invoiceId: 'inv-F001-1',
        estadoNuevo: InvoiceStatus.RECHAZADO,
        codigoError: '2027',
      }),
    );
  });

  it('envía el comprobante cuando la hoja no reporta errores', async () => {
    const d = crearConsumidor({ 'inv-F001-1': comprobante() }, () => VALIDO);

    await d.consumidor.procesar({ invoice_id: 'inv-F001-1' });

    expect(d.processWithRetry).toHaveBeenCalledTimes(1);
    expect(d.persistFailure).not.toHaveBeenCalled();
  });

  it('no consume intento ni va a la DLQ si falta la hoja oficial', async () => {
    const d = crearConsumidor({ 'inv-F001-1': comprobante() }, () =>
      bloqueada('No se pudo cargar la hoja oficial'),
    );

    // El job se relanza para que pg-boss lo reentregue cuando la hoja exista.
    await expect(
      d.consumidor.procesar({ invoice_id: 'inv-F001-1' }),
    ).rejects.toBeInstanceOf(ErrorValidacionBloqueada);

    expect(d.processWithRetry).not.toHaveBeenCalled();
    // No se marca RECHAZADO ni ERROR_RED: el comprobante puede estar perfecto.
    expect(d.update).not.toHaveBeenCalled();
    expect(d.persistFailure).not.toHaveBeenCalled();
  });

  it('un ERROR de la compuerta no se confunde con un fallo de preparación', async () => {
    const d = crearConsumidor({ 'inv-F001-1': comprobante() }, () =>
      conErrores('3030'),
    );

    await d.consumidor.procesar({ invoice_id: 'inv-F001-1' });

    // Sin la distinción de TA-58, este caso caía en ERROR_RED por el catch.
    expect(d.update).not.toHaveBeenCalledWith(
      expect.objectContaining({
        data: { estado: InvoiceStatus.ERROR_RED },
      }),
    );
  });
});

// ---------------------------------------------------------------------------
// 2 (unidad) · El contrato de la compuerta
// ---------------------------------------------------------------------------

describe('TA-58 · contrato de validarAntesDeEnviar', () => {
  const params: SendInvoiceParams = {
    invoiceId: 'inv-F001-1',
    rucEmisor: '20601012341',
    tipoComprobante: '01',
    serie: 'F001',
    correlativo: 1,
    zip: Buffer.from('zip'),
    estadoActual: InvoiceStatus.EN_COLA,
  };

  beforeEach(silenciarLogger);
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('devuelve null cuando el XML es válido', async () => {
    const resultado = await validarAntesDeEnviar(
      params,
      '<Invoice/>',
      { validar: async () => VALIDO } as never,
      { persistFailure: jest.fn() } as never,
    );

    expect(resultado).toBeNull();
  });

  it('lanza ErrorValidacionBloqueada marcando que no consume intento', async () => {
    const error = new ErrorValidacionBloqueada('sin hoja', 'SIN_HOJA');

    expect(error.reintentableSinConsumirIntento).toBe(true);
    expect(error.motivo).toBe('SIN_HOJA');

    await expect(
      validarAntesDeEnviar(
        params,
        '<Invoice/>',
        { validar: async () => bloqueada('sin hoja') } as never,
        { persistFailure: jest.fn() } as never,
      ),
    ).rejects.toBeInstanceOf(ErrorValidacionBloqueada);
  });

  it('marca RECHAZADO con reintentable false cuando hay errores 2xxx', async () => {
    const persistFailure = jest.fn(async (_args: unknown) => ({}));
    const resultado = await validarAntesDeEnviar(
      params,
      '<Invoice/>',
      { validar: async () => conErrores('2027') } as never,
      { persistFailure } as never,
    );

    expect(resultado).not.toBeNull();
    expect(resultado?.estado).toBe(InvoiceStatus.RECHAZADO);
    // false = no alimenta el backoff ni la DLQ: el XML está mal, no la red.
    expect(resultado?.reintentable).toBe(false);
    expect(persistFailure).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// 3 · statusConsultaService: 0127 / 0011 y filtro de serie
// ---------------------------------------------------------------------------

interface DoblesConsulta {
  servicio: SunatStatusConsultaService;
  getStatusCdr: jest.Mock<(params: unknown) => Promise<unknown>>;
}

function crearConsulta(respuesta: {
  responseCode: string | null;
  applicationResponse?: string | null;
}): DoblesConsulta {
  const getStatusCdr = jest.fn(async (_params: unknown) => ({
    applicationResponse: respuesta.applicationResponse ?? null,
    responseCode: respuesta.responseCode,
    description: null,
    referenceId: null,
    tiempoRespuestaMs: 40,
    httpStatus: 200,
    rawResponse: '<xml/>',
    encontrado: !['0127', '0011'].includes(respuesta.responseCode ?? ''),
  }));

  const prisma = {
    invoice: {
      findUnique: jest.fn(async () => ({
        estado: InvoiceStatus.ENVIADO,
        company_id: 'company-1',
      })),
    },
    auditLog: { create: jest.fn(async () => ({})) },
  };

  const servicio = new SunatStatusConsultaService(
    { persist: jest.fn(async () => ({})) } as never,
    prisma as unknown as PrismaService,
    { getStatusCdr } as never,
  );

  return { servicio, getStatusCdr };
}

const consultaBase = {
  invoiceId: 'inv-F001-7',
  rucEmisor: '20601012341',
  tipoComprobante: '01',
  serie: 'F001',
  correlativo: 7,
};

describe('TA-58 · consulta de estado', () => {
  beforeEach(silenciarLogger);
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it.each(['0127', '0011'])(
    'trata el código %s como NO_ENCONTRADO',
    async (codigo) => {
      const d = crearConsulta({ responseCode: codigo });
      const desenlace = await d.servicio.consultar(consultaBase);

      expect(desenlace.tipo).toBe('NO_ENCONTRADO');
    },
  );

  it('normaliza el código sin ceros de relleno (127 -> 0127)', async () => {
    const d = crearConsulta({ responseCode: '127' });
    const desenlace = await d.servicio.consultar(consultaBase);

    expect(desenlace.tipo).toBe('NO_ENCONTRADO');
  });

  it('consulta billConsultService solo para series que empiezan con F', async () => {
    const d = crearConsulta({ responseCode: '0', applicationResponse: null });
    await d.servicio.consultar(consultaBase);

    expect(d.getStatusCdr).toHaveBeenCalledTimes(1);
  });

  it('no consulta una serie B y responde INCIERTO sin tocar la red', async () => {
    const d = crearConsulta({ responseCode: '0' });
    const desenlace = await d.servicio.consultar({
      ...consultaBase,
      tipoComprobante: '03',
      serie: 'B001',
      invoiceId: 'inv-B001-7',
    });

    expect(d.getStatusCdr).not.toHaveBeenCalled();
    expect(desenlace.tipo).toBe('INCIERTO');
    // INCIERTO no autoriza a reenviar: la boleta va por el resumen diario.
    if (desenlace.tipo === 'INCIERTO') {
      expect(desenlace.motivo).toMatch(/B001/);
    }
  });

  it('acepta la serie F en minúsculas', async () => {
    const d = crearConsulta({ responseCode: '0', applicationResponse: null });
    await d.servicio.consultar({ ...consultaBase, serie: 'f001' });

    expect(d.getStatusCdr).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// 4 · Drenado del lote y enlace del puerto
// ---------------------------------------------------------------------------

const LOTE = 10;

function aceptado(invoiceId: string): ProcessCdrResult {
  return {
    invoiceId,
    responseCode: '0',
    estado: InvoiceStatus.ACEPTADO,
    valido: true,
    reintentable: false,
    clasificacion: {
      status: InvoiceStatus.ACEPTADO,
      kind: 'ACEPTADO',
      valido: true,
      reintentable: false,
    },
    cdr: null,
    tiempoRespuestaMs: 60,
    error: null,
  };
}

describe('TA-58 · drenado del lote con el circuito restablecido', () => {
  beforeEach(silenciarLogger);
  afterEach(() => {
    jest.restoreAllMocks();
  });

  function crearRetry(
    sunat: SunatBillService,
    state: ResilienceStateService,
    consulta?: ConsultaEstadoPort,
  ): InvoiceRetryService {
    const tx = {
      invoice: { update: jest.fn(async () => ({ company_id: 'company-1' })) },
      transactionHistory: { create: jest.fn(async () => ({})) },
    };
    const prisma = {
      $transaction: jest.fn(async (cb: (c: typeof tx) => Promise<unknown>) =>
        cb(tx),
      ),
    };

    return new InvoiceRetryService(
      new InvoiceDlqService(
        prisma as unknown as PrismaService,
        { sendToDlq: jest.fn(async () => 'dlq-1') } as unknown as QueueService,
      ),
      sunat,
      state,
      jest.fn(async () => undefined),
      consulta,
    );
  }

  it('drena los 10 comprobantes cuando el circuito vuelve a CLOSED', async () => {
    const state = new ResilienceStateService();
    const sendAndProcess = jest.fn(async (params: SendInvoiceParams) =>
      aceptado(params.invoiceId),
    );
    const servicio = crearRetry(
      { sendAndProcess } as unknown as SunatBillService,
      state,
    );

    // Antes: SUNAT caía y el circuito se abría.
    for (let i = 0; i < 5; i += 1) state.registrarResultadoEnvio(true);
    expect(state.puedeEnviar()).toBe(false);

    // Los jobs entrantes no tocan la red y quedan en cola.
    const params = (invoiceId: string): SendInvoiceParams => ({
      invoiceId,
      rucEmisor: '20601012341',
      tipoComprobante: '01',
      serie: 'F001',
      correlativo: 1,
      zip: Buffer.from('zip'),
      estadoActual: InvoiceStatus.EN_COLA,
    });
    const diferidos = await Promise.all(
      Array.from({ length: LOTE }, (_, i) => servicio.processWithRetry(params(`plan-${i}`))),
    );
    expect(diferidos.every((r) => r.circuitoAbierto)).toBe(true);
    expect(sendAndProcess).not.toHaveBeenCalled();

    // SUNAT se restablece: un envío correcto cierra el circuito.
    state.registrarResultadoEnvio(false);
    expect(state.puedeEnviar()).toBe(true);

    // Se drena el mismo lote.
    const drenados: string[] = [];
    for (let i = 0; i < LOTE; i += 1) {
      const r = await servicio.processWithRetry(params(`lote-${i}`));
      if (r.estado === InvoiceStatus.ACEPTADO) drenados.push(r.invoiceId);
    }

    expect(drenados).toHaveLength(LOTE);
    expect(sendAndProcess).toHaveBeenCalledTimes(LOTE);
  });

  it('InvoiceRetryService recibe la consulta de estado y la usa', async () => {
    const state = new ResilienceStateService();
    const sendAndProcess = jest.fn(async () => ({
      ...aceptado('inv-F001-1'),
      // Timeout: CDR perdido, estado incierto -> dispara la conciliación.
      valido: false,
      reintentable: true,
      cdr: null,
      estado: InvoiceStatus.ENVIADO,
      tiempoRespuestaMs: null,
    }));
    const consultarEstado = jest.fn(async () => ({
      ...aceptado('inv-F001-1'),
      cdr: { responseCode: '0' } as never,
    }));

    const servicio = crearRetry(
      { sendAndProcess } as unknown as SunatBillService,
      state,
      { consultarEstado } as unknown as ConsultaEstadoPort,
    );

    const resultado = await servicio.processWithRetry({
      invoiceId: 'inv-F001-1',
      rucEmisor: '20601012341',
      tipoComprobante: '01',
      serie: 'F001',
      correlativo: 1,
      zip: Buffer.from('zip'),
      estadoActual: InvoiceStatus.EN_COLA,
    });

    // Gracias al enlace de TA-58 el puerto ya no llega como undefined.
    expect(consultarEstado).toHaveBeenCalledTimes(1);
    expect(resultado.estado).toBe(InvoiceStatus.ACEPTADO);
    // El CDR se recuperó sin reenviar.
    expect(sendAndProcess).toHaveBeenCalledTimes(1);
  });
});
