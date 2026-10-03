import {
  Controller,
  Post,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { InvoicesService } from './invoices.service';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { ApiKeyGuard } from './guards/api-key.guard';

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
