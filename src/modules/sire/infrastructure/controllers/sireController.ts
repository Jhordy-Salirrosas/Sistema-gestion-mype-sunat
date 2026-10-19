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

@Controller('api/v1/sire')
@UseGuards(AuthGuard)
export class SireController {
  constructor(
    private readonly reconcileSireUseCase: ReconcileSireUseCase,
    private readonly ingestUseCase: IngestSireProposalUseCase,
    private readonly exportUseCase: ExportSireProposalUseCase,
    private readonly historyUseCase: GetReconciliationHistoryUseCase,
    private readonly closeUseCase: CloseFiscalPeriodUseCase,
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
