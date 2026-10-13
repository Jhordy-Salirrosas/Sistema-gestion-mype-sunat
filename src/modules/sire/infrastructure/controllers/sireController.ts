import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ReconcilePeriodDto } from '../../application/dto/reconcilePeriodDto';
import type { ReconcileResultDto } from '../../application/dto/reconcileResultDto';
import { ReconcileSireUseCase } from '../../application/use-cases/reconcileSireUseCase';

@Controller('api/v1/sire')
export class SireController {
  constructor(private readonly reconcileSireUseCase: ReconcileSireUseCase) {}

  @Post('reconcile')
  @HttpCode(HttpStatus.OK)
  async reconcile(
    @Body() dto: ReconcilePeriodDto,
  ): Promise<ReconcileResultDto> {
    return this.reconcileSireUseCase.execute(dto);
  }
}
