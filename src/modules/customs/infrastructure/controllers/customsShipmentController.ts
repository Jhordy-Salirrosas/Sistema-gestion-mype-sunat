import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
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
    const resolvedCompanyId = companyId || 'default-company-id';
    return this.createShipmentUseCase.execute(dto, resolvedCompanyId);
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
    const resolvedCompanyId = companyId || 'default-company-id';
    return this.listShipmentsUseCase.execute(resolvedCompanyId, {
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
    const resolvedCompanyId = companyId || 'default-company-id';
    return this.getShipmentByIdUseCase.execute(id, resolvedCompanyId);
  }

  @Post(':id/documents')
  @HttpCode(HttpStatus.CREATED)
  async addDocument(
    @Param('id') id: string,
    @CurrentCompany() companyId: string | undefined,
    @Body() dto: AddDocumentDto,
  ) {
    const resolvedCompanyId = companyId || 'default-company-id';
    return this.addShipmentDocumentUseCase.execute(id, dto, resolvedCompanyId);
  }

  @Post(':id/events')
  @HttpCode(HttpStatus.CREATED)
  async addEvent(
    @Param('id') id: string,
    @CurrentCompany() companyId: string | undefined,
    @Body() dto: AddEventDto,
  ) {
    const resolvedCompanyId = companyId || 'default-company-id';
    return this.addShipmentEventUseCase.execute(id, dto, resolvedCompanyId);
  }
}
