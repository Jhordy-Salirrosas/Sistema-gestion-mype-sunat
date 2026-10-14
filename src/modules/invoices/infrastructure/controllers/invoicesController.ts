import {
  Controller,
  Post,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { InvoicesService } from '../../application/services/invoicesService';
import { CreateInvoiceDto } from '../../application/dto/createInvoiceDto';
import { ApiKeyGuard } from '../guards/apiKeyGuard';

@Controller('api/v1/invoices')
@UseGuards(ApiKeyGuard)
export class InvoicesController {
  constructor(private readonly invoicesService: InvoicesService) {}

  @Post()
  @HttpCode(HttpStatus.ACCEPTED)
  async create(@Body() dto: CreateInvoiceDto) {
    const invoice = await this.invoicesService.create(dto);

    return {
      id: invoice.id,
      estado: invoice.estado,
      message: 'Comprobante recibido y en cola para procesamiento',
      created_at: invoice.created_at,
    };
  }
}
