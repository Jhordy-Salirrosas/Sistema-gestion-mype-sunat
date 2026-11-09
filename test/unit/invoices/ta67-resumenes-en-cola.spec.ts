import { summaryDispatchForTest } from '../../fixtures/summaryDispatchHarness';
/**
 * TA-67 — encolado y sondeo del ticket de resumenes y bajas.
 *
 * QUÉ SE PRUEBA Y POR QUÉ
 *
 * El criterio del backlog no es "que se envíe", sino que el envío **sobreviva**
 * a las dos formas típicas de fallar de SUNAT: el timeout (se reintenta) y el
 * "todavía estoy procesando" (código 98/99, que NO es un error). Si el 98 se
 * tratara como rechazo, el resumen se reenviaría y SUNAT lo rechazaría por
 * duplicado; si el timeout se perdiera, el día quedaría sin informar.
 *
 * Las pruebas usan un cliente falso para no tocar la red y un reloj controlado
 * (`esperaMs: 0`) para que los sondeos no hagan lenta la suite.
 */
import { Logger } from '@nestjs/common';
import {
  CONSULTAS_POR_DEFECTO,
  ESPERA_POR_DEFECTO_MS,
  estaEnProceso,
  interpretarEstadoResumen,
  type SummaryJobData,
} from '../../../src/modules/invoices/application/services/summaryDispatchService';
import { SummaryJobConsumer } from '../../../src/modules/invoices/summaryJobConsumer';
import { parseGetStatusResponse } from '../../../src/modules/sunat/soap/sunatSummaryOperations';

/** Job de ejemplo: un resumen diario con un ZIP mínimo. */
function jobDeEjemplo(extra: Partial<SummaryJobData> = {}): SummaryJobData {
  return {
    tipo: 'RESUMEN_DIARIO',
    identificador: 'RC-20261031-001',
    zipBase64: Buffer.from('PK\u0003\u0004').toString('base64'),
    fileName: '20123456786-RC-20261031-001.zip',
    companyId: 'company-1',
    ...extra,
  };
}

/** Respuesta cruda de `getStatus`. */
function respuestaStatus(
  statusCode: string,
  contenido: string | null = null,
): string {
  const content = contenido
    ? `<content>${contenido}</content>`
    : '<content></content>';
  return `<soap:Envelope><soap:Body><ns2:getStatusResponse><status><statusCode>${statusCode}</statusCode>${content}</status></status></ns2:getStatusResponse></soap:Body></soap:Envelope>`;
}

describe('TA-67 - resumenes diarios y bajas en cola', () => {
  beforeEach(() => {
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('servicio de despacho', () => {
    it('un resumen listo al primer sondeo devuelve el CDR', async () => {
      const cliente = {
        sendSummary: jest.fn(async () => ({
          ticket: '1234567890',
          tiempoRespuestaMs: 10,
          httpStatus: 200,
          rawResponse: '<ticket>1234567890</ticket>',
        })),
        getStatus: jest.fn(async () => ({
          statusCode: '0',
          enProceso: false,
          contenido: 'UEsDBAoAAAAAAA==',
          tiempoRespuestaMs: 5,
          httpStatus: 200,
          rawResponse: '',
        })),
      };

      const servicio = summaryDispatchForTest(
        { encolarResumen: jest.fn() } as never,
        cliente as never,
        { resolve: async () => ({ environment: 'MOCK', endpoint: 'http://127.0.0.1/billService', ruc: '20123456786' }) } as never,
      );

      const resultado = await servicio.procesar(jobDeEjemplo(), { esperaMs: 0 });

      expect(resultado.enviado).toBe(true);
      expect(resultado.ticket).toBe('1234567890');
      expect(resultado.status).toBe('0');
      expect(resultado.contenido).toBe('UEsDBAoAAAAAAA==');
      expect(resultado.consultas).toBe(1);
      expect(resultado.error).toBeNull();
    });

    it('un 98 significa EN PROCESO y no un error: se vuelve a preguntar', async () => {
      const estados = [
        respuestaStatus('98'),
        respuestaStatus('99'),
        respuestaStatus('0', 'UEsDBAoAAAAAAA=='),
      ];
      let i = 0;

      const cliente = {
        sendSummary: jest.fn(async () => ({ ticket: 'T-1' })),
        getStatus: jest.fn(async () => {
          const crudo = estados[i];
          i += 1;
          const parseado = parseGetStatusResponse(crudo);
          return {
            statusCode: parseado.statusCode,
            enProceso: parseado.enProceso,
            contenido: parseado.contenido,
            tiempoRespuestaMs: 1,
            httpStatus: 200,
            rawResponse: crudo,
          };
        }),
      };

      const servicio = summaryDispatchForTest(
        { encolarResumen: jest.fn() } as never,
        cliente as never,
        { resolve: async () => ({ environment: 'MOCK', endpoint: 'http://127.0.0.1/billService', ruc: '20123456786' }) } as never,
      );

      const resultado = await servicio.procesar(jobDeEjemplo(), { esperaMs: 0 });

      expect(resultado.enviado).toBe(true);
      expect(resultado.consultas).toBe(3);
      expect(resultado.status).toBe('0');
      // El envío NO se repite: solo se pregunta de nuevo por el ticket.
      expect(cliente.sendSummary).toHaveBeenCalledTimes(1);
    });

    it('si se agotan los sondeos con 98, informa que SUNAT sigue procesando y no lo llama error', async () => {
      const cliente = {
        sendSummary: jest.fn(async () => ({ ticket: 'T-2' })),
        getStatus: jest.fn(async () => ({
          statusCode: '98',
          enProceso: true,
          contenido: null,
          tiempoRespuestaMs: 1,
          httpStatus: 200,
          rawResponse: '',
        })),
      };

      const servicio = summaryDispatchForTest(
        { encolarResumen: jest.fn() } as never,
        cliente as never,
        { resolve: async () => ({ environment: 'MOCK', endpoint: 'http://127.0.0.1/billService', ruc: '20123456786' }) } as never,
      );

      const resultado = await servicio.procesar(jobDeEjemplo(), {
        esperaMs: 0,
        maxConsultas: 2,
      });

      expect(resultado.enviado).toBe(false);
      expect(resultado.status).toBe('98');
      // 1 sondeo inicial + 2 reintentos preguntados.
      expect(resultado.consultas).toBe(3);
      expect(resultado.error).toContain('sigue procesando');
    });

    it('un rechazo definitivo (status distinto de 98/99 y sin CDR) no se reintenta', async () => {
      const cliente = {
        sendSummary: jest.fn(async () => ({ ticket: 'T-3' })),
        getStatus: jest.fn(async () => ({
          statusCode: '2326',
          enProceso: false,
          contenido: null,
          tiempoRespuestaMs: 1,
          httpStatus: 200,
          rawResponse: '',
        })),
      };

      const servicio = summaryDispatchForTest(
        { encolarResumen: jest.fn() } as never,
        cliente as never,
        { resolve: async () => ({ environment: 'MOCK', endpoint: 'http://127.0.0.1/billService', ruc: '20123456786' }) } as never,
      );

      const resultado = await servicio.procesar(jobDeEjemplo(), { esperaMs: 0 });

      expect(resultado.enviado).toBe(false);
      expect(resultado.status).toBe('2326');
      expect(resultado.consultas).toBe(1);
      expect(resultado.error).toContain('2326');
    });

    it('un fallo de sendSummary se informa sin lanzar', async () => {
      const cliente = {
        sendSummary: jest.fn(async () => {
          throw new Error('Timeout de 30000 ms esperando al billService');
        }),
        getStatus: jest.fn(),
      };

      const servicio = summaryDispatchForTest(
        { encolarResumen: jest.fn() } as never,
        cliente as never,
        { resolve: async () => ({ environment: 'MOCK', endpoint: 'http://127.0.0.1/billService', ruc: '20123456786' }) } as never,
      );

      const resultado = await servicio.procesar(jobDeEjemplo(), { esperaMs: 0 });

      expect(resultado.enviado).toBe(false);
      expect(resultado.ticket).toBeNull();
      expect(resultado.error).toContain('Timeout');
      expect(cliente.getStatus).not.toHaveBeenCalled();
    });

    it('sin ticket no hay nada que consultar y se informa como fallo', async () => {
      const cliente = {
        sendSummary: jest.fn(async () => ({ ticket: null })),
        getStatus: jest.fn(),
      };

      const servicio = summaryDispatchForTest(
        { encolarResumen: jest.fn() } as never,
        cliente as never,
        { resolve: async () => ({ environment: 'MOCK', endpoint: 'http://127.0.0.1/billService', ruc: '20123456786' }) } as never,
      );

      const resultado = await servicio.procesar(jobDeEjemplo(), { esperaMs: 0 });

      expect(resultado.enviado).toBe(false);
      expect(resultado.error).toContain('no devolvió ticket');
      expect(cliente.getStatus).not.toHaveBeenCalled();
    });

    it('un job sin ZIP se rechaza sin llamar a SUNAT', async () => {
      const cliente = {
        sendSummary: jest.fn(),
        getStatus: jest.fn(),
      };

      const servicio = summaryDispatchForTest(
        { encolarResumen: jest.fn() } as never,
        cliente as never,
        { resolve: async () => ({ environment: 'MOCK', endpoint: 'http://127.0.0.1/billService', ruc: '20123456786' }) } as never,
      );

      const resultado = await servicio.procesar(jobDeEjemplo({ zipBase64: '' }), {
        esperaMs: 0,
      });

      expect(resultado.enviado).toBe(false);
      expect(cliente.sendSummary).toHaveBeenCalledTimes(1);
      expect(resultado.identificador).toBe(jobDeEjemplo().identificador);
    });

    it('encolar delega en la cola con los valores por defecto de sondeo', async () => {
      const encolarResumen = jest.fn<
        Promise<string | null>,
        [Record<string, unknown>]
      >(async () => 'job-1');
      const servicio = summaryDispatchForTest(
        { encolarResumen } as never,
        { sendSummary: jest.fn(), getStatus: jest.fn() } as never,
      );

      const id = await servicio.encolar(jobDeEjemplo());

      expect(id).toBe('job-1');
      const enviado = encolarResumen.mock.calls[0][0];
      expect(enviado.maxConsultas).toBe(CONSULTAS_POR_DEFECTO);
      expect(enviado.esperaMs).toBe(ESPERA_POR_DEFECTO_MS);
    });
  });

  describe('consumidor de la cola', () => {
    function construir(resultado: unknown) {
      const procesar = jest.fn(async () => resultado);
      const registerSummaryWorker = jest.fn();
      const consumidor = new SummaryJobConsumer(
        { registerSummaryWorker } as never,
        { procesar } as never,
      );
      return { consumidor, procesar, registerSummaryWorker };
    }

    it('registra el worker al iniciar', async () => {
      const { consumidor, registerSummaryWorker } = construir(null);
      await consumidor.onModuleInit();
      expect(registerSummaryWorker).toHaveBeenCalledTimes(1);
    });

    it('un envío completo no lanza y devuelve el resultado', async () => {
      const { consumidor } = construir({
        enviado: true,
        identificador: 'RC-20261031-001',
        ticket: 'T',
        status: '0',
        contenido: 'AAA',
        consultas: 1,
        error: null,
      });

      await expect(consumidor.procesar(jobDeEjemplo())).resolves.toMatchObject({
        enviado: true,
      });
    });

    it('un 98 al agotar sondeos SÍ lanza, para que pg-boss reintente el resumen', async () => {
      const { consumidor } = construir({
        enviado: false,
        identificador: 'RC-20261031-001',
        ticket: 'T',
        status: '98',
        contenido: null,
        consultas: 31,
        error: 'SUNAT sigue procesando (código 98)',
      });

      await expect(consumidor.procesar(jobDeEjemplo())).rejects.toThrow(/98/);
    });

    it('un fallo sin ticket también lanza: el resumen todavía puede informarse', async () => {
      const { consumidor } = construir({
        enviado: false,
        identificador: 'RC-20261031-001',
        ticket: null,
        status: null,
        contenido: null,
        consultas: 0,
        error: 'Timeout de 30000 ms',
      });

      await expect(consumidor.procesar(jobDeEjemplo())).rejects.toThrow(/Timeout/);
    });

    it('un rechazo definitivo NO lanza: reintentar no lo arregla', async () => {
      const { consumidor } = construir({
        enviado: false,
        identificador: 'RC-20261031-001',
        ticket: 'T',
        status: '2326',
        contenido: null,
        consultas: 1,
        error: 'SUNAT respondió 2326 sin CDR',
      });

      await expect(consumidor.procesar(jobDeEjemplo())).resolves.toMatchObject({
        status: '2326',
      });
    });

    it('un job sin identificador se descarta sin llamar al despachador', async () => {
      const { consumidor, procesar } = construir(null);
      const resultado = await consumidor.procesar({} as SummaryJobData);
      expect(resultado).toBeNull();
      expect(procesar).not.toHaveBeenCalled();
    });
  });

  describe('utilidades de estado', () => {
    it.each([
      ['98', true],
      ['99', true],
      ['0', false],
      ['2326', false],
      [null, false],
    ])('estaEnProceso(%p) = %p', (codigo, esperado) => {
      expect(estaEnProceso(codigo)).toBe(esperado);
    });

    it('interpretarEstadoResumen lee el sobre y detecta el proceso en curso', () => {
      const crudo = respuestaStatus('98');
      const leido = interpretarEstadoResumen(crudo);
      expect(leido.status).toBe('98');
      expect(leido.enProceso).toBe(true);
      expect(leido.contenido).toBeNull();
    });

    it('interpretarEstadoResumen devuelve el contenido cuando ya está listo', () => {
      const leido = interpretarEstadoResumen(respuestaStatus('0', 'UEsDBAo='));
      expect(leido.status).toBe('0');
      expect(leido.enProceso).toBe(false);
      expect(leido.contenido).toBe('UEsDBAo=');
    });
  });
});
