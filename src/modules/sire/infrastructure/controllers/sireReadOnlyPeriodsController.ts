import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { CurrentUser } from '../../../../common/decorators';
import { PrismaService } from '../../../../database/prismaService';
import {
  USER_REPOSITORY_PORT,
  type IUserRepositoryPort,
} from '../../../auth/domain/ports/userRepositoryPort';
import {
  SOL_CREDENTIAL_CIPHER,
  type SolCredentialCipherPort,
} from '../../../auth/domain/ports/solCredentialCipherPort';
import type { TokenPayload } from '../../../auth/domain/ports/tokenServicePort';
import { AuthGuard } from '../../../auth/infrastructure/guards/authGuard';
import { QueueService } from '../../../resilience/infrastructure/queue/queue.service';
import { SirePeriodsRequestDto } from '../../application/dto/sirePeriodsRequestDto';
import { SireReadOnlyPeriodsClient } from '../sunat/sireReadOnlyPeriodsClient';

@Controller('api/v1/sire')
@UseGuards(AuthGuard)
export class SireReadOnlyPeriodsController {
  constructor(
    @Inject(USER_REPOSITORY_PORT)
    private readonly users: IUserRepositoryPort,
    private readonly sireClient: SireReadOnlyPeriodsClient,
    private readonly prisma: PrismaService,
    private readonly queue: QueueService,
    @Inject(SOL_CREDENTIAL_CIPHER)
    private readonly credentialCipher: SolCredentialCipherPort,
  ) {}

  @Post('periodos')
  @HttpCode(HttpStatus.ACCEPTED)
  async getPeriods(
    @Body() dto: SirePeriodsRequestDto,
    @CurrentUser() user?: TokenPayload,
  ): Promise<{ messageId: string; status: 'PENDING' }> {
    if (!user?.companyId) {
      throw new UnauthorizedException(
        'La empresa del usuario no está definida.',
      );
    }

    const company = await this.users.findCompanyById(user.companyId);
    if (!company || !company.isActive) {
      throw new NotFoundException(
        'No se encontró una empresa activa para la sesión.',
      );
    }

    this.sireClient.assertConfigured();

    const messageId = randomUUID();
    const encryptedSolCredentials = this.credentialCipher.encrypt(
      JSON.stringify({
        solUser: dto.solUser,
        solPassword: dto.solPassword,
      }),
    );
    await this.prisma.sirePeriodQuery.create({
      data: {
        id: messageId,
        company_id: company.id,
        job_id: messageId,
        book_code: dto.bookCode,
      },
    });

    try {
      await this.queue.enqueueSirePeriods({
        messageId,
        companyId: company.id,
        ruc: company.ruc,
        bookCode: dto.bookCode,
        encryptedSolCredentials,
      });
    } catch (error) {
      await this.prisma.sirePeriodQuery.update({
        where: { id: messageId },
        data: {
          status: 'FAILED',
          error_code: 'QUEUE_ENQUEUE_FAILED',
          completed_at: new Date(),
        },
      });
      throw error;
    }

    return { messageId, status: 'PENDING' };
  }

  @Get('periodos/status/:messageId')
  async getStatus(
    @Param('messageId', new ParseUUIDPipe()) messageId: string,
    @CurrentUser() user?: TokenPayload,
  ): Promise<Record<string, unknown>> {
    if (!user?.companyId) {
      throw new UnauthorizedException(
        'La empresa del usuario no está definida.',
      );
    }

    const query = await this.prisma.sirePeriodQuery.findFirst({
      where: { id: messageId, company_id: user.companyId },
    });
    if (!query) {
      throw new NotFoundException('No se encontró la solicitud SIRE.');
    }

    return {
      messageId: query.id,
      status: query.status,
      bookCode: query.book_code,
      ...(query.status === 'COMPLETED' && query.result
        ? { periods: JSON.parse(query.result) as unknown }
        : {}),
      ...(query.status === 'FAILED'
        ? { error: 'No se pudo completar la consulta de períodos SIRE.' }
        : {}),
      createdAt: query.created_at,
      completedAt: query.completed_at,
    };
  }
}
