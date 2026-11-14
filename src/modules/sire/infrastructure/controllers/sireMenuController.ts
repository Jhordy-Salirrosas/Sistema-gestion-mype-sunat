import {
  BadRequestException,
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
  Query,
  UnauthorizedException,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { CurrentUser } from '../../../../common/decorators';
import {
  USER_REPOSITORY_PORT,
  type IUserRepositoryPort,
} from '../../../auth/domain/ports/userRepositoryPort';
import type { TokenPayload } from '../../../auth/domain/ports/tokenServicePort';
import { AuthGuard } from '../../../auth/infrastructure/guards/authGuard';
import type {
  SireHistorialRespuesta,
  SireImportacionRespuesta,
  SireTrabajoEstadoRespuesta,
} from '../../application/dto/sireMenuResponseDto';
import {
  SireHistorialQueryDto,
  SireImportacionRequestDto,
  SirePeriodoQueryDto,
  SireReporteRequestDto,
} from '../../application/dto/sireMenuQueryDto';
import {
  ConciliarPeriodoSireUseCase,
  ConsultarImportacionSireUseCase,
} from '../../application/use-cases/conciliarPeriodoSireUseCase';
import { ImportarPropuestaSireUseCase } from '../../application/use-cases/importarPropuestaSireUseCase';
import { ObtenerHistorialSireUseCase } from '../../application/use-cases/obtenerHistorialSireUseCase';
import { ObtenerResumenSireUseCase } from '../../application/use-cases/obtenerResumenSireUseCase';
import {
  ConsultarReporteSireUseCase,
  ReportarSireUseCase,
} from '../../application/use-cases/reportarSireUseCase';
import { SIRE_EXTENSIONES_PERMITIDAS } from '../../domain/rules/sireFileNameRule';

/** Archivo recibido por `multipart/form-data`. */
interface ArchivoSireSubido {
  originalname: string;
  mimetype: string;
  buffer: Buffer;
}

/**
 * Tope de tamaño del archivo de propuesta.
 *
 * El archivo es un texto plano (o un ZIP con el mismo contenido) con las
 * líneas del libro: 5 MB cubren de sobra un libro mensual y evitan que una
 * petición malintencionada consuma la memoria del proceso.
 */
const MAX_BYTES_ARCHIVO_SIRE = 5 * 1024 * 1024;

const opcionesSubidaSire = {
  limits: { fileSize: MAX_BYTES_ARCHIVO_SIRE },
  fileFilter: (
    _request: unknown,
    file: ArchivoSireSubido,
    callback: (error: Error | null, acceptFile: boolean) => void,
  ) => {
    const aceptada = SIRE_EXTENSIONES_PERMITIDAS.some((extension) =>
      file.originalname.toLowerCase().endsWith(extension),
    );
    callback(
      aceptada
        ? null
        : new BadRequestException(
            `Solo se permiten archivos ${SIRE_EXTENSIONES_PERMITIDAS.join(' o ')}.`,
          ),
      aceptada,
    );
  },
};

/**
 * Menú SIRE: importación, conciliación, resumen, reporte e historial.
 *
 * Es un controlador aparte del de SIRE "clásico" y del de consulta de
 * períodos para que los flujos del menú no se mezclen con los existentes: este
 * solo expone los cinco endpoints que la pantalla necesita.
 */
@Controller('api/v1/sire')
@UseGuards(AuthGuard)
export class SireMenuController {
  constructor(
    private readonly importarUseCase: ImportarPropuestaSireUseCase,
    private readonly conciliarUseCase: ConciliarPeriodoSireUseCase,
    private readonly consultarImportacionUseCase: ConsultarImportacionSireUseCase,
    private readonly resumenUseCase: ObtenerResumenSireUseCase,
    private readonly reportarUseCase: ReportarSireUseCase,
    private readonly consultarReporteUseCase: ConsultarReporteSireUseCase,
    private readonly historialUseCase: ObtenerHistorialSireUseCase,
    @Inject(USER_REPOSITORY_PORT)
    private readonly users: IUserRepositoryPort,
  ) {}

  /**
   * Importa una propuesta SIRE.
   *
   * Devuelve 202 con el `messageId`: el archivo se procesa en segundo plano y
   * el frontend sondea `GET /api/v1/sire/importar/estado/:messageId`.
   */
  @Post('importar')
  @HttpCode(HttpStatus.ACCEPTED)
  @UseInterceptors(FileInterceptor('file', opcionesSubidaSire))
  async importar(
    @Body() dto: SireImportacionRequestDto,
    @UploadedFile() file: ArchivoSireSubido | undefined,
    @CurrentUser() user?: TokenPayload,
  ): Promise<SireImportacionRespuesta> {
    const companyId = this.requireCompany(user);
    const ruc = await this.requireRuc(companyId);

    if (!file?.buffer) {
      throw new BadRequestException('Falta el archivo de la propuesta SIRE.');
    }

    return this.importarUseCase.execute(companyId, ruc, dto, file);
  }

  /**
   * Estado de una importación en curso.
   */
  @Get('importar/estado/:messageId')
  async estadoImportacion(
    @Param('messageId', new ParseUUIDPipe()) messageId: string,
    @CurrentUser() user?: TokenPayload,
  ): Promise<SireTrabajoEstadoRespuesta> {
    return this.consultarImportacionUseCase.execute(
      this.requireCompany(user),
      messageId,
    );
  }

  /**
   * Conciliación de un periodo.
   */
  @Get('conciliacion')
  async conciliacion(
    @Query() query: SirePeriodoQueryDto,
    @CurrentUser() user?: TokenPayload,
  ) {
    return this.conciliarUseCase.execute(
      this.requireCompany(user),
      query.periodo,
      query.libro ?? null,
    );
  }

  /**
   * Resumen de un periodo.
   */
  @Get('resumen')
  async resumen(
    @Query() query: SirePeriodoQueryDto,
    @CurrentUser() user?: TokenPayload,
  ) {
    return this.resumenUseCase.execute(
      this.requireCompany(user),
      query.periodo,
      query.libro ?? null,
    );
  }

  /**
   * Envía el libro conciliado a SUNAT.
   *
   * Devuelve 202 con el ticket y el `messageId` para el sondeo.
   */
  @Post('reportar')
  @HttpCode(HttpStatus.ACCEPTED)
  async reportar(
    @Body() dto: SireReporteRequestDto,
    @CurrentUser() user?: TokenPayload,
  ) {
    return this.reportarUseCase.execute(this.requireCompany(user), dto);
  }

  /**
   * Estado de un reporte en curso.
   */
  @Get('reportar/estado/:messageId')
  async estadoReporte(
    @Param('messageId', new ParseUUIDPipe()) messageId: string,
    @CurrentUser() user?: TokenPayload,
  ): Promise<SireTrabajoEstadoRespuesta> {
    return this.consultarReporteUseCase.execute(
      this.requireCompany(user),
      messageId,
    );
  }

  /**
   * Historial unificado de los flujos del menú.
   */
  @Get('historial')
  async historial(
    @Query() query: SireHistorialQueryDto,
    @CurrentUser() user?: TokenPayload,
  ): Promise<SireHistorialRespuesta> {
    return this.historialUseCase.execute(
      this.requireCompany(user),
      query.periodo ?? null,
      query.limite ?? null,
    );
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
   *
   * El RUC NUNCA se toma del cuerpo de la petición: sale de la empresa
   * autenticada. Es el dato contra el que se valida el nombre del archivo.
   */
  private async requireRuc(companyId: string): Promise<string> {
    const empresa = await this.users.findCompanyById(companyId);
    if (!empresa) {
      throw new NotFoundException('No se encontró la empresa del usuario.');
    }
    return empresa.ruc;
  }
}
