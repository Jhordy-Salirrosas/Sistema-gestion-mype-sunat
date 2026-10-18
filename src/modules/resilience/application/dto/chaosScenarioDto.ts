import { IsBoolean, IsInt, IsOptional, Max, Min } from 'class-validator';

/**
 * Escenario de caos que el frontend puede activar (M2).
 *
 * Es el DTO de `POST /api/v1/resilience/chaos`. El frontend lo envia desde
 * `ResilienceDashboardPage` con la forma `ChaosScenario`:
 * `{ simulateSunatDown, simulateHighLatency, latencyMs }`.
 *
 * El escenario se traduce al modo del Inyector de Fallos (TA-12):
 *   simulateSunatDown   -> SERVICE_UNAVAILABLE (HTTP 503)
 *   simulateHighLatency -> SLOW (latencia configurable)
 * Enviar los dos en false desactiva el caos.
 */
export class ChaosScenarioDto {
  /** Fuerza HTTP 503 en el Mock: el Circuit Breaker debe abrirse. */
  @IsBoolean()
  simulateSunatDown!: boolean;

  /** Fuerza latencia alta (modo SLOW del Inyector de Fallos). */
  @IsBoolean()
  simulateHighLatency!: boolean;

  /** Latencia en milisegundos cuando `simulateHighLatency` esta activo. */
  @IsInt()
  @Min(0)
  @Max(60_000)
  @IsOptional()
  latencyMs?: number;
}
