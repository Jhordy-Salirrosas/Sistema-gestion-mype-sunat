import {
  Controller,
  Get,
  Query,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../../../../common/decorators';
import type { TokenPayload } from '../../../auth/domain/ports/tokenServicePort';
import { AuthGuard } from '../../../auth/infrastructure/guards/authGuard';
import { SirePeriodoQueryDto } from '../../application/dto/sireMenuQueryDto';
import type { SireAccountingPreviewResponse } from '../../application/dto/sireAccountingPreviewResponseDto';
import { GetSireAccountingPreviewUseCase } from '../../application/use-cases/getSireAccountingPreviewUseCase';

@Controller('api/v1/sire')
@UseGuards(AuthGuard)
export class SireAccountingPreviewController {
  constructor(
    private readonly previewUseCase: GetSireAccountingPreviewUseCase,
  ) {}

  @Get('asientos-preview')
  async preview(
    @Query() query: SirePeriodoQueryDto,
    @CurrentUser() user?: TokenPayload,
  ): Promise<SireAccountingPreviewResponse> {
    if (!user?.companyId) {
      throw new UnauthorizedException(
        'La empresa del usuario no está definida.',
      );
    }
    return this.previewUseCase.execute(
      user.companyId,
      query.periodo,
      query.libro,
    );
  }
}
