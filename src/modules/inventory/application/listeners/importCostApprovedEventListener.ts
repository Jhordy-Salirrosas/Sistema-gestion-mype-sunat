import { Injectable, Logger, OnModuleInit, Optional, Inject } from '@nestjs/common';
import {
  CUSTOMS_EVENT_PUBLISHER_PORT,
  type ICustomsEventPublisherPort,
} from '../../../customs/domain/ports/customsEventPublisherPort';
import { ProcessImportCostOrderUseCase } from '../use-cases/processImportCostOrderUseCase';
import { ImportCostApprovedEvent } from '../../../customs/domain/events/ImportCostApprovedEvent';
import { PrismaService } from '../../../../database/prismaService';
import { GenerateAccountingEntryUseCase } from '../../../accounting/application/use-cases/generateAccountingEntryUseCase';

@Injectable()
export class ImportCostApprovedEventListener implements OnModuleInit {
  private readonly logger = new Logger(ImportCostApprovedEventListener.name);

  constructor(
    private readonly processImportCostOrderUseCase: ProcessImportCostOrderUseCase,
    @Optional()
    @Inject(CUSTOMS_EVENT_PUBLISHER_PORT)
    private readonly customsEventPublisher?: ICustomsEventPublisherPort,
    @Optional()
    private readonly prisma?: PrismaService,
    @Optional()
    private readonly accounting?: GenerateAccountingEntryUseCase,
  ) {}

  onModuleInit() {
    if (
      this.customsEventPublisher &&
      typeof (this.customsEventPublisher as any).on === 'function'
    ) {
      (this.customsEventPublisher as any).on(
        'customs.import_cost.approved',
        async (event: ImportCostApprovedEvent) => {
          this.logger.log(
            `[EVENT_LISTENER] Consumiendo ImportCostApprovedEvent para shipment ${event.payload.shipmentId}`,
          );
          try {
            await this.processImportCostOrderUseCase.execute({
              companyId: event.payload.companyId,
              shipmentId: event.payload.shipmentId,
              damNumber: event.payload.declarationId || 'DAM-IMPORT',
              items: event.payload.costItems.map((i) => ({
                sku: i.productCode,
                description: i.commercialDescription,
                receivedQuantity: i.quantity,
                unitLandedCostPen: i.unitLandedCostPen,
                destinationType: i.destinationType,
              })),
            });
            await this.registrarAsientoImportacion(event);
          } catch (err: any) {
            this.logger.error(
              `Error al procesar ImportCostApprovedEvent: ${err.message}`,
              err.stack,
            );
          }
        },
      );
    }
  }

  /** Asiento de importación: inventario contra cuenta por pagar. */
  private async registrarAsientoImportacion(event: ImportCostApprovedEvent): Promise<void> {
    if (!this.accounting || !this.prisma) return;

    const { companyId, shipmentId, approvedAt, totalInventoryCostPen } = event.payload;
    const existente = await this.prisma.accountingEntry.findFirst({
      where: {
        company_id: companyId,
        source_module: 'PURCHASES_IMPORT',
        source_reference_id: shipmentId,
      },
      select: { id: true },
    });
    if (existente) return;

    const fecha = approvedAt instanceof Date ? approvedAt : new Date(approvedAt);
    const period = `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}`;
    await this.accounting.execute({
      companyId,
      period,
      entryDate: fecha.toISOString(),
      glosa: `Importación ${shipmentId}`,
      sourceModule: 'PURCHASES_IMPORT',
      sourceReferenceId: shipmentId,
      lines: [
        {
          lineOrder: 1,
          accountCode: '201',
          accountName: 'Mercaderías',
          debitAmount: totalInventoryCostPen,
          creditAmount: 0,
        },
        {
          lineOrder: 2,
          accountCode: '421',
          accountName: 'Facturas por pagar',
          debitAmount: 0,
          creditAmount: totalInventoryCostPen,
        },
      ],
    });
  }
}
