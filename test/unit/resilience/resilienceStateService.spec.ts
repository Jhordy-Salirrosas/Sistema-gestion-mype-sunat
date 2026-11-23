import { ResilienceStateService } from '../../../src/modules/resilience/application/resilienceStateService';
import { SunatFaultMode } from '../../../src/modules/resilience/infrastructure/mock/sunat-fault-injection.fixtures';

describe('ResilienceStateService', () => {
  let service: ResilienceStateService;

  beforeEach(() => {
    service = new ResilienceStateService();
  });

  it('inicia cerrado, sin caos y sin modo de fallo forzado', () => {
    expect(service.getChaos()).toBeNull();
    expect(service.getForcedFaultMode()).toBeNull();
    expect(service.snapshot()).toMatchObject({
      state: 'CLOSED',
      circuitBreakerScope: 'global',
    });
  });

  it('activa y limpia los escenarios de caos', () => {
    expect(
      service.setChaos({
        simulateSunatDown: true,
        simulateHighLatency: false,
      }),
    ).toMatchObject({ simulateSunatDown: true });
    expect(service.getForcedFaultMode()).toBe(
      SunatFaultMode.SERVICE_UNAVAILABLE,
    );

    service.setChaos({
      simulateSunatDown: false,
      simulateHighLatency: true,
      latencyMs: 500,
    });
    expect(service.getForcedFaultMode()).toBe(SunatFaultMode.SLOW);

    service.clearChaos();
    expect(service.getChaos()).toBeNull();
    expect(service.getForcedFaultMode()).toBeNull();
  });

  it('abre el circuito tras cinco fallos y lo cierra con un éxito', () => {
    for (let i = 0; i < 5; i += 1) {
      service.recordFailure();
    }

    expect(service.snapshot().state).toBe('OPEN');
    expect(service.puedeEnviar()).toBe(false);

    service.recordSuccess();

    expect(service.snapshot().state).toBe('CLOSED');
    expect(service.puedeEnviar()).toBe(true);
  });

  it('clasifica el resultado de un envío real', () => {
    service.registrarResultadoEnvio(true);
    expect(service.snapshot().state).toBe('CLOSED');

    for (let i = 0; i < 5; i += 1) {
      service.registrarResultadoEnvio(true);
    }
    expect(service.snapshot().state).toBe('OPEN');

    service.registrarResultadoEnvio(false);
    expect(service.snapshot().state).toBe('CLOSED');
  });

  it('permite reservar y liberar el envío de prueba', () => {
    expect(service.reservarEnvio()).toBe(true);
    service.liberarEnvio();
    expect(service.puedeEnviar()).toBe(true);
  });
});
