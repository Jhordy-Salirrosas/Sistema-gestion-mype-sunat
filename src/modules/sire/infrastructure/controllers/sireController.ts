import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  Res,
  UnauthorizedException,
  UnsupportedMediaTypeException,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { CurrentUser } from '../../../../common/decorators';
import type { TokenPayload } from '../../../auth/domain/ports/tokenServicePort';
import { ReconcilePeriodDto } from '../../application/dto/reconcilePeriodDto';
import { SireHistoryQueryDto } from '../../application/dto/sireHistoryQueryDto';
import { SirePeriodBookDto } from '../../application/dto/sirePeriodBookDto';
import { ExportSireProposalUseCase } from '../../application/use-cases/exportSireProposalUseCase';
import { GetReconciliationHistoryUseCase } from '../../application/use-cases/getReconciliationHistoryUseCase';
import { IngestSireProposalUseCase } from '../../application/use-cases/ingestSireProposalUseCase';
import { ReconcileSireUseCase } from '../../application/use-cases/reconcileSireUseCase';
import type { ReconcileResultDto } from '../../application/dto/reconcileResultDto';
import { AuthGuard } from '../../../auth/infrastructure/guards/authGuard';
import { UploadSireReportUseCase } from '../../application/use-cases/uploadSireReportUseCase';
import { GetSireProposalUseCase } from '../../application/use-cases/getSireProposalUseCase';
import { SireTicketManagerService } from '../../application/sireTicketManagerService';
import {
  SireProvisionalQueryDto,
  toPeriodBookDto,
} from '../../application/dto/sireProvisionalQueryDto';

interface UploadedSireFile {
  originalname: string;
  mimetype: string;
  buffer: Buffer;
}

const txtUploadOptions = {
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (
    _request: unknown,
    file: UploadedSireFile,
    callback: (error: Error | null, acceptFile: boolean) => void,
  ) => {
    const isTxt = /\.txt$/i.test(file.originalname);
    const isText = ['text/plain', 'application/octet-stream'].includes(
      file.mimetype,
    );
    callback(
      isTxt && isText
        ? null
        : new BadRequestException('Solo se permiten archivos .txt.'),
      isTxt && isText,
    );
  },
};

const reportUploadOptions = {
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (
    _request: unknown,
    file: UploadedSireFile,
    callback: (error: Error | null, acceptFile: boolean) => void,
  ) => {
    const accepted = /\.(csv|xlsx)$/i.test(file.originalname);
    callback(
      accepted
        ? null
        : new UnsupportedMediaTypeException('Solo se permiten archivos .csv o .xlsx.'),
      accepted,
    );
  },
};

/**
 * Operaciones LOCALES del módulo SIRE.
 *
 * Este controlador no emite nada a SUNAT: solo importa archivos, reconcilia
 * datos locales, exporta la propuesta y consulta el estado guardado. Las
 * acciones de aceptar, reemplazar, registrar preliminares, generar registros,
 * cerrar períodos y reportar se eliminaron porque la integración SIRE es
 * estrictamente de solo lectura.
 */
@Controller(['api/v1/sire', 'sire'])
@UseGuards(AuthGuard)
export class SireController {
  constructor(
    private readonly reconcileSireUseCase: ReconcileSireUseCase,
    private readonly ingestUseCase: IngestSireProposalUseCase,
    private readonly exportUseCase: ExportSireProposalUseCase,
    private readonly historyUseCase: GetReconciliationHistoryUseCase,
    private readonly uploadReportUseCase: UploadSireReportUseCase,
    private readonly getProposalUseCase: GetSireProposalUseCase,
    private readonly ticketManager: SireTicketManagerService,
  ) {}

  private requireCompany(user?: TokenPayload): string {
    if (!user?.companyId) {
      throw new UnauthorizedException(
        'La empresa del usuario no está definida.',
      );
    }
    return user.companyId;
  }

  @Post('reconcile')
  @HttpCode(HttpStatus.OK)
  async reconcile(
    @Body() dto: ReconcilePeriodDto,
    @CurrentUser() user?: TokenPayload,
  ): Promise<ReconcileResultDto> {
    return this.reconcileSireUseCase.execute(dto, this.requireCompany(user));
  }

  @Post('import')
  @UseInterceptors(FileInterceptor('file', txtUploadOptions))
  async importProposal(
    @Body() dto: SirePeriodBookDto,
    @UploadedFile() file: UploadedSireFile | undefined,
    @CurrentUser() user?: TokenPayload,
  ) {
    if (!file?.buffer) throw new BadRequestException('Falta el archivo TXT.');
    return this.ingestUseCase.execute(
      dto,
      this.requireCompany(user),
      file.buffer,
    );
  }

  @Post('upload')
  @UseInterceptors(FileInterceptor('file', reportUploadOptions))
  async uploadReport(
    @Body() dto: SirePeriodBookDto,
    @UploadedFile() file: UploadedSireFile | undefined,
    @CurrentUser() user?: TokenPayload,
  ) {
    if (!file?.buffer) throw new BadRequestException('Falta el archivo CSV/XLSX.');
    return this.uploadReportUseCase.execute(
      dto,
      this.requireCompany(user),
      file,
    );
  }

  @Get('propuesta')
  async getPropuesta(
    @Query() query: SireProvisionalQueryDto,
    @CurrentUser() user?: TokenPayload,
  ) {
    return this.getProposalUseCase.execute(
      toPeriodBookDto(query),
      this.requireCompany(user),
    );
  }

  @Get('preliminar')
  async getPreliminar(
    @Query() query: SireProvisionalQueryDto,
    @CurrentUser() user?: TokenPayload,
  ) {
    const companyId = this.requireCompany(user);
    const dto = toPeriodBookDto(query);
    const period = await this.ticketManager.getPeriod(companyId, dto.period, dto.bookType);
    const records = await this.ticketManager.getRecords(companyId, dto.period, dto.bookType);
    return { period: dto.period, bookType: dto.bookType, state: period?.state ?? 'SIN_PROPUESTA', records };
  }

  @Get('generado')
  async getGenerado(
    @Query() query: SireProvisionalQueryDto,
    @CurrentUser() user?: TokenPayload,
  ) {
    const companyId = this.requireCompany(user);
    const dto = toPeriodBookDto(query);
    const period = await this.ticketManager.getPeriod(companyId, dto.period, dto.bookType);
    const records = await this.ticketManager.getRecords(companyId, dto.period, dto.bookType);
    return { period: dto.period, bookType: dto.bookType, state: period?.state ?? 'SIN_REGISTRO', records };
  }

  @Post('export')
  @HttpCode(HttpStatus.OK)
  async exportProposal(
    @Body() dto: SirePeriodBookDto,
    @CurrentUser() user: TokenPayload | undefined,
    @Res() response: Response,
  ): Promise<void> {
    const file = await this.exportUseCase.execute(
      dto,
      this.requireCompany(user),
    );
    response
      .status(HttpStatus.OK)
      .type('text/plain; charset=utf-8')
      .attachment(file.fileName)
      .send(Buffer.from(file.content));
  }

  @Get('history')
  async history(
    @Query() query: SireHistoryQueryDto,
    @CurrentUser() user?: TokenPayload,
  ) {
    return this.historyUseCase.execute(query, this.requireCompany(user));
  }
}
