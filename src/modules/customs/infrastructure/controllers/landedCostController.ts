import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Optional,
  Param,
  Post,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { CurrentCompany } from '../../../../common/decorators';
import { AuthGuard } from '../../../auth/infrastructure/guards/authGuard';
import {
  AddLocalExpenseDto,
  AdjustLateImportCostDto,
  ApproveLandedCostDto,
  CalculateLandedCostDto,
} from '../../application/dto';
import {
  AddLocalExpenseUseCase,
  AdjustLateImportCostUseCase,
  ApproveLandedCostSheetUseCase,
  CalculateLandedCostUseCase,
} from '../../application/use-cases';
import {
  LANDED_COST_REPOSITORY_PORT,
  type ILandedCostRepositoryPort,
} from '../../domain/ports/landedCostRepositoryPort';
import { PrismaService } from '../../../../database/prismaService';

@Controller('api/v1/customs/landed-cost')
@UseGuards(AuthGuard)
export class LandedCostController {
  constructor(
    private readonly addLocalExpenseUseCase: AddLocalExpenseUseCase,
    private readonly calculateLandedCostUseCase: CalculateLandedCostUseCase,
    @Inject(LANDED_COST_REPOSITORY_PORT)
    private readonly landedCostRepository: ILandedCostRepositoryPort,
    @Optional()
    private readonly approveLandedCostSheetUseCase?: ApproveLandedCostSheetUseCase,
    @Optional()
    private readonly adjustLateImportCostUseCase?: AdjustLateImportCostUseCase,
    @Optional()
    private readonly prisma?: PrismaService,
  ) {}

  @Post('expenses')
  @HttpCode(HttpStatus.CREATED)
  async addExpense(
    @CurrentCompany() companyId: string | undefined,
    @Body() dto: AddLocalExpenseDto,
  ) {
    if (!companyId) {
      throw new UnauthorizedException('Identificador de empresa (company_id) requerido.');
    }
    return this.addLocalExpenseUseCase.execute(dto, companyId);
  }

  @Get('expenses/:shipmentId')
  @HttpCode(HttpStatus.OK)
  async getExpenses(
    @Param('shipmentId') shipmentId: string,
    @CurrentCompany() companyId: string | undefined,
  ) {
    if (!companyId) {
      throw new UnauthorizedException('Identificador de empresa (company_id) requerido.');
    }
    return this.landedCostRepository.findLocalExpensesByShipmentId(shipmentId, companyId);
  }

  @Post('calculate')
  @HttpCode(HttpStatus.OK)
  async calculateLandedCost(
    @CurrentCompany() companyId: string | undefined,
    @Body() dto: CalculateLandedCostDto,
  ) {
    if (!companyId) {
      throw new UnauthorizedException('Identificador de empresa (company_id) requerido.');
    }
    return this.calculateLandedCostUseCase.execute(dto, companyId);
  }

  @Get('sheet/:shipmentId')
  @HttpCode(HttpStatus.OK)
  async getSheet(
    @Param('shipmentId') shipmentId: string,
    @CurrentCompany() companyId: string | undefined,
  ) {
    if (!companyId) {
      throw new UnauthorizedException('Identificador de empresa (company_id) requerido.');
    }
    return this.landedCostRepository.findLandedCostSheetByShipmentId(shipmentId, companyId);
  }

  @Post('approve')
  @HttpCode(HttpStatus.OK)
  async approveSheet(
    @CurrentCompany() companyId: string | undefined,
    @Body() dto: ApproveLandedCostDto,
  ) {
    if (!companyId) {
      throw new UnauthorizedException('Identificador de empresa (company_id) requerido.');
    }
    if (!this.approveLandedCostSheetUseCase) {
      throw new Error('ApproveLandedCostSheetUseCase no está inyectado');
    }
    return this.approveLandedCostSheetUseCase.execute(dto, companyId);
  }

  @Post('late-cost')
  @HttpCode(HttpStatus.CREATED)
  async adjustLateCost(
    @CurrentCompany() companyId: string | undefined,
    @Body() dto: AdjustLateImportCostDto,
  ) {
    if (!companyId) {
      throw new UnauthorizedException('Identificador de empresa (company_id) requerido.');
    }
    if (!this.adjustLateImportCostUseCase) {
      throw new Error('AdjustLateImportCostUseCase no está inyectado');
    }
    return this.adjustLateImportCostUseCase.execute(dto, companyId);
  }

  @Get('eligible-invoices')
  @HttpCode(HttpStatus.OK)
  async getEligibleInvoices(@CurrentCompany() companyId: string | undefined) {
    if (!companyId) {
      throw new UnauthorizedException('Identificador de empresa (company_id) requerido.');
    }
    if (this.prisma) {
      return this.prisma.nationalPurchase.findMany({
        where: {
          company_id: companyId,
          document_type_code: '01',
        },
        select: {
          id: true,
          supplier_doc_number: true,
          supplier_name: true,
          document_serial: true,
          document_number: true,
          issue_date: true,
          net_amount: true,
          igv_amount: true,
          total_amount: true,
        },
        orderBy: { issue_date: 'desc' },
        take: 50,
      });
    }
    return [];
  }

  @Get('eligible-shipments')
  @HttpCode(HttpStatus.OK)
  async getEligibleShipments(@CurrentCompany() companyId: string | undefined) {
    if (!companyId) {
      throw new UnauthorizedException('Identificador de empresa (company_id) requerido.');
    }
    if (this.prisma) {
      return this.prisma.customsShipment.findMany({
        where: {
          company_id: companyId,
        },
        select: {
          id: true,
          shipment_number: true,
          incoterm: true,
          status: true,
          currency_code: true,
          created_at: true,
          supplier: {
            select: {
              business_name: true,
              country_code: true,
            },
          },
          declarations: {
            select: {
              id: true,
              dua_number: true,
              channel: true,
              status: true,
            },
          },
        },
        orderBy: { created_at: 'desc' },
      });
    }
    return [];
  }
}
