import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  ParseIntPipe,
  Post,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { CurrentCompany } from '../../../../common/decorators';
import { AuthGuard } from '../../../auth/infrastructure/guards/authGuard';
import { PrismaService } from '../../../../database/prismaService';
import { EvaluateBookObligationUseCase } from '../../application/use-cases/evaluateBookObligationUseCase';
import { GeneratePleBookUseCase } from '../../application/use-cases/generatePleBookUseCase';
import { EvaluateBookObligationDto } from '../../application/dto/evaluateBookObligationDto';
import { ExportPleBookDto } from '../../application/dto/exportPleBookDto';
import {
  INVENTORY_OBLIGATION_REPOSITORY_PORT,
  type IInventoryObligationRepositoryPort,
} from '../../domain/ports/IInventoryObligationRepositoryPort';

@Controller('api/v1/inventory/ple')
@UseGuards(AuthGuard)
export class InventoryPleController {
  constructor(
    private readonly evaluateUseCase: EvaluateBookObligationUseCase,
    private readonly generatePleUseCase: GeneratePleBookUseCase,
    @Inject(INVENTORY_OBLIGATION_REPOSITORY_PORT)
    private readonly obligationRepository: IInventoryObligationRepositoryPort,
    private readonly prisma: PrismaService,
  ) {}

  @Post('evaluate')
  @HttpCode(HttpStatus.OK)
  async evaluateObligation(
    @Body() dto: EvaluateBookObligationDto,
    @CurrentCompany() companyId?: string,
  ) {
    if (!companyId) throw new UnauthorizedException('Identificador de empresa requerido.');
    return this.evaluateUseCase.execute(dto, companyId);
  }

  @Get('obligation/:year')
  async getObligation(
    @Param('year', ParseIntPipe) year: number,
    @CurrentCompany() companyId?: string,
  ) {
    if (!companyId) throw new UnauthorizedException('Identificador de empresa requerido.');
    return this.obligationRepository.findByFiscalYear(companyId, year);
  }

  @Post('export')
  async exportPleBook(
    @Body() dto: ExportPleBookDto,
    @CurrentCompany() companyId: string | undefined,
    @Res() res: Response,
  ) {
    if (!companyId) throw new UnauthorizedException('Identificador de empresa requerido.');

    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: { ruc: true },
    });

    if (!company?.ruc) {
      throw new UnauthorizedException('Empresa no encontrada o RUC ausente.');
    }

    const { fileName, content, recordsCount } = await this.generatePleUseCase.execute(
      dto,
      companyId,
      company.ruc,
    );

    res.setHeader('Content-Type', 'text/plain; charset=ISO-8859-1');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.setHeader('X-Records-Count', String(recordsCount));
    return res.status(HttpStatus.OK).send(content);
  }
}

