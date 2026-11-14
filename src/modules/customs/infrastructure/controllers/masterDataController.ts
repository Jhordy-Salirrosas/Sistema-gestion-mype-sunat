import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { CurrentCompany } from '../../../../common/decorators';
import { AuthGuard } from '../../../auth/infrastructure/guards/authGuard';
import { MasterDataService } from '../../application/services/masterDataService';
import {
  AddPartnerAddressDto,
  AddPartnerBankAccountDto,
  AddPartnerContactDto,
  CreateExchangeRateDto,
  CreatePartnerDto,
  UpdatePartnerDto,
  UpsertPartnerTaxStatusDto,
  UpsertAccountingMappingDto,
  UpsertCurrencyDto,
  UpsertDocumentTypeDto,
  UpsertIncotermDto,
  UpsertCountryDto,
  UpsertPortDto,
  UpdateExchangeRateDto,
  UpsertCustomsServiceDto,
} from '../../application/dto/masterDataDto';

/**
 * API de maestros de la Fase 1.
 *
 * Prefijo `/api/v1/master-data` para que el frontend lo consuma sin acoplarse
 * a customs. El controlador vive en customs para no crear un módulo nuevo.
 */
@Controller('api/v1/master-data')
@UseGuards(AuthGuard)
export class MasterDataController {
  constructor(private readonly masterData: MasterDataService) {}

  // Monedas
  @Get('currencies')
  listCurrencies() {
    return this.masterData.listCurrencies();
  }

  @Put('currencies')
  upsertCurrency(@Body() dto: UpsertCurrencyDto) {
    return this.masterData.upsertCurrency(dto);
  }

  @Delete('currencies/:code')
  deleteCurrency(@Param('code') code: string) {
    return this.masterData.deleteCurrency(code);
  }

  // Tipos de cambio
  @Get('exchange-rates')
  listExchangeRates() {
    return this.masterData.listExchangeRates();
  }

  @Post('exchange-rates')
  createExchangeRate(@Body() dto: CreateExchangeRateDto) {
    return this.masterData.createExchangeRate(dto);
  }

  @Put('exchange-rates/:id')
  updateExchangeRate(@Param('id') id: string, @Body() dto: UpdateExchangeRateDto) {
    return this.masterData.updateExchangeRate(id, dto);
  }

  @Post('exchange-rates/sync-today')
  syncTodayExchangeRate() {
    return this.masterData.syncTodayExchangeRate();
  }

  @Delete('exchange-rates/:id')
  deleteExchangeRate(@Param('id') id: string) {
    return this.masterData.deleteExchangeRate(id);
  }

  // Países
  @Get('countries')
  listCountries() {
    return this.masterData.listCountries();
  }

  @Put('countries')
  upsertCountry(@Body() dto: UpsertCountryDto) {
    return this.masterData.upsertCountry(dto);
  }

  @Delete('countries/:code')
  deleteCountry(@Param('code') code: string) {
    return this.masterData.deleteCountry(code);
  }

  // Puertos
  @Get('ports')
  listPorts(@Query('type') type?: string) {
    return this.masterData.listPorts(type);
  }

  @Put('ports')
  upsertPort(@Body() dto: UpsertPortDto) {
    return this.masterData.upsertPort(dto);
  }

  @Delete('ports/:code')
  deletePort(@Param('code') code: string) {
    return this.masterData.deletePort(code);
  }

  // Incoterms
  @Get('incoterms')
  listIncoterms() {
    return this.masterData.listIncoterms();
  }

  @Put('incoterms')
  upsertIncoterm(@Body() dto: UpsertIncotermDto) {
    return this.masterData.upsertIncoterm(dto);
  }

  @Delete('incoterms/:code')
  deleteIncoterm(@Param('code') code: string) {
    return this.masterData.deleteIncoterm(code);
  }

  // Terceros
  @Get('partners')
  listPartners(
    @CurrentCompany() companyId: string | undefined,
    @Query('role') role?: string,
    @Query('q') q?: string,
  ) {
    return this.masterData.listPartners(this.requireCompany(companyId), role, q);
  }

  @Get('partners/:id')
  getPartner(
    @CurrentCompany() companyId: string | undefined,
    @Param('id') id: string,
  ) {
    return this.masterData.getPartner(this.requireCompany(companyId), id);
  }

  @Post('partners')
  createPartner(
    @CurrentCompany() companyId: string | undefined,
    @Body() dto: CreatePartnerDto,
  ) {
    return this.masterData.createPartner(this.requireCompany(companyId), dto);
  }

  @Put('partners/:id')
  updatePartner(
    @CurrentCompany() companyId: string | undefined,
    @Param('id') id: string,
    @Body() dto: UpdatePartnerDto,
  ) {
    return this.masterData.updatePartner(this.requireCompany(companyId), id, dto);
  }

  @Delete('partners/:id')
  deletePartner(
    @CurrentCompany() companyId: string | undefined,
    @Param('id') id: string,
  ) {
    return this.masterData.deletePartner(this.requireCompany(companyId), id);
  }

  @Get('partners/:id/tax-status')
  getPartnerTaxStatus(
    @CurrentCompany() companyId: string | undefined,
    @Param('id') id: string,
  ) {
    return this.masterData.getPartnerTaxStatus(this.requireCompany(companyId), id);
  }

  @Put('partners/:id/tax-status')
  upsertPartnerTaxStatus(
    @CurrentCompany() companyId: string | undefined,
    @Param('id') id: string,
    @Body() dto: UpsertPartnerTaxStatusDto,
  ) {
    return this.masterData.upsertPartnerTaxStatus(
      this.requireCompany(companyId),
      id,
      dto,
    );
  }

  @Post('partners/:id/addresses')
  addAddress(
    @CurrentCompany() companyId: string | undefined,
    @Param('id') id: string,
    @Body() dto: AddPartnerAddressDto,
  ) {
    return this.masterData.addAddress(this.requireCompany(companyId), id, dto);
  }

  @Post('partners/:id/contacts')
  addContact(
    @CurrentCompany() companyId: string | undefined,
    @Param('id') id: string,
    @Body() dto: AddPartnerContactDto,
  ) {
    return this.masterData.addContact(this.requireCompany(companyId), id, dto);
  }

  @Post('partners/:id/bank-accounts')
  addBankAccount(
    @CurrentCompany() companyId: string | undefined,
    @Param('id') id: string,
    @Body() dto: AddPartnerBankAccountDto,
  ) {
    return this.masterData.addBankAccount(this.requireCompany(companyId), id, dto);
  }

  @Put('partners/:id/:kind/:recordId')
  updatePartnerRecord(@CurrentCompany() companyId: string | undefined, @Param('id') id: string, @Param('kind') kind: string, @Param('recordId') recordId: string, @Body() dto: Record<string, unknown>) {
    if (!dto || typeof dto !== 'object' || Array.isArray(dto)) throw new BadRequestException('Datos del registro requeridos.');
    return this.masterData.changePartnerRecord(this.requireCompany(companyId), id, kind, recordId, dto);
  }

  @Delete('partners/:id/:kind/:recordId')
  deletePartnerRecord(@CurrentCompany() companyId: string | undefined, @Param('id') id: string, @Param('kind') kind: string, @Param('recordId') recordId: string) {
    return this.masterData.changePartnerRecord(this.requireCompany(companyId), id, kind, recordId);
  }

  // Tipos de documento
  @Get('document-types')
  listDocumentTypes() {
    return this.masterData.listDocumentTypes();
  }

  @Put('document-types')
  upsertDocumentType(@Body() dto: UpsertDocumentTypeDto) {
    return this.masterData.upsertDocumentType(dto);
  }

  @Delete('document-types/:code')
  deleteDocumentType(@Param('code') code: string) {
    return this.masterData.deleteDocumentType(code);
  }

  // Mapeo contable
  @Get('accounting-mappings')
  listAccountingMappings(@CurrentCompany() companyId: string | undefined) {
    return this.masterData.listAccountingMappings(this.requireCompany(companyId));
  }

  @Put('accounting-mappings')
  upsertAccountingMapping(
    @CurrentCompany() companyId: string | undefined,
    @Body() dto: UpsertAccountingMappingDto,
  ) {
    return this.masterData.upsertAccountingMapping(
      this.requireCompany(companyId),
      dto,
    );
  }

  // Servicios Aduaneros / Gastos de Despacho (Sincronizados con inventory_products)
  @Get('services')
  listCustomsServices(@CurrentCompany() companyId: string | undefined) {
    return this.masterData.listCustomsServices(this.requireCompany(companyId));
  }

  @Put('services')
  upsertCustomsService(
    @CurrentCompany() companyId: string | undefined,
    @Body() dto: UpsertCustomsServiceDto,
  ) {
    return this.masterData.upsertCustomsService(this.requireCompany(companyId), dto);
  }

  @Delete('services/:sku')
  deleteCustomsService(
    @CurrentCompany() companyId: string | undefined,
    @Param('sku') sku: string,
  ) {
    return this.masterData.deleteCustomsService(this.requireCompany(companyId), sku);
  }

  private requireCompany(companyId?: string): string {
    if (!companyId) {
      throw new UnauthorizedException('La empresa del usuario no está definida.');
    }
    return companyId;
  }
}
