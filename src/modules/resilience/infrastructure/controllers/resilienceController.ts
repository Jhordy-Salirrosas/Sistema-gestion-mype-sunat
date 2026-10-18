import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../../../auth/infrastructure/guards/authGuard';
import { ChaosScenarioDto } from '../../application/dto/chaosScenarioDto';
import { ResilienceStateService } from '../../application/resilienceStateService';
import { QueueService } from '../queue/queue.service';

/**
 * Endpoints de resiliencia (M2) que consume el frontend.
 *
 * El prefijo lleva `api/v1` porque el `baseURL` de Axios en el frontend ya es
 * `/api/v1`: si aqui se omitiera, la llamada saldria duplicada y daria 404.
 *
 * Contrato (ver `resilienceApi.ts` y `resilience.types.ts` del frontend):
 *   GET  /api/v1/resilience/metrics        -> CircuitBreakerMetrics
 *   GET  /api/v1/resilience/dlq            -> DlqItem[]
 *   POST /api/v1/resilience/dlq/:id/retry  -> { success, message }
 *   POST /api/v1/resilience/chaos          -> ChaosScenario
 */
@Controller('api/v1/resilience')
@UseGuards(AuthGuard)
export class ResilienceController {
  constructor(
    private readonly state: ResilienceStateService,
    private readonly queue: QueueService,
  ) {}

  /** Estado del Circuit Breaker y contadores de llamadas a SUNAT. */
  @Get('metrics')
  async getMetrics() {
    const buffered = await this.queue.countQueued();
    return this.state.snapshot(buffered);
  }

  /** Comprobantes que agotaron los intentos y cayeron a la cola de muertos. */
  @Get('dlq')
  async getDlq() {
    return this.queue.listDlq();
  }

  /** Devuelve un comprobante de la DLQ a la cola principal. */
  @Post('dlq/:id/retry')
  @HttpCode(HttpStatus.OK)
  async retryDlq(@Param('id') id: string) {
    await this.queue.retryDlq(id);
    return {
      success: true,
      message: `El comprobante ${id} volvio a la cola de envio`,
    };
  }

  /** Activa o desactiva el escenario de caos del Inyector de Fallos. */
  @Post('chaos')
  @HttpCode(HttpStatus.OK)
  async toggleChaos(@Body() dto: ChaosScenarioDto) {
    const activo = dto.simulateSunatDown || dto.simulateHighLatency;

    if (!activo) {
      this.state.clearChaos();
      return { ...dto, active: false };
    }

    this.state.setChaos(dto);
    return { ...this.state.getChaos(), active: true };
  }
}
