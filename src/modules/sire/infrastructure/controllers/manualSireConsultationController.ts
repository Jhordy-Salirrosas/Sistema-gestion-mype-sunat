import {
  Body,
  Controller,
  ForbiddenException,
  HttpCode,
  HttpStatus,
  Inject,
  NotFoundException,
  Post,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../../../../common/decorators';
import {
  USER_REPOSITORY_PORT,
  type IUserRepositoryPort,
} from '../../../auth/domain/ports/userRepositoryPort';
import type { TokenPayload } from '../../../auth/domain/ports/tokenServicePort';
import { AuthGuard } from '../../../auth/infrastructure/guards/authGuard';
import { ManualSireConsultationDto } from '../../application/dto/manualSireConsultationDto';
import { SimulateManualSireConsultationUseCase } from '../../application/use-cases/simulateManualSireConsultationUseCase';
import { normalizarRuc } from '../../domain/rules/sireFileNameRule';

/**
 * Consulta manual de libros SIRE.
 *
 * Es una SIMULACIÓN: no contacta con SUNAT, no valida la clave SOL y no
 * persiste nada. Sirve para probar el flujo del backend sin tocar SUNAT.
 */
@Controller('api/v1/sire')
@UseGuards(AuthGuard)
export class ManualSireConsultationController {
  constructor(
    private readonly simulateConsultation: SimulateManualSireConsultationUseCase,
    @Inject(USER_REPOSITORY_PORT)
    private readonly users: IUserRepositoryPort,
  ) {}

  @Post('consulta-manual')
  @HttpCode(HttpStatus.OK)
  async consult(
    @Body() dto: ManualSireConsultationDto,
    @CurrentUser() user?: TokenPayload,
  ) {
    const companyId = this.requireCompany(user);
    const ruc = await this.requireRuc(companyId);

    /**
     * EL RUC NUNCA SE TOMA DEL CUERPO
     *
     * El cuerpo dice QUÉ RUC se quiere consultar, pero la empresa que se
     * consulta es la de la SESIÓN. Si no coinciden, la petición se rechaza:
     * de lo contrario, una empresa autenticada podría consultar libros de
     * otra.
     */
    if (normalizarRuc(dto.ruc) !== normalizarRuc(ruc)) {
      throw new ForbiddenException(
        'El RUC de la consulta debe corresponder a la empresa de la sesión.',
      );
    }

    return this.simulateConsultation.execute({
      ruc,
      period: dto.period,
    });
  }

  /**
   * Empresa de la sesión.
   */
  private requireCompany(user?: TokenPayload): string {
    if (!user?.companyId) {
      throw new UnauthorizedException(
        'La empresa del usuario no está definida.',
      );
    }
    return user.companyId;
  }

  /**
   * RUC de la empresa de la sesión.
   */
  private async requireRuc(companyId: string): Promise<string> {
    const empresa = await this.users.findCompanyById(companyId);
    if (!empresa) {
      throw new NotFoundException('No se encontró la empresa del usuario.');
    }
    return empresa.ruc;
  }
}
