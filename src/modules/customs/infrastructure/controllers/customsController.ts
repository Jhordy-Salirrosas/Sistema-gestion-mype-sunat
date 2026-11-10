import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Optional,
  Param,
  Post,
  Query,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { CurrentCompany } from '../../../../common/decorators';
import { AuthGuard } from '../../../auth/infrastructure/guards/authGuard';
import { PrismaService } from '../../../../database/prismaService';
import { AddDeclarationDocumentDto } from '../../application/dto/addDeclarationDocumentDto';
import { CalculateDuaDto } from '../../application/dto/calculateDuaDto';
import { RegisterDuaDto } from '../../application/dto/registerDuaDto';
import { RegisterDuaWizardDto } from '../../application/dto/registerDuaWizardDto';
import { SimulateDamTaxesDto } from '../../application/dto/simulateDamTaxesDto';
import {
  CalculateDuaUseCase,
  type CalculatedDuaResponse,
} from '../../application/use-cases/calculateDuaUseCase';
import {
  RegisterDuaUseCase,
  type RegisteredDuaResponse,
} from '../../application/use-cases/registerDuaUseCase';
import { RegisterDuaWizardUseCase } from '../../application/use-cases/registerDuaWizardUseCase';
import {
  GetCustomsDeclarationByIdUseCase,
  type CustomsDeclarationDetailResponse,
} from '../../application/use-cases/getCustomsDeclarationByIdUseCase';
import { ListCustomsDeclarationsUseCase } from '../../application/use-cases/listCustomsDeclarationsUseCase';
import { SimulateDamTaxesUseCase } from '../../application/use-cases/simulateDamTaxesUseCase';
import type { CustomsDeclarationSummary } from '../../domain/ports/customsRepositoryPort';

@Controller('api/v1/customs')
export class CustomsController {
  constructor(
    private readonly calculateDuaUseCase: CalculateDuaUseCase,
    private readonly registerDuaUseCase: RegisterDuaUseCase,
    private readonly getCustomsDeclarationByIdUseCase: GetCustomsDeclarationByIdUseCase,
    private readonly listCustomsDeclarationsUseCase: ListCustomsDeclarationsUseCase,
    @Optional() private readonly registerDuaWizardUseCase?: RegisterDuaWizardUseCase,
    @Optional() private readonly simulateDamTaxesUseCase?: SimulateDamTaxesUseCase,
    @Optional() private readonly prisma?: PrismaService,
  ) {}

  @Post('calculate')
  @UseGuards(AuthGuard)
  @HttpCode(HttpStatus.OK)
  calculateLiquidation(@Body() dto: CalculateDuaDto): CalculatedDuaResponse {
    return this.calculateDuaUseCase.execute(dto);
  }

  @Post('declarations/simulate')
  @UseGuards(AuthGuard)
  @HttpCode(HttpStatus.OK)
  async simulateDeclaration(@Body() dto: SimulateDamTaxesDto) {
    if (!this.simulateDamTaxesUseCase) {
      throw new Error('SimulateDamTaxesUseCase no está inyectado');
    }
    return this.simulateDamTaxesUseCase.execute(dto);
  }

  @Post('declarations/wizard')
  @UseGuards(AuthGuard)
  @HttpCode(HttpStatus.CREATED)
  async registerDeclarationWizard(
    @CurrentCompany() companyId: string | undefined,
    @Body() dto: RegisterDuaWizardDto,
  ) {
    if (!companyId) {
      throw new UnauthorizedException('Identificador de empresa (company_id) requerido.');
    }
    if (!this.registerDuaWizardUseCase) {
      throw new Error('RegisterDuaWizardUseCase no está inyectado');
    }
    return this.registerDuaWizardUseCase.execute(dto, companyId);
  }

  @Post('declarations')
  @UseGuards(AuthGuard)
  @HttpCode(HttpStatus.CREATED)
  async registerDeclaration(
    @CurrentCompany() companyId: string | undefined,
    @Body() dto: RegisterDuaDto,
  ): Promise<RegisteredDuaResponse> {
    if (!companyId) {
      throw new UnauthorizedException('Identificador de empresa (company_id) requerido.');
    }
    return this.registerDuaUseCase.execute(dto, companyId);
  }

  @Get('declarations/:id')
  @UseGuards(AuthGuard)
  @HttpCode(HttpStatus.OK)
  async getDeclarationById(
    @Param('id') id: string,
    @CurrentCompany() companyId: string | undefined,
  ): Promise<CustomsDeclarationDetailResponse> {
    if (!companyId) {
      throw new UnauthorizedException('Identificador de empresa (company_id) requerido.');
    }
    return this.getCustomsDeclarationByIdUseCase.execute(id, companyId);
  }

  @Get('declarations')
  @UseGuards(AuthGuard)
  @HttpCode(HttpStatus.OK)
  async listDeclarations(
    @CurrentCompany() companyId: string | undefined,
  ): Promise<CustomsDeclarationSummary[]> {
    if (!companyId) {
      throw new UnauthorizedException('Identificador de empresa (company_id) requerido.');
    }
    return this.listCustomsDeclarationsUseCase.execute(companyId);
  }

  // Documentos de la Declaración Aduanera (Formatos A, B, C y Sustento)
  @Post('declarations/:id/documents')
  @UseGuards(AuthGuard)
  @HttpCode(HttpStatus.CREATED)
  async uploadDeclarationDocument(
    @Param('id') declarationId: string,
    @CurrentCompany() companyId: string | undefined,
    @Body() dto: AddDeclarationDocumentDto,
  ) {
    if (!companyId) {
      throw new UnauthorizedException('Identificador de empresa (company_id) requerido.');
    }
    if (this.prisma) {
      return this.prisma.customsDeclarationDocument.create({
        data: {
          declaration_id: declarationId,
          format_type: dto.format_type,
          document_number: dto.document_number ?? null,
          file_name: dto.file_name,
          storage_url: dto.storage_url,
          mime_type: dto.mime_type ?? 'application/pdf',
          file_size_bytes: dto.file_size_bytes ?? null,
          uploaded_by: dto.uploaded_by ?? 'OPERADOR',
        },
      });
    }
    return { id: 'doc-' + Date.now(), declaration_id: declarationId, ...dto };
  }

  @Get('declarations/:id/documents')
  @UseGuards(AuthGuard)
  @HttpCode(HttpStatus.OK)
  async getDeclarationDocuments(
    @Param('id') declarationId: string,
    @CurrentCompany() companyId: string | undefined,
  ) {
    if (!companyId) {
      throw new UnauthorizedException('Identificador de empresa (company_id) requerido.');
    }
    if (this.prisma) {
      return this.prisma.customsDeclarationDocument.findMany({
        where: { declaration_id: declarationId },
        orderBy: { created_at: 'desc' },
      });
    }
    return [];
  }

  // Catálogos auxiliares de aduanas
  @Get('catalogs/brokers')
  @HttpCode(HttpStatus.OK)
  async getCatalogsBrokers(@Query('q') query?: string) {
    if (this.prisma) {
      return this.prisma.customsBroker.findMany({
        where: {
          mandate_active: true,
          ...(query ? { business_name: { contains: query, mode: 'insensitive' } } : {}),
        },
        orderBy: { business_name: 'asc' },
        take: 100,
      });
    }
    return [];
  }

  @Get('catalogs/suppliers')
  @UseGuards(AuthGuard)
  @HttpCode(HttpStatus.OK)
  async getCatalogsSuppliers(
    @CurrentCompany() companyId: string | undefined,
    @Query('q') query?: string,
  ) {
    if (!companyId) {
      throw new UnauthorizedException('Identificador de empresa (company_id) requerido.');
    }
    if (this.prisma) {
      return this.prisma.foreignSupplier.findMany({
        where: {
          company_id: companyId,
          ...(query ? { business_name: { contains: query, mode: 'insensitive' } } : {}),
        },
        orderBy: { business_name: 'asc' },
        take: 100,
      });
    }
    return [];
  }
}
