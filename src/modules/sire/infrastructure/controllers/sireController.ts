import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CurrentCompany } from '../../../../common/decorators';
import { AuthGuard } from '../../../auth/infrastructure/guards/authGuard';
import { ReconcilePeriodDto } from '../../application/dto/reconcilePeriodDto';
import type { ReconcileResultDto } from '../../application/dto/reconcileResultDto';
import { ReconcileSireUseCase } from '../../application/use-cases/reconcileSireUseCase';

@Controller('api/v1/sire')
@UseGuards(AuthGuard)
export class SireController {
  constructor(private readonly reconcileSireUseCase: ReconcileSireUseCase) {}

  @Post('reconcile')
  @HttpCode(HttpStatus.OK)
  async reconcile(
    @Body() dto: ReconcilePeriodDto,
    @CurrentCompany() _companyId?: string,
  ): Promise<ReconcileResultDto> {
    return this.reconcileSireUseCase.execute(dto);
  }
}
