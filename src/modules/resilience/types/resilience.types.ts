import { type CircuitBreakerStatus } from '@/stores/uiStore';

export interface CircuitBreakerMetrics {
  state: CircuitBreakerStatus;
  failureRate: number; // Porcentaje de 0 a 100
  slowCallRate: number;
  bufferedInvoicesCount: number;
  totalCalls: number;
  successfulCalls: number;
  failedCalls: number;
  lastStateChange: string;
}

export interface DlqItem {
  id: string;
  comprobanteSerieNumero: string;
  clienteRuc: string;
  monto: number;
  codigoErrorSunat: string;
  mensajeError: string;
  intentosFallidos: number;
  fechaUltimoIntento: string;
}

export interface ChaosScenario {
  simulateSunatDown: boolean;
  simulateHighLatency: boolean;
  latencyMs: number;
}
