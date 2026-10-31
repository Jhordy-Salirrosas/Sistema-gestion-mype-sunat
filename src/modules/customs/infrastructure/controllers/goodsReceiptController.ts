import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  NotFoundException,
  Param,
  Post,
  Query,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { CurrentCompany } from '../../../../common/decorators';
import { AuthGuard } from '../../../auth/infrastructure/guards/authGuard';
import { ConfirmGoodsReceiptDto } from '../../application/dto/confirmGoodsReceiptDto';
import { ConfirmGoodsReceiptUseCase } from '../../application/use-cases/confirmGoodsReceiptUseCase';
import {
  GOODS_RECEIPT_REPOSITORY_PORT,
  type IGoodsReceiptRepositoryPort,
} from '../../domain/ports/goodsReceiptRepositoryPort';

@Controller('api/v1/customs/goods-receipt')
@UseGuards(AuthGuard)
export class GoodsReceiptController {
  constructor(
    private readonly confirmGoodsReceiptUseCase: ConfirmGoodsReceiptUseCase,
    @Inject(GOODS_RECEIPT_REPOSITORY_PORT)
    private readonly goodsReceiptRepository: IGoodsReceiptRepositoryPort,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async confirmReceipt(
    @CurrentCompany() companyId: string | undefined,
    @Body() dto: ConfirmGoodsReceiptDto,
  ) {
    if (!companyId) {
      throw new UnauthorizedException('Identificador de empresa (company_id) requerido.');
    }
    return this.confirmGoodsReceiptUseCase.execute(dto, companyId);
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  async getReceiptById(
    @Param('id') id: string,
    @CurrentCompany() companyId: string | undefined,
  ) {
    if (!companyId) {
      throw new UnauthorizedException('Identificador de empresa (company_id) requerido.');
    }
    const receipt = await this.goodsReceiptRepository.findById(id, companyId);
    if (!receipt) {
      throw new NotFoundException(`Acta de recepción con ID '${id}' no encontrada.`);
    }
    return receipt;
  }

  @Get()
  @HttpCode(HttpStatus.OK)
  async listReceipts(
    @CurrentCompany() companyId: string | undefined,
    @Query('declarationId') declarationId?: string,
    @Query('status') status?: string,
  ) {
    if (!companyId) {
      throw new UnauthorizedException('Identificador de empresa (company_id) requerido.');
    }
    return this.goodsReceiptRepository.listByCompany(companyId, {
      declarationId,
      status,
    });
  }
}

