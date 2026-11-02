import { Inject, Injectable, Optional } from '@nestjs/common';
import { PrismaService } from '../../../../database/prismaService';
import { CreateInvoiceDto } from '../dto/createInvoiceDto';
import { QueueService } from '../../../resilience/infrastructure/queue/queue.service';
import { CreateInvoiceUseCase } from '../use-cases/createInvoiceUseCase';
import {
  type IInvoiceRepositoryPort,
  INVOICE_REPOSITORY_PORT,
  type InvoicePersistenceResult,
} from '../../domain/ports/invoiceRepositoryPort';
import { PrismaInvoiceRepository } from '../../infrastructure/persistence/prismaInvoiceRepository';
import { InvoiceEntity } from '../../domain/entities/invoiceEntity';
import {
  construirClaveIdempotencia,
  RegistroEnVuelo,
} from './invoiceIdempotency';

@Injectable()
export class InvoicesService {
  private readonly repository?: IInvoiceRepositoryPort;

  /**
   * Peticiones de emisión en vuelo (TA-32, frente 3). Vive en el servicio y no
   * en la base porque su único objetivo es que un doble clic dentro de la
   * ventana de segundos no llegue a ejecutar dos veces el caso de uso. Un solo
   * contenedor de Nest comparte esta instancia entre todas las peticiones.
   */
  private readonly emisionesEnVuelo = new RegistroEnVuelo<InvoicePersistenceResult>();

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

  /**
   * @param companyId Tenant emisor, extraido del JWT. Se propaga a la entidad
   *   para que el comprobante quede asociado a su empresa. Nunca se toma del
   *   cuerpo de la peticion (Anti-IDOR, PLAN.md § 6.3), y por eso tambien
   *   forma parte de la clave de idempotencia: dos empresas distintas pueden
   *   emitir la misma serie-correlativo sin colisionar.
   */
  async create(
    dto: CreateInvoiceDto,
    companyId: string,
  ): Promise<InvoicePersistenceResult> {
    // TA-32 criterio 3: la clave se deriva del contenido fiscal, no de un
    // encabezado del cliente, para que dos peticiones identicas coincidan.
    const clave = construirClaveIdempotencia({
      companyId,
      rucEmisor: dto.ruc_emisor,
      tipoComprobante: dto.tipo_comprobante,
      serie: dto.serie,
      correlativo: dto.correlativo,
    });

    return this.emisionesEnVuelo.ejecutar(
      clave,
      () => this.emitir(dto, companyId, clave),
    );
  }

  /** Persiste el comprobante; se ejecuta una sola vez por clave (TA-32). */
  private async emitir(
    dto: CreateInvoiceDto,
    companyId: string,
    claveIdempotencia: string,
  ): Promise<InvoicePersistenceResult> {
    if (this.createInvoiceUseCase) {
      return this.createInvoiceUseCase.execute(
        dto,
        companyId,
        claveIdempotencia,
      );
    }

    if (this.repository) {
      const invoice = new InvoiceEntity({
        company_id: companyId,
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
