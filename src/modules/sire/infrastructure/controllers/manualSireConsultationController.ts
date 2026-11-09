import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../../../../common/decorators';
import type { TokenPayload } from '../../../auth/domain/ports/tokenServicePort';
import { AuthGuard } from '../../../auth/infrastructure/guards/authGuard';
import { ManualSireConsultationDto } from '../../application/dto/manualSireConsultationDto';
import { SimulateManualSireConsultationUseCase } from '../../application/use-cases/simulateManualSireConsultationUseCase';

@Controller('api/v1/sire')
@UseGuards(AuthGuard)
export class ManualSireConsultationController {
  constructor(
    private readonly simulateConsultation: SimulateManualSireConsultationUseCase,
  ) {}

  @Post('consulta-manual')
  @HttpCode(HttpStatus.OK)
  consult(
    @Body() dto: ManualSireConsultationDto,
    @CurrentUser() user?: TokenPayload,
  ) {
    if (!user?.companyId) {
      throw new UnauthorizedException(
        'La empresa del usuario no está definida.',
      );
    }

    return this.simulateConsultation.execute({
      ruc: dto.ruc,
      period: dto.period,
    });
  }
}
