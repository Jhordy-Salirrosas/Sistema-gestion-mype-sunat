import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../../../auth/infrastructure/guards/authGuard';
import { CurrentCompany } from '../../../auth/infrastructure/decorators/currentCompanyDecorator';
import { ChaosScenarioDto } from '../../application/dto/chaosScenarioDto';
import { ResilienceStateService } from '../../application/resilienceStateService';
import { QueueService } from '../queue/queue.service';

/**
 * Endpoints de resiliencia (M2) que consume el frontend.
 *
 * El prefijo lleva `api/v1` porque el `baseURL` de Axios en el frontend ya es
 * `/api/v1`: si aqui se omitiera, la llamada saldria duplicada y daria 404.
 *
 * Contrato:
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

  /** Comprobantes que agotaron los intentos y cayeron a la cola de muertos. */
  @Get('dlq')
  async getDlq(@CurrentCompany() companyId?: string) {
    return this.queue.listDlq(this.requireCompany(companyId));
  }

  /** Devuelve un comprobante de la DLQ a la cola principal. */
  @Post('dlq/:id/retry')
  @HttpCode(HttpStatus.OK)
  async retryDlq(
    @Param('id') id: string,
    @CurrentCompany() companyId?: string,
  ) {
    await this.queue.retryDlq(id, this.requireCompany(companyId));
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

  private requireCompany(companyId?: string): string {
    if (!companyId) {
      throw new UnauthorizedException(
        'La empresa del usuario no está definida.',
      );
    }

    return companyId;
  }
}
