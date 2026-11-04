import { ForbiddenException, Inject, Injectable, Optional } from '@nestjs/common';
import { CreateInvoiceDto } from '../dto/createInvoiceDto';
import { InvoiceEntity } from '../../domain/entities/invoiceEntity';
import {
  type IInvoiceRepositoryPort,
  INVOICE_REPOSITORY_PORT,
  type InvoicePersistenceResult,
} from '../../domain/ports/invoiceRepositoryPort';
import { GenerateAccountingEntryUseCase } from '../../../accounting/application/use-cases/generateAccountingEntryUseCase';

@Injectable()
export class CreateInvoiceUseCase {
  constructor(
    @Inject(INVOICE_REPOSITORY_PORT)
    private readonly invoiceRepository: IInvoiceRepositoryPort,
    @Optional()
    private readonly generateAccountingEntryUseCase?: GenerateAccountingEntryUseCase,
  ) {}

  async execute(
    dto: CreateInvoiceDto,
    companyId: string,
    claveIdempotencia?: string,
  ): Promise<InvoicePersistenceResult> {
    if (!companyId) {
      throw new ForbiddenException(
        'La petición no tiene empresa asociada: falta companyId en el token',
      );
    }

    const rawDto: any = dto;
    const fechaEmisionStr = rawDto.fecha_emision || rawDto.fechaEmision || new Date().toISOString();
    const fecha = new Date(fechaEmisionStr);

    const entity = new InvoiceEntity({
      company_id: companyId,
      ruc_emisor: rawDto.ruc_emisor || rawDto.rucEmisor || '',
      serie: rawDto.serie || rawDto.series || 'F001',
      correlativo: Number(rawDto.correlativo || rawDto.correlativoNumber || 1),
      tipo_comprobante: rawDto.tipo_comprobante || rawDto.tipoComprobante || '01',
      monto_total: rawDto.monto_total || rawDto.montoTotal || 0,
      fecha_emision: fecha,
      payload_ubl: rawDto.payload_ubl || rawDto.payloadUbl || {},
      clave_idempotencia: claveIdempotencia,
    });

    const result = await this.invoiceRepository.saveWithTransactionalOutbox(entity);

    // =========================================================================
    // GENERACIÓN AUTOMÁTICA DE ASIENTO CONTABLE EN LIBRO DIARIO (PCGE 2019)
    // =========================================================================
    if (this.generateAccountingEntryUseCase) {
      try {
        const period = `${fecha.getFullYear()}${String(fecha.getMonth() + 1).padStart(2, '0')}`;
        const montoTotal = Number(rawDto.monto_total || rawDto.montoTotal || 0);
        const subtotal = Math.round((montoTotal / 1.18) * 100) / 100;
        const igv = Math.round((montoTotal - subtotal) * 100) / 100;

        const serieStr = rawDto.serie || rawDto.series || 'F001';
        const correlativoStr = rawDto.correlativo || rawDto.correlativoNumber || 1;

        const entryPayload: any = {
          companyId,
          period,
          entryNumber: Number(correlativoStr) || 1,
          entry_number: Number(correlativoStr) || 1,
          entryDate: fecha,
          entry_date: fecha,
          glosa: `Por la emisión del comprobante ${serieStr}-${correlativoStr}`,
          sourceModule: 'INVOICING',
          source_module: 'INVOICING',
          sourceReferenceId: result.id,
          source_reference_id: result.id,
          lines: [
            {
              accountCode: '1212',
              account_code: '1212',
              accountName: 'Emitidas en cartera (Facturas, boletas y otros comprobantes por cobrar)',
              account_name: 'Emitidas en cartera (Facturas, boletas y otros comprobantes por cobrar)',
              debitAmount: montoTotal,
              debit_amount: montoTotal,
              creditAmount: 0,
              credit_amount: 0,
              lineOrder: 1,
              line_order: 1,
            },
            {
              accountCode: '40111',
              account_code: '40111',
              accountName: 'IGV - Cuenta propia',
              account_name: 'IGV - Cuenta propia',
              debitAmount: 0,
              debit_amount: 0,
              creditAmount: igv,
              credit_amount: igv,
              lineOrder: 2,
              line_order: 2,
            },
            {
              accountCode: '70111',
              account_code: '70111',
              accountName: 'Venta de Mercaderías - Terceros',
              account_name: 'Venta de Mercaderías - Terceros',
              debitAmount: 0,
              debit_amount: 0,
              creditAmount: subtotal,
              credit_amount: subtotal,
              lineOrder: 3,
              line_order: 3,
            },
          ],
        };

        await (this.generateAccountingEntryUseCase as any).execute(entryPayload);
      } catch (err) {
        console.warn('Advertencia: No se pudo asentar automáticamente la entrada contable:', err);
      }
    }

    return result;
  }
}