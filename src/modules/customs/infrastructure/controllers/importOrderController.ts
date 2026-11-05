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
import { ImportOrderService } from '../../application/services/importOrderService';
import {
  CreateImportOrderDto,
  AdvanceStageDto,
  AddOrderDocumentDto,
  GenerateShipmentFromOrderDto,
} from '../../application/dto/importOrderDto';

@Controller('api/v1/customs/orders')
@UseGuards(AuthGuard)
export class ImportOrderController {
  constructor(private readonly orderService: ImportOrderService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createOrder(
    @CurrentCompany() companyId: string | undefined,
    @Body() dto: CreateImportOrderDto,
  ) {
    if (!companyId) {
      throw new UnauthorizedException('Identificador de empresa requerido.');
    }
    return this.orderService.createOrder(companyId, dto);
  }

  @Get()
  async listOrders(
    @CurrentCompany() companyId: string | undefined,
    @Query('status') status?: string,
    @Query('search') search?: string,
  ) {
    if (!companyId) {
      throw new UnauthorizedException('Identificador de empresa requerido.');
    }
    return this.orderService.listOrders(companyId, { status, search });
  }

  @Get(':id')
  async getOrderById(
    @Param('id') id: string,
    @CurrentCompany() companyId: string | undefined,
  ) {
    if (!companyId) {
      throw new UnauthorizedException('Identificador de empresa requerido.');
    }
    return this.orderService.getOrderById(companyId, id);
  }

  @Post(':id/advance-stage')
  @HttpCode(HttpStatus.OK)
  async advanceStage(
    @Param('id') id: string,
    @CurrentCompany() companyId: string | undefined,
    @Body() dto: AdvanceStageDto,
  ) {
    if (!companyId) {
      throw new UnauthorizedException('Identificador de empresa requerido.');
    }
    return this.orderService.advanceStage(companyId, id, dto);
  }

  @Post(':id/documents')
  @HttpCode(HttpStatus.CREATED)
  async addDocument(
    @Param('id') id: string,
    @CurrentCompany() companyId: string | undefined,
    @Body() dto: AddOrderDocumentDto,
  ) {
    if (!companyId) {
      throw new UnauthorizedException('Identificador de empresa requerido.');
    }
    return this.orderService.addDocument(companyId, id, dto);
  }

  @Get(':id/documents')
  async listDocuments(
    @Param('id') id: string,
    @CurrentCompany() companyId: string | undefined,
  ) {
    if (!companyId) {
      throw new UnauthorizedException('Identificador de empresa requerido.');
    }
    return this.orderService.listDocuments(companyId, id);
  }

  @Get(':id/checklist')
  async getChecklist(
    @Param('id') id: string,
    @CurrentCompany() companyId: string | undefined,
  ) {
    if (!companyId) {
      throw new UnauthorizedException('Identificador de empresa requerido.');
    }
    return this.orderService.getChecklist(companyId, id);
  }

  @Post(':id/generate-shipment')
  @HttpCode(HttpStatus.CREATED)
  async generateShipment(
    @Param('id') id: string,
    @CurrentCompany() companyId: string | undefined,
    @Body() dto: GenerateShipmentFromOrderDto,
  ) {
    if (!companyId) {
      throw new UnauthorizedException('Identificador de empresa requerido.');
    }
    return this.orderService.generateShipment(companyId, id, dto);
  }
}
