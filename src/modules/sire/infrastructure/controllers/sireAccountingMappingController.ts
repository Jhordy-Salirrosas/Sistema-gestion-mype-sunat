import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CurrentUser, Roles } from '../../../../common/decorators';
import type { TokenPayload } from '../../../auth/domain/ports/tokenServicePort';
import { AuthGuard } from '../../../auth/infrastructure/guards/authGuard';
import { RolesGuard } from '../../../auth/infrastructure/guards/rolesGuard';
import {
  SireAccountingMappingItemDto,
  type SireAccountingMappingResponse,
} from '../../application/dto/sireAccountingMappingDto';
import { GetSireAccountingMappingsUseCase } from '../../application/use-cases/getSireAccountingMappingsUseCase';
import { SaveSireAccountingMappingsUseCase } from '../../application/use-cases/saveSireAccountingMappingsUseCase';
import {
  resolveSireCompanyId,
  SIRE_CONFIG_ROLES,
} from '../../application/sireAccess';

interface MappingBody {
  companyId?: string;
  mappings?: unknown;
  items?: unknown;
}

/**
 * Mapeo contable SIRE de la empresa (Multi-RUC).
 *
 * El mapeo es EXCLUSIVO de SIRE (`sire_accounting_mappings`). Un ADMIN puede
 * indicar `companyId`; los demás roles quedan acotados a su token.
 *
 * Por compatibilidad, el POST acepta tanto el arreglo directo (contrato
 * anterior) como `{ companyId, mappings }`.
 */
@Controller('api/v1/sire')
@UseGuards(AuthGuard, RolesGuard)
@Roles(...SIRE_CONFIG_ROLES)
export class SireAccountingMappingController {
  constructor(
    private readonly getUseCase: GetSireAccountingMappingsUseCase,
    private readonly saveUseCase: SaveSireAccountingMappingsUseCase,
  ) {}

  @Get('mapeo-contable')
  async obtener(
    @Query('companyId') companyId?: string,
    @CurrentUser() user?: TokenPayload,
  ): Promise<SireAccountingMappingResponse[]> {
    return this.getUseCase.execute(resolveSireCompanyId(user, companyId));
  }

  @Post('mapeo-contable')
  @HttpCode(HttpStatus.OK)
  async guardar(
    @Body() body: unknown,
    @Query('companyId') queryCompanyId?: string,
    @CurrentUser() user?: TokenPayload,
  ): Promise<SireAccountingMappingResponse[]> {
    const { companyId, mappings } = await this.parseBody(body, queryCompanyId);
    return this.saveUseCase.execute(
      resolveSireCompanyId(user, companyId),
      mappings,
    );
  }

  private async parseBody(
    body: unknown,
    queryCompanyId?: string,
  ): Promise<{
    companyId?: string;
    mappings: SireAccountingMappingItemDto[];
  }> {
    const legacyArray = Array.isArray(body);
    const record = !legacyArray && body && typeof body === 'object'
      ? (body as MappingBody)
      : undefined;
    const rawMappings = legacyArray
      ? body
      : record?.mappings ?? record?.items;

    if (!Array.isArray(rawMappings)) {
      throw new BadRequestException(
        'Debe enviar el arreglo de mapeos contables.',
      );
    }

    const companyId = record?.companyId ?? queryCompanyId;
    if (companyId !== undefined && typeof companyId !== 'string') {
      throw new BadRequestException('El companyId no es válido.');
    }

    const mappings = await Promise.all(
      rawMappings.map(async (item) => {
        const dto = plainToInstance(SireAccountingMappingItemDto, item);
        const errors = await validate(dto);
        if (errors.length > 0) {
          throw new BadRequestException(
            'Los datos del mapeo contable no son válidos.',
          );
        }
        return {
          tipoOperacion: dto.tipoOperacion,
          cuentaContable: dto.cuentaContable,
        };
      }),
    );

    return { companyId: companyId?.trim() || undefined, mappings };
  }
}
