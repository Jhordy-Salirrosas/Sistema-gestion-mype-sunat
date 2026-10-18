/**
 * Inyector de fallos del Mock del billService (TA-12).
 *
 * Verifica cada modo POR SEPARADO (criterio 4) y que la latencia sea
 * configurable en caliente, sin reiniciar el servicio ni cambiar codigo.
 *
 * Las latencias reales son de 15 s y 3 s. Las pruebas las reducen por variable
 * de entorno para no esperar: lo que se verifica es que la demora SE APLIQUE,
 * no su magnitud, que es configuracion.
 */
import { Test, TestingModule } from '@nestjs/testing';
import { HttpStatus } from '@nestjs/common';
import { SunatMockService } from '../../../src/modules/resilience/infrastructure/mock/sunat-mock.service';
import {
  FAULT_RUC_BY_MODE,
  FAULT_SOAP_CODE,
  SLOW_MS_ENV_VAR,
  SunatFaultMode,
  TIMEOUT_MS_ENV_VAR,
} from '../../../src/modules/resilience/infrastructure/mock/sunat-fault-injection.fixtures';

/** Latencia reducida para que las pruebas no esperen segundos. */
const TEST_LATENCY_MS = 60;

/** Margen para medir una demora sin depender de la precision del reloj. */
const MARGIN_MS = 10;

/** RUC normal: no activa ningun modo, recibe el CDR aceptado. */
const RUC_NORMAL = '20123456786';

describe('Inyector de fallos del Mock del billService (TA-12)', () => {
  let service: SunatMockService;

  const fileNameConRuc = (ruc: string): string => `${ruc}-01-F001-1.zip`;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [SunatMockService],
    }).compile();

    service = module.get<SunatMockService>(SunatMockService);
  });

  afterEach(() => {
    delete process.env[TIMEOUT_MS_ENV_VAR];
    delete process.env[SLOW_MS_ENV_VAR];
  });

  describe('modo SERVICE_UNAVAILABLE (HTTP 503)', () => {
    it('devuelve HTTP 503 forzado y un SOAP Fault', async () => {
      const res = await service.resolveResponse(
        fileNameConRuc(FAULT_RUC_BY_MODE[SunatFaultMode.SERVICE_UNAVAILABLE]),
      );

      expect(res.status).toBe(HttpStatus.SERVICE_UNAVAILABLE);
      expect(res.body).toContain('Fault');
      expect(res.body).toContain('503');
    });
  });

  describe('modo TIMEOUT (demora mayor a 10 s)', () => {
    it('retrasa la respuesta antes de responder', async () => {
      process.env[TIMEOUT_MS_ENV_VAR] = String(TEST_LATENCY_MS);

      const inicio = Date.now();
      const res = await service.resolveResponse(
        fileNameConRuc(FAULT_RUC_BY_MODE[SunatFaultMode.TIMEOUT]),
      );
      const transcurrido = Date.now() - inicio;

      expect(transcurrido).toBeGreaterThanOrEqual(TEST_LATENCY_MS - MARGIN_MS);
      // Tras la demora devuelve una respuesta correcta, como una SUNAT lenta.
      expect(res.status).toBe(HttpStatus.OK);
    });

    it('por defecto la demora supera los 10 s que exige el criterio', () => {
      delete process.env[TIMEOUT_MS_ENV_VAR];
      const {
        resolveTimeoutMs,
      } = require('../../../src/modules/resilience/infrastructure/mock/sunat-fault-injection.fixtures');
      expect(resolveTimeoutMs()).toBeGreaterThan(10_000);
    });
  });

  describe('modo SOAP_FAULT (error de negocio)', () => {
    it('devuelve HTTP 500 con el faultcode y el faultstring de SUNAT', async () => {
      const res = await service.resolveResponse(
        fileNameConRuc(FAULT_RUC_BY_MODE[SunatFaultMode.SOAP_FAULT]),
      );

      expect(res.status).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
      expect(res.body).toContain('<faultcode>');
      expect(res.body).toContain(FAULT_SOAP_CODE);
      expect(res.body).toContain('faultstring');
    });
  });

  describe('modo SLOW (latencia configurable)', () => {
    it('aplica la latencia configurada por variable de entorno', async () => {
      process.env[SLOW_MS_ENV_VAR] = String(TEST_LATENCY_MS);

      const inicio = Date.now();
      const res = await service.resolveResponse(
        fileNameConRuc(FAULT_RUC_BY_MODE[SunatFaultMode.SLOW]),
      );
      const transcurrido = Date.now() - inicio;

      expect(transcurrido).toBeGreaterThanOrEqual(TEST_LATENCY_MS - MARGIN_MS);
      expect(res.status).toBe(HttpStatus.OK);
    });

    it('lee la latencia EN CADA PETICION, sin reiniciar el servicio', async () => {
      process.env[SLOW_MS_ENV_VAR] = '20';
      const inicio = Date.now();
      await service.resolveResponse(
        fileNameConRuc(FAULT_RUC_BY_MODE[SunatFaultMode.SLOW]),
      );
      const primera = Date.now() - inicio;

      // Se cambia la variable DESPUES de la primera peticion, sin recargar el
      // modulo ni recrear el servicio.
      process.env[SLOW_MS_ENV_VAR] = '150';
      const inicio2 = Date.now();
      await service.resolveResponse(
        fileNameConRuc(FAULT_RUC_BY_MODE[SunatFaultMode.SLOW]),
      );
      const segunda = Date.now() - inicio2;

      expect(segunda).toBeGreaterThan(primera);
    });
  });

  describe('RUC normal (sin inyeccion)', () => {
    it('devuelve HTTP 200 con el CDR aceptado, como antes de TA-12', async () => {
      const res = await service.resolveResponse(fileNameConRuc(RUC_NORMAL));

      expect(res.status).toBe(HttpStatus.OK);
      expect(res.body).toContain('<applicationResponse>');
      expect(res.body).toContain('sendBillResponse');
      // No debe contener Fault: es el camino feliz.
      expect(res.body).not.toContain('Fault');
    });
  });
});
