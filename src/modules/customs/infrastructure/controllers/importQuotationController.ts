import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  Query,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { CurrentCompany } from '../../../../common/decorators';
import { AuthGuard } from '../../../auth/infrastructure/guards/authGuard';
import { ImportQuotationService } from '../../application/services/importQuotationService';
import {
  CreateImportQuotationDto,
  UpdateImportQuotationDto,
  AddProformaDto,
  UpdateProformaDto,
} from '../../application/dto/importQuotationDto';

@Controller('api/v1/customs/quotations')
@UseGuards(AuthGuard)
export class ImportQuotationController {
  constructor(private readonly quotationService: ImportQuotationService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createQuotation(
    @CurrentCompany() companyId: string | undefined,
    @Body() dto: CreateImportQuotationDto,
  ) {
    return this.quotationService.createQuotation(this.requireCompany(companyId), dto);
  }

  @Get()
  async listQuotations(
    @CurrentCompany() companyId: string | undefined,
    @Query('status') status?: string,
    @Query('search') search?: string,
  ) {
    return this.quotationService.listQuotations(this.requireCompany(companyId), { status, search });
  }

  @Get(':id')
  async getQuotationById(
    @Param('id') id: string,
    @CurrentCompany() companyId: string | undefined,
  ) {
    return this.quotationService.getQuotationById(this.requireCompany(companyId), id);
  }

  @Put(':id')
  async updateQuotation(
    @Param('id') id: string,
    @CurrentCompany() companyId: string | undefined,
    @Body() dto: UpdateImportQuotationDto,
  ) {
    return this.quotationService.updateQuotation(this.requireCompany(companyId), id, dto);
  }

  @Post(':id/proformas')
  @HttpCode(HttpStatus.CREATED)
  async addProforma(
    @Param('id') id: string,
    @CurrentCompany() companyId: string | undefined,
    @Body() dto: AddProformaDto,
  ) {
    return this.quotationService.addProforma(this.requireCompany(companyId), id, dto);
  }

  @Put(':id/proformas/:proformaId')
  async updateProforma(
    @Param('id') id: string,
    @Param('proformaId') proformaId: string,
    @CurrentCompany() companyId: string | undefined,
    @Body() dto: UpdateProformaDto,
  ) {
    return this.quotationService.updateProforma(this.requireCompany(companyId), id, proformaId, dto);
  }

  @Delete(':id/proformas/:proformaId')
  async deleteProforma(
    @Param('id') id: string,
    @Param('proformaId') proformaId: string,
    @CurrentCompany() companyId: string | undefined,
  ) {
    return this.quotationService.deleteProforma(this.requireCompany(companyId), id, proformaId);
  }

  @Post(':id/proformas/:proformaId/award')
  @HttpCode(HttpStatus.OK)
  async awardProforma(
    @Param('id') id: string,
    @Param('proformaId') proformaId: string,
    @CurrentCompany() companyId: string | undefined,
  ) {
    return this.quotationService.awardProforma(this.requireCompany(companyId), id, proformaId);
  }

  private requireCompany(companyId?: string): string {
    if (!companyId) {
      throw new UnauthorizedException('Identificador de empresa (company_id) requerido.');
    }
    return companyId;
  }
}
