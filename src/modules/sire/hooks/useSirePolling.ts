import { useEffect, useState } from 'react';
import { sireApi } from '../services/sireApi';
import type { SireWorkflowRequest, SireWorkflowResponse } from '../types/sire.types';

const terminalStatuses = new Set(['TERMINADO', 'ERROR']);
const activeStates = new Set(['PROCESANDO_PRELIMINAR', 'PROCESANDO_REEMPLAZO', 'PROCESANDO_GENERACION']);

export const useSirePolling = (
  request: (SireWorkflowRequest & { ticket?: string }) | null,
  initial: SireWorkflowResponse | null,
  onComplete: (response: SireWorkflowResponse) => void,
) => {
  const [polled, setPolled] = useState<SireWorkflowResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (
      !request ||
      !initial?.ticket ||
      initial.status !== 'PENDIENTE' && !activeStates.has(initial.state)
    ) return;

    let active = true;
    let timeout: number | undefined;
    const poll = async () => {
      try {
        const response = await sireApi.pollTicket(request);
        if (!active) return;
        setError(null);
        setPolled(response);
        if (terminalStatuses.has(response.status ?? '')) {
          active = false;
          onComplete(response);
          return;
        }
        timeout = window.setTimeout(() => void poll(), 3000);
      } catch (cause) {
        if (active) {
          setError(cause instanceof Error ? cause.message : 'No se pudo consultar el estado del ticket.');
          timeout = window.setTimeout(() => void poll(), 3000);
        }
      }
    };

    timeout = window.setTimeout(() => void poll(), 3000);

    return () => {
      active = false;
      if (timeout !== undefined) window.clearTimeout(timeout);
    };
  }, [initial, onComplete, request]);

  return { current: polled ?? initial, error };
};
