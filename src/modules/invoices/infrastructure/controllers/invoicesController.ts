import {
  Controller,
  Post,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
  Optional,
} from '@nestjs/common';
import { InvoicesService } from '../../application/services/invoicesService';
import { CreateInvoiceUseCase } from '../../application/use-cases/createInvoiceUseCase';
import { CreateInvoiceDto } from '../../application/dto/createInvoiceDto';
import { ApiKeyGuard } from '../guards/apiKeyGuard';

@Controller('api/v1/invoices')
@UseGuards(ApiKeyGuard)
export class InvoicesController {
  constructor(
    private readonly createInvoiceUseCase: CreateInvoiceUseCase,
    @Optional() private readonly invoicesService?: InvoicesService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.ACCEPTED)
  async create(@Body() dto: CreateInvoiceDto) {
    const invoice = this.invoicesService
      ? await this.invoicesService.create(dto)
      : await this.createInvoiceUseCase.execute(dto);

    return {
      id: invoice.id,
      estado: invoice.estado,
      message: 'Comprobante recibido y en cola para procesamiento',
      created_at: invoice.created_at,
    };
  }
}

