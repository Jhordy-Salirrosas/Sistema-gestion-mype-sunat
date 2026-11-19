import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Param,
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
import { CloseFiscalPeriodUseCase } from '../../application/use-cases/closeFiscalPeriodUseCase';
import { ExportSireProposalUseCase } from '../../application/use-cases/exportSireProposalUseCase';
import { GetReconciliationHistoryUseCase } from '../../application/use-cases/getReconciliationHistoryUseCase';
import { IngestSireProposalUseCase } from '../../application/use-cases/ingestSireProposalUseCase';
import { ReconcileSireUseCase } from '../../application/use-cases/reconcileSireUseCase';
import type { ReconcileResultDto } from '../../application/dto/reconcileResultDto';
import { AuthGuard } from '../../../auth/infrastructure/guards/authGuard';
import { UploadSireReportUseCase } from '../../application/use-cases/uploadSireReportUseCase';
import { GetSireProposalUseCase } from '../../application/use-cases/getSireProposalUseCase';
import { ExcludeSireRecordUseCase } from '../../application/use-cases/excludeSireRecordUseCase';
import { ReplaceSireProposalUseCase } from '../../application/use-cases/replaceSireProposalUseCase';
import { RegisterSirePreliminaryUseCase } from '../../application/use-cases/registerSirePreliminaryUseCase';
import { DeleteSirePreliminaryUseCase } from '../../application/use-cases/deleteSirePreliminaryUseCase';
import { GenerateSireRecordUseCase } from '../../application/use-cases/generateSireRecordUseCase';
import { SireTicketManagerService } from '../../application/sireTicketManagerService';
import {
  SireProvisionalActionDto,
  AcceptSirePeriodDto,
} from '../../application/dto/sireProvisionalActionDto';
import {
  SireProvisionalQueryDto,
  toPeriodBookDto,
} from '../../application/dto/sireProvisionalQueryDto';
import { AcceptSireProposalUseCase } from '../../application/use-cases/acceptSireProposalUseCase';
import { RestoreSireRecordUseCase } from '../../application/use-cases/restoreSireRecordUseCase';

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

@Controller(['api/v1/sire', 'sire'])
@UseGuards(AuthGuard)
export class SireController {
  constructor(
    private readonly reconcileSireUseCase: ReconcileSireUseCase,
    private readonly ingestUseCase: IngestSireProposalUseCase,
    private readonly exportUseCase: ExportSireProposalUseCase,
    private readonly historyUseCase: GetReconciliationHistoryUseCase,
    private readonly closeUseCase: CloseFiscalPeriodUseCase,
    private readonly uploadReportUseCase: UploadSireReportUseCase,
    private readonly getProposalUseCase: GetSireProposalUseCase,
    private readonly excludeRecordUseCase: ExcludeSireRecordUseCase,
    private readonly replaceProposalUseCase: ReplaceSireProposalUseCase,
    private readonly registerPreliminaryUseCase: RegisterSirePreliminaryUseCase,
    private readonly deletePreliminaryUseCase: DeleteSirePreliminaryUseCase,
    private readonly generateRecordUseCase: GenerateSireRecordUseCase,
    private readonly ticketManager: SireTicketManagerService,
    private readonly acceptProposalUseCase: AcceptSireProposalUseCase,
    private readonly restoreRecordUseCase: RestoreSireRecordUseCase,
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

  @Post('proposal')
  async getProposal(
    @Body() dto: SirePeriodBookDto,
    @CurrentUser() user?: TokenPayload,
  ) {
    return this.getProposalUseCase.execute(dto, this.requireCompany(user));
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

  @Post('excluir')
  async exclude(
    @Body() dto: SireProvisionalActionDto,
    @CurrentUser() user?: TokenPayload,
  ) {
    const companyId = this.requireCompany(user);
    return this.excludeRecordUseCase.execute(companyId, dto.proposalId, user?.sub ?? '');
  }

  @Post('restaurar')
  async restore(
    @Body() dto: SireProvisionalActionDto,
    @CurrentUser() user?: TokenPayload,
  ) {
    return this.restoreRecordUseCase.execute(
      this.requireCompany(user),
      dto.proposalId,
    );
  }

  @Post('aceptar')
  async accept(
    @Body() dto: AcceptSirePeriodDto,
    @CurrentUser() user?: TokenPayload,
  ) {
    return this.acceptProposalUseCase.execute(
      dto,
      this.requireCompany(user),
      dto.confirmed,
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

  @Post('preliminar')
  async registerPreliminar(
    @Body() dto: SirePeriodBookDto,
    @CurrentUser() user?: TokenPayload,
  ) {
    return this.registerPreliminaryUseCase.execute(dto, this.requireCompany(user));
  }

  @Delete('proposal/:proposalId')
  async excludeProposal(
    @Param('proposalId') proposalId: string,
    @CurrentUser() user?: TokenPayload,
  ) {
    const currentUser = user;
    return this.excludeRecordUseCase.execute(
      this.requireCompany(currentUser),
      proposalId,
      currentUser?.sub ?? '',
    );
  }

  @Post('proposal/replace')
  @UseInterceptors(FileInterceptor('file', txtUploadOptions))
  async replaceProposal(
    @Body() dto: SirePeriodBookDto,
    @UploadedFile() file: UploadedSireFile | undefined,
    @CurrentUser() user?: TokenPayload,
  ) {
    if (!file?.buffer) throw new BadRequestException('Falta el archivo TXT.');
    return this.replaceProposalUseCase.execute(
      dto,
      this.requireCompany(user),
      file.buffer,
    );
  }

  @Post('reemplazo')
  @UseInterceptors(FileInterceptor('file', txtUploadOptions))
  async reemplazo(
    @Body() dto: SirePeriodBookDto,
    @UploadedFile() file: UploadedSireFile | undefined,
    @CurrentUser() user?: TokenPayload,
  ) {
    if (!file?.buffer) throw new BadRequestException('Falta el archivo TXT.');
    return this.replaceProposalUseCase.execute(dto, this.requireCompany(user), file.buffer);
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

  @Get('status')
  async status(
    @Query() query: SireProvisionalQueryDto,
    @CurrentUser() user?: TokenPayload,
  ) {
    const dto = toPeriodBookDto(query);
    return this.ticketManager.poll(this.requireCompany(user), dto.period, dto.bookType);
  }

  @Post('preliminary')
  async registerPreliminary(
    @Body() dto: SirePeriodBookDto,
    @CurrentUser() user?: TokenPayload,
  ) {
    return this.registerPreliminaryUseCase.execute(dto, this.requireCompany(user));
  }

  @Delete('preliminary')
  async deletePreliminary(
    @Body() dto: SirePeriodBookDto,
    @CurrentUser() user?: TokenPayload,
  ) {
    return this.deletePreliminaryUseCase.execute(dto, this.requireCompany(user));
  }

  @Post('generate')
  async generate(
    @Body() dto: SirePeriodBookDto,
    @CurrentUser() user?: TokenPayload,
  ) {
    return this.generateRecordUseCase.execute(dto, this.requireCompany(user));
  }

  @Post('tickets/:period/poll')
  async pollTicket(
    @Param('period') period: string,
    @Query('bookType') bookType: 'RVIE_VENTAS' | 'RCE_COMPRAS',
    @CurrentUser() user?: TokenPayload,
  ) {
    if (!['RVIE_VENTAS', 'RCE_COMPRAS'].includes(bookType)) {
      throw new BadRequestException('El tipo de libro no es válido.');
    }
    return this.ticketManager.poll(this.requireCompany(user), period, bookType);
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

  @Post('close')
  @HttpCode(HttpStatus.OK)
  async close(
    @Body() dto: SirePeriodBookDto,
    @CurrentUser() user?: TokenPayload,
  ) {
    return this.closeUseCase.execute(dto, this.requireCompany(user));
  }
}
