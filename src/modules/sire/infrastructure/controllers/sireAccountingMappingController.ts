import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  ParseArrayPipe,
  Post,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../../../../common/decorators';
import type { TokenPayload } from '../../../auth/domain/ports/tokenServicePort';
import { AuthGuard } from '../../../auth/infrastructure/guards/authGuard';
import {
  SireAccountingMappingItemDto,
  type SireAccountingMappingResponse,
} from '../../application/dto/sireAccountingMappingDto';
import { GetSireAccountingMappingsUseCase } from '../../application/use-cases/getSireAccountingMappingsUseCase';
import { SaveSireAccountingMappingsUseCase } from '../../application/use-cases/saveSireAccountingMappingsUseCase';

/**
 * Mapeo contable SIRE de la empresa autenticada.
 *
 * El POST recibe el conjunto completo de mapeos: cada concepto se crea o se
 * actualiza según el par `(empresa, tipo de operación)`.
 */
@Controller('api/v1/sire')
@UseGuards(AuthGuard)
export class SireAccountingMappingController {
  constructor(
    private readonly getUseCase: GetSireAccountingMappingsUseCase,
    private readonly saveUseCase: SaveSireAccountingMappingsUseCase,
  ) {}

  @Get('mapeo-contable')
  async obtener(
    @CurrentUser() user?: TokenPayload,
  ): Promise<SireAccountingMappingResponse[]> {
    return this.getUseCase.execute(this.requireCompany(user));
  }

  @Post('mapeo-contable')
  @HttpCode(HttpStatus.OK)
  async guardar(
    @Body(
      new ParseArrayPipe({
        items: SireAccountingMappingItemDto,
        whitelist: true,
        forbidNonWhitelisted: true,
      }),
    )
    mappings: SireAccountingMappingItemDto[],
    @CurrentUser() user?: TokenPayload,
  ): Promise<SireAccountingMappingResponse[]> {
    return this.saveUseCase.execute(this.requireCompany(user), mappings);
  }

  private requireCompany(user?: TokenPayload): string {
    if (!user?.companyId) {
      throw new UnauthorizedException(
        'La empresa del usuario no está definida.',
      );
    }
    return user.companyId;
  }
}
