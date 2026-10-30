import { Injectable, Logger, OnModuleInit, Optional, Inject } from '@nestjs/common';
import {
  CUSTOMS_EVENT_PUBLISHER_PORT,
  type ICustomsEventPublisherPort,
} from '../../../customs/domain/ports/customsEventPublisherPort';
import { ProcessImportCostOrderUseCase } from '../use-cases/processImportCostOrderUseCase';
import { ImportCostApprovedEvent } from '../../../customs/domain/events/ImportCostApprovedEvent';

@Injectable()
export class ImportCostApprovedEventListener implements OnModuleInit {
  private readonly logger = new Logger(ImportCostApprovedEventListener.name);

  constructor(
    private readonly processImportCostOrderUseCase: ProcessImportCostOrderUseCase,
    @Optional()
    @Inject(CUSTOMS_EVENT_PUBLISHER_PORT)
    private readonly customsEventPublisher?: ICustomsEventPublisherPort,
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
}
