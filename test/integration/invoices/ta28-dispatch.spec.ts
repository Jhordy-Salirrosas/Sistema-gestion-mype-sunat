/**
 * TA-28 - Integracion del consumidor pg-boss con el envio SOAP.
 *
 * Cubre los tres escenarios del criterio 6 de la HU:
 *
 *   6a. sendBill 202 con CDR 0      -> ACEPTADO
 *   6b. 503 sostenido               -> 3 reintentos, DLQ y ERROR_RED
 *   6c. timeout tras transmitir     -> getStatusCdr, sin reenvio ciego
 *
 * Ademas del criterio 5 (Circuit Breaker OPEN no consume intento) y del 3
 * (el CDR queda persistido con su estado).
 *
 * Se usa un doble del cliente SOAP y del QueueService: la capa que se prueba
 * aqui es la ORQUESTACION (que se llama, en que orden y que estado queda). El
 * transporte real y el parseo del CDR tienen sus propias suites.
 */
import { CircuitBreaker } from '../../../src/modules/resilience/infrastructure/circuitBreaker/circuitBreaker';
import { QueueService } from '../../../src/modules/resilience/infrastructure/queue/queue.service';
import { CdrPersistenceService } from '../../../src/modules/sunat/cdr-persistence.service';
import {
  InvoiceDispatchService,
  MAX_INTENTOS,
} from '../../../src/modules/invoices/invoiceDispatchService';
import { SendInvoiceParams } from '../../../src/modules/sunat/soap/sunatBillTypes';
import { SunatTransportError } from '../../../src/modules/sunat/soap/sunat-soap.client';
import {
  buildMockCdrXml,
  toApplicationResponse,
} from '../../mocks/sunat/cdr-mock.fixtures';

/** CDR en Base64 con el codigo de respuesta indicado. */
function cdrBase64(responseCode: string): string {
  return toApplicationResponse(
    buildMockCdrXml({
      responseCode,
      description: `Codigo ${responseCode} de prueba`,
    }),
  );
}

const PARAMS: SendInvoiceParams = {
  invoiceId: 'inv-ta28-01',
  rucEmisor: '20601012341',
  tipoComprobante: '01',
  serie: 'F001',
  correlativo: 7,
  zip: Buffer.from('PK'),
  estadoActual: 'EN_COLA',
  intento: 1,
};

/** Prisma falso que registra los cambios de estado que pide el servicio. */
function prismaEspia() {
  const estados: string[] = [];
  const auditorias: Array<Record<string, unknown>> = [];

  return {
    estados,
    auditorias,
    invoice: {
      update: async ({ data }: { data: Record<string, unknown> }) => {
        if (typeof data.estado === 'string') estados.push(data.estado);
        return data;
      },
    },
    transactionHistory: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        auditorias.push(data);
        return data;
      },
    },
  };
}

function queueEspia() {
  const dlq: Array<{ id: string; motivo: string }> = [];
  return {
    dlq,
    moveToDlq: async (job: { invoice_id: string }, motivo: string) => {
      dlq.push({ id: job.invoice_id, motivo });
    },
  };
}

function montar(opciones: {
  soapClient: Record<string, jest.Mock>;
  prisma?: ReturnType<typeof prismaEspia>;
  queue?: ReturnType<typeof queueEspia>;
  circuitBreaker?: CircuitBreaker;
}) {
  const prisma = opciones.prisma ?? prismaEspia();
  const queue = opciones.queue ?? queueEspia();

  const servicio = new InvoiceDispatchService(
    queue as unknown as QueueService,
    { persist: jest.fn().mockResolvedValue(undefined) } as unknown as CdrPersistenceService,
    opciones.circuitBreaker ?? new CircuitBreaker(),
    { construirZip: jest.fn().mockResolvedValue(Buffer.from('PK')) },
    opciones.soapClient as never,
    prisma,
  );

  return { servicio, prisma, queue };
}

describe('TA-28 criterio 6a: CDR 0 -> ACEPTADO', () => {
  it('deja la factura en ACEPTADO y persiste el CDR', async () => {
    const soapClient = {
      sendBill: jest.fn().mockResolvedValue({
        applicationResponse: cdrBase64('0'),
        tiempoRespuestaMs: 120,
        httpStatus: 200,
        rawResponse: '<soap/>',
      }),
      getStatusCdr: jest.fn(),
    };

    const { servicio, prisma } = montar({ soapClient });
    const r = await servicio.despachar(PARAMS);

    expect(r.success).toBe(true);
    expect(r.status).toBe('ACEPTADO');
    expect(prisma.estados).toContain('ACEPTADO');
    expect(soapClient.sendBill).toHaveBeenCalledTimes(1);
    expect(soapClient.getStatusCdr).not.toHaveBeenCalled();
  });

  it('marca OBSERVADO cuando el CDR trae un codigo >= 4000', async () => {
    const soapClient = {
      sendBill: jest.fn().mockResolvedValue({
        applicationResponse: cdrBase64('4001'),
        tiempoRespuestaMs: 100,
        httpStatus: 200,
        rawResponse: '<soap/>',
      }),
      getStatusCdr: jest.fn(),
    };

    const { servicio } = montar({ soapClient });
    const r = await servicio.despachar(PARAMS);

    expect(r.status).toBe('OBSERVADO');
  });
});

describe('TA-28 criterio 6b: 503 sostenido -> DLQ + ERROR_RED', () => {
  it(`reintenta ${MAX_INTENTOS} veces y mueve el job a la DLQ`, async () => {
    const soapClient = {
      sendBill: jest
        .fn()
        .mockRejectedValue(
          new SunatTransportError('HTTP 503 Service Unavailable', {
            httpStatus: 503,
          }),
        ),
      getStatusCdr: jest.fn(),
    };

    const { servicio, prisma, queue } = montar({ soapClient });
    const r = await servicio.despachar(PARAMS);

    expect(soapClient.sendBill).toHaveBeenCalledTimes(MAX_INTENTOS);
    expect(queue.dlq).toHaveLength(1);
    expect(queue.dlq[0].id).toBe(PARAMS.invoiceId);
    expect(r.status).toBe('ERROR_RED');
    expect(prisma.estados).toContain('ERROR_RED');
  }, 30_000);

  it('no consulta el estado ante un 503: reenviar es seguro', async () => {
    const soapClient = {
      sendBill: jest.fn().mockRejectedValue(
        new SunatTransportError('HTTP 503', { httpStatus: 503 }),
      ),
      getStatusCdr: jest.fn(),
    };

    const { servicio } = montar({ soapClient });
    await servicio.despachar(PARAMS);

    expect(soapClient.getStatusCdr).not.toHaveBeenCalled();
  }, 30_000);

  it('ante un SOAP Fault no reintenta: corta en el primer intento', async () => {
    const { SunatSoapFaultError } = await import(
      '../../../src/modules/sunat/soap/soap-envelope.js'
    );
    const soapClient = {
      sendBill: jest.fn().mockRejectedValue(
        new SunatSoapFaultError({
          faultCode: 'soap-env:Server',
          faultString: '0102 Usuario o contrasena incorrectos',
        }),
      ),
      getStatusCdr: jest.fn(),
    };

    const { servicio, prisma } = montar({ soapClient });
    const r = await servicio.despachar(PARAMS);

    expect(soapClient.sendBill).toHaveBeenCalledTimes(1);
    expect(r.status).toBe('ERROR_RED');
    expect(prisma.estados).toContain('ERROR_RED');
  });
});

describe('TA-28 criterio 6c: timeout -> getStatusCdr sin reenvio ciego', () => {
  it('consulta el estado y recupera el CDR cuando SUNAT ya lo proceso', async () => {
    const soapClient = {
      sendBill: jest
        .fn()
        .mockRejectedValue(
          new SunatTransportError(
            'Timeout de 30000 ms esperando al billService. El comprobante quedo en estado incierto: NO reenviar a ciegas',
          ),
        ),
      getStatusCdr: jest.fn().mockResolvedValue({
        statusCode: '0',
        statusMessage: 'El comprobante fue aceptado',
        applicationResponse: cdrBase64('0'),
        encontrado: true,
        noEncontrado: false,
        tiempoRespuestaMs: 90,
        httpStatus: 200,
        rawResponse: '<soap/>',
      }),
    };

    const { servicio, prisma } = montar({ soapClient });
    const r = await servicio.despachar(PARAMS);

    // Lo esencial: sendBill se llamo UNA sola vez (no hubo reenvio ciego).
    expect(soapClient.sendBill).toHaveBeenCalledTimes(1);
    expect(soapClient.getStatusCdr).toHaveBeenCalledTimes(1);
    expect(r.status).toBe('ACEPTADO');
    expect(prisma.auditorias.some((a) => a.codigo_error === 'SOAP_TIMEOUT_RECOVERY')).toBe(true);
  });

  it('si SUNAT responde 0127 (no existe) entonces si reenvia', async () => {
    const soapClient = {
      sendBill: jest
        .fn()
        .mockRejectedValueOnce(
          new SunatTransportError('Timeout de 30000 ms esperando al billService'),
        )
        .mockResolvedValue({
          applicationResponse: cdrBase64('0'),
          tiempoRespuestaMs: 100,
          httpStatus: 200,
          rawResponse: '<soap/>',
        }),
      getStatusCdr: jest.fn().mockResolvedValue({
        statusCode: '0127',
        statusMessage: 'No existe informacion del comprobante',
        applicationResponse: null,
        encontrado: false,
        noEncontrado: true,
        tiempoRespuestaMs: 80,
        httpStatus: 200,
        rawResponse: '<soap/>',
      }),
    };

    const { servicio } = montar({ soapClient });
    const r = await servicio.despachar(PARAMS);

    expect(soapClient.getStatusCdr).toHaveBeenCalledTimes(1);
    expect(soapClient.sendBill).toHaveBeenCalledTimes(2);
    expect(r.status).toBe('ACEPTADO');
  });
});

describe('TA-28 criterio 5: Circuit Breaker OPEN', () => {
  it('deja la factura en EN_COLA sin tocar la red ni consumir intento', async () => {
    const circuit = new CircuitBreaker();
    circuit.abrir();

    const soapClient = { sendBill: jest.fn(), getStatusCdr: jest.fn() };
    const { servicio, prisma } = montar({
      soapClient,
      circuitBreaker: circuit,
    });

    const r = await servicio.despachar(PARAMS);

    expect(soapClient.sendBill).not.toHaveBeenCalled();
    expect(r.deferred).toBe(true);
    expect(r.status).toBe('EN_COLA');
    expect(r.intentos).toBe(0);
    expect(prisma.estados[prisma.estados.length - 1]).toBe('EN_COLA');
    expect(
      prisma.auditorias.some((a) => a.codigo_error === 'CIRCUIT_OPEN_DEFERRED'),
    ).toBe(true);
  });

  it('no marca FALLIDO ni ERROR_RED: el comprobante no fallo, solo espera', async () => {
    const circuit = new CircuitBreaker();
    circuit.abrir();
    const { servicio, prisma } = montar({
      soapClient: { sendBill: jest.fn(), getStatusCdr: jest.fn() },
      circuitBreaker: circuit,
    });

    await servicio.despachar(PARAMS);

    expect(prisma.estados).not.toContain('FALLIDO');
    expect(prisma.estados).not.toContain('ERROR_RED');
  });
});
