import { ForbiddenException, Inject, Injectable } from '@nestjs/common';
import { CreateInvoiceDto } from '../dto/createInvoiceDto';
import { InvoiceEntity } from '../../domain/entities/invoiceEntity';
import {
  type IInvoiceRepositoryPort,
  INVOICE_REPOSITORY_PORT,
  type InvoicePersistenceResult,
} from '../../domain/ports/invoiceRepositoryPort';

@Injectable()
export class CreateInvoiceUseCase {
  constructor(
    @Inject(INVOICE_REPOSITORY_PORT)
    private readonly invoiceRepository: IInvoiceRepositoryPort,
  ) { }

  /**
   * @param companyId Tenant emisor, extraido del JWT por @CurrentCompany().
   *   Nunca se toma del cuerpo de la peticion: aceptarlo permitiria que un
   *   cliente emitiera a nombre de otra empresa (IDOR).
   * @param claveIdempotencia Huella del comprobante (TA-32). Es opcional para
   *   no romper a los llamadores existentes ni las pruebas que construyen el
   *   caso de uso con dos argumentos.
   */
  async execute(
    dto: CreateInvoiceDto,
    companyId: string,
    claveIdempotencia?: string,
  ): Promise<InvoicePersistenceResult> {
    if (!companyId) {
      throw new ForbiddenException(
        'La peticion no tiene empresa asociada: falta companyId en el token',
      );
    }

    const entity = new InvoiceEntity({
      company_id: companyId,
      ruc_emisor: dto.ruc_emisor,
      serie: dto.serie,
      correlativo: dto.correlativo,
      tipo_comprobante: dto.tipo_comprobante,
      monto_total: dto.monto_total,
      fecha_emision: new Date(dto.fecha_emision),
      payload_ubl: dto.payload_ubl,
      clave_idempotencia: claveIdempotencia,
    });

    return this.invoiceRepository.saveWithTransactionalOutbox(entity);
  }
}
