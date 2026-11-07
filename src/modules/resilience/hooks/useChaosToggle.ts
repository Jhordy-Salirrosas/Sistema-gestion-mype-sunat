import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { resilienceApi } from '../services/resilienceApi';
import type { ChaosScenario } from '../types/resilience.types';

/** Escenario que no hace nada: desactiva el caos en el backend. */
const SIN_CAOS: ChaosScenario = {
  simulateSunatDown: false,
  simulateHighLatency: false,
  latencyMs: 0,
};

/**
 * Activa y desactiva el escenario de caos del Inyector de Fallos (M2).
 *
 * Llama a `POST /api/v1/resilience/chaos`, que traduce el escenario al modo del
 * Inyector: `simulateSunatDown` fuerza HTTP 503 y `simulateHighLatency` fuerza
 * el modo SLOW. Al terminar invalida la query de metricas para que el dashboard
 * refresque el estado del Circuit Breaker.
 *
 * El estado `isChaosActive` vive aqui y no en el backend porque el escenario es
 * una sesion de pruebas: se apaga solo al recargar la pagina.
 */
export const useChaosToggle = () => {
  const queryClient = useQueryClient();
  const [isChaosActive, setIsChaosActive] = useState(false);

  const mutation = useMutation({
    mutationFn: (scenario: ChaosScenario) => resilienceApi.toggleChaos(scenario),
    // El estado se marca solo cuando el backend confirma: si el endpoint no
    // existe o falla, el boton no debe mentir diciendo que el caos esta activo.
    onSuccess: (_data, scenario) => {
      setIsChaosActive(
        scenario.simulateSunatDown || scenario.simulateHighLatency,
      );
      void queryClient.invalidateQueries({ queryKey: ['resilience-metrics'] });
    },
  });

  /** Fuerza HTTP 503 en el Mock: el Circuit Breaker debe abrirse. */
  const activateSunatDown = (): void => {
    mutation.mutate({
      simulateSunatDown: true,
      simulateHighLatency: false,
      latencyMs: 0,
    });
  };

  /** Vuelve al comportamiento normal del Mock. */
  const deactivate = (): void => {
    mutation.mutate(SIN_CAOS);
  };

  /** Activa o desactiva segun el estado actual. */
  const toggle = (): void => {
    if (isChaosActive) deactivate();
    else activateSunatDown();
  };

  return {
    isChaosActive,
    isPending: mutation.isPending,
    isError: mutation.isError,
    activateSunatDown,
    deactivate,
    toggle,
  };
};
