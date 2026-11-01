import {
  ForbiddenException,
  Inject,
  Injectable,
  Optional,
} from '@nestjs/common';
import { CreateInvoiceDto } from '../dto/createInvoiceDto';
import { InvoiceEntity } from '../../domain/entities/invoiceEntity';
import {
  type IInvoiceRepositoryPort,
  INVOICE_REPOSITORY_PORT,
  type InvoicePersistenceResult,
} from '../../domain/ports/invoiceRepositoryPort';
import { InvoiceSeriesService } from '../services/invoiceSeriesService';
import { validarAdquirente } from '../../domain/rules/taxpayerIdValidator';

@Injectable()
export class CreateInvoiceUseCase {
  constructor(
    @Inject(INVOICE_REPOSITORY_PORT)
    private readonly invoiceRepository: IInvoiceRepositoryPort,
    /**
     * TA-60: la fuente del correlativo. Es OPCIONAL a propósito: los
     * llamadores anteriores y las pruebas que construyen el caso de uso con un
     * solo argumento siguen funcionando y conservan el comportamiento previo
     * (correlativo del DTO). Con el servicio inyectado, el correlativo del DTO
     * deja de usarse y lo asigna la base de datos.
     *
     * `@Optional()` es imprescindible y no basta con el `?` de TypeScript:
     * Nest resuelve las dependencias en ejecución y no puede deducir que el
     * parámetro falta; sin el decorador, un módulo de prueba que no lo provee
     * falla al compilar con "can't resolve dependencies".
     */
    @Optional() private readonly series?: InvoiceSeriesService,
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

    // TA-60: se valida el documento del adquirente ANTES de reservar el
    // correlativo. El orden importa: reservar consume un número de la serie y,
    // como el correlativo rechazado queda "quemado", validar después dejaría un
    // hueco por cada cliente mal escrito. Un dato del cliente no debe costar un
    // número fiscal.
    validarAdquirente(
      dto.customer_identity_number
        ? {
            tipoDoc: dto.customer_identity_type ?? '',
            numeroDoc: dto.customer_identity_number,
            razonSocial: dto.customer_legal_name,
          }
        : null,
      { tipoComprobante: dto.tipo_comprobante, importeTotal: dto.monto_total },
    );

    // TA-60: el correlativo lo reserva la base de datos, no el navegador.
    // Se reserva ANTES de construir la entidad porque la entidad es inmutable
    // y porque si la reserva falla no debe quedar nada a medias.
    const correlativo = await this.reservarCorrelativo(dto, companyId);

    const entity = new InvoiceEntity({
      company_id: companyId,
      ruc_emisor: dto.ruc_emisor,
      serie: dto.serie,
      correlativo,
      tipo_comprobante: dto.tipo_comprobante,
      monto_total: dto.monto_total,
      fecha_emision: new Date(dto.fecha_emision),
      payload_ubl: dto.payload_ubl,
      clave_idempotencia: claveIdempotencia,
    });

    return this.invoiceRepository.saveWithTransactionalOutbox(entity);
  }

  /**
   * Número de la serie para este comprobante.
   *
   * Cuando falta el servicio (construcción de dos argumentos) se devuelve el
   * del DTO, que es como se comportaba antes de TA-60. La integración completa
   * la da el módulo, que sí lo inyecta.
   */
  private async reservarCorrelativo(
    dto: CreateInvoiceDto,
    companyId: string,
  ): Promise<number> {
    if (!this.series) return dto.correlativo;

    return this.series.reservarCorrelativo(
      companyId,
      dto.tipo_comprobante,
      dto.serie,
    );
  }
}
