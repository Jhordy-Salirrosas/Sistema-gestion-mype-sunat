import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { CurrentCompany } from '../../../../common/decorators';
import { ReconcilePeriodDto } from '../../application/dto/reconcilePeriodDto';
import type { ReconcileResultDto } from '../../application/dto/reconcileResultDto';
import { ReconcileSireUseCase } from '../../application/use-cases/reconcileSireUseCase';
import { AuthGuard } from '../../../auth/infrastructure/guards/authGuard';

@Controller('api/v1/sire')
@UseGuards(AuthGuard)
export class SireController {
  constructor(private readonly reconcileSireUseCase: ReconcileSireUseCase) { }

  @Post('reconcile')
  @HttpCode(HttpStatus.OK)
  async reconcile(
    @Body() dto: ReconcilePeriodDto,
    @CurrentCompany() companyId?: string,
  ): Promise<ReconcileResultDto> {
    if (!companyId) {
      throw new UnauthorizedException(
        'La empresa del usuario no está definida.',
      );
    }
    return this.reconcileSireUseCase.execute(dto, companyId);
  }
}
