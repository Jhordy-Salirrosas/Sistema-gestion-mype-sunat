import {
  Inject,
  Injectable,
  Optional,
} from '@nestjs/common';
import { PrismaService } from '../../../../database/prismaService';
import { CreateInvoiceDto } from '../dto/createInvoiceDto';
import { QueueService } from '../../../resilience/infrastructure/queue/queue.service';
import { CreateInvoiceUseCase } from '../use-cases/createInvoiceUseCase';
import {
  type IInvoiceRepositoryPort,
  INVOICE_REPOSITORY_PORT,
} from '../../domain/ports/invoiceRepositoryPort';
import { PrismaInvoiceRepository } from '../../infrastructure/persistence/prismaInvoiceRepository';
import { InvoiceEntity } from '../../domain/entities/invoiceEntity';

@Injectable()
export class InvoicesService {
  private readonly repository?: IInvoiceRepositoryPort;

  constructor(
    @Optional() private readonly prisma?: PrismaService,
    @Optional() private readonly queueService?: QueueService,
    @Optional() private readonly createInvoiceUseCase?: CreateInvoiceUseCase,
    @Optional()
    @Inject(INVOICE_REPOSITORY_PORT)
    private readonly invoiceRepository?: IInvoiceRepositoryPort,
  ) {
    if (this.invoiceRepository) {
      this.repository = this.invoiceRepository;
    } else if (this.prisma && this.queueService) {
      this.repository = new PrismaInvoiceRepository(
        this.prisma,
        this.queueService,
      );
    }
  }

  async create(dto: CreateInvoiceDto) {
    if (this.createInvoiceUseCase) {
      return this.createInvoiceUseCase.execute(dto);
    }

    if (this.repository) {
      const invoice = new InvoiceEntity({
        ruc_emisor: dto.ruc_emisor,
        serie: dto.serie,
        correlativo: dto.correlativo,
        tipo_comprobante: dto.tipo_comprobante,
        monto_total: dto.monto_total,
        fecha_emision: new Date(dto.fecha_emision),
        payload_ubl: dto.payload_ubl,
      });

      return this.repository.saveWithTransactionalOutbox(invoice);
    }

    throw new Error('No repository or use case available in InvoicesService');
  }
}

