import {
  Controller,
  Post,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
  Optional,
} from '@nestjs/common';
import { CurrentCompany } from '../../../../common/decorators';
import { InvoicesService } from '../../application/services/invoicesService';
import { CreateInvoiceUseCase } from '../../application/use-cases/createInvoiceUseCase';
import { CreateInvoiceDto } from '../../application/dto/createInvoiceDto';
import { AuthGuard } from '../../../auth/infrastructure/guards/authGuard';
import { CurrentCompany } from '../../../../common/decorators';

@Controller('api/v1/invoices')
@UseGuards(AuthGuard)
export class InvoicesController {
  constructor(
    private readonly createInvoiceUseCase: CreateInvoiceUseCase,
    @Optional() private readonly invoicesService?: InvoicesService,
  ) { }

  @Post()
  @HttpCode(HttpStatus.ACCEPTED)
  async create(
    @Body() dto: CreateInvoiceDto,
    @CurrentCompany() companyId: string,
  ) {
    const invoice = this.invoicesService
      ? await this.invoicesService.create(dto, companyId)
      : await this.createInvoiceUseCase.execute(dto, companyId);

    return {
      id: invoice.id,
      estado: invoice.estado,
      message: 'Comprobante recibido y en cola para procesamiento',
      created_at: invoice.created_at,
    };
  }
}
