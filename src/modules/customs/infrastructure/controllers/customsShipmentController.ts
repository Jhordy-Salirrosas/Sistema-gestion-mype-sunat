import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { CurrentCompany } from '../../../../common/decorators';
import { AuthGuard } from '../../../auth/infrastructure/guards/authGuard';
import { CreateShipmentDto, AddDocumentDto, AddEventDto } from '../../application/dto';
import {
  CreateShipmentUseCase,
  ListShipmentsUseCase,
  GetShipmentByIdUseCase,
  AddShipmentDocumentUseCase,
  AddShipmentEventUseCase,
} from '../../application/use-cases';

@Controller('api/v1/customs/shipments')
@UseGuards(AuthGuard)
export class CustomsShipmentController {
  constructor(
    private readonly createShipmentUseCase: CreateShipmentUseCase,
    private readonly listShipmentsUseCase: ListShipmentsUseCase,
    private readonly getShipmentByIdUseCase: GetShipmentByIdUseCase,
    private readonly addShipmentDocumentUseCase: AddShipmentDocumentUseCase,
    private readonly addShipmentEventUseCase: AddShipmentEventUseCase,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createShipment(
    @CurrentCompany() companyId: string | undefined,
    @Body() dto: CreateShipmentDto,
  ) {
    if (!companyId) {
      throw new UnauthorizedException('Identificador de empresa (company_id) requerido.');
    }
    return this.createShipmentUseCase.execute(dto, companyId);
  }

  @Get()
  @HttpCode(HttpStatus.OK)
  async listShipments(
    @CurrentCompany() companyId: string | undefined,
    @Query('status') status?: string,
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    if (!companyId) {
      throw new UnauthorizedException('Identificador de empresa (company_id) requerido.');
    }
    return this.listShipmentsUseCase.execute(companyId, {
      status,
      search,
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 10,
    });
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  async getShipmentById(
    @Param('id') id: string,
    @CurrentCompany() companyId: string | undefined,
  ) {
    if (!companyId) {
      throw new UnauthorizedException('Identificador de empresa (company_id) requerido.');
    }
    return this.getShipmentByIdUseCase.execute(id, companyId);
  }

  @Post(':id/documents')
  @HttpCode(HttpStatus.CREATED)
  async addDocument(
    @Param('id') id: string,
    @CurrentCompany() companyId: string | undefined,
    @Body() dto: AddDocumentDto,
  ) {
    if (!companyId) {
      throw new UnauthorizedException('Identificador de empresa (company_id) requerido.');
    }
    return this.addShipmentDocumentUseCase.execute(id, dto, companyId);
  }

  @Post(':id/events')
  @HttpCode(HttpStatus.CREATED)
  async addEvent(
    @Param('id') id: string,
    @CurrentCompany() companyId: string | undefined,
    @Body() dto: AddEventDto,
  ) {
    if (!companyId) {
      throw new UnauthorizedException('Identificador de empresa (company_id) requerido.');
    }
    return this.addShipmentEventUseCase.execute(id, dto, companyId);
  }
}
