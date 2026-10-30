import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter } from 'events';
import {
  ICustomsEventPublisherPort,
} from '../../domain/ports/customsEventPublisherPort';
import { GoodsReceiptConfirmedEvent } from '../../domain/events/GoodsReceiptConfirmedEvent';
import { ImportCostApprovedEvent } from '../../domain/events/ImportCostApprovedEvent';

@Injectable()
export class NestCustomsEventPublisherAdapter
  extends EventEmitter
  implements ICustomsEventPublisherPort
{
  private readonly logger = new Logger(NestCustomsEventPublisherAdapter.name);

  async publishReceiptConfirmed(event: GoodsReceiptConfirmedEvent): Promise<void> {
    this.logger.log(
      `[DOMAIN_EVENT] Publicando ${event.eventName} para Empresa: ${event.payload.companyId}, Acta: ${event.payload.receiptNumber}`,
    );
    this.emit(event.eventName, event);
  }

  async publishCostApproved(event: ImportCostApprovedEvent): Promise<void> {
    this.logger.log(
      `[DOMAIN_EVENT] Publicando ${event.eventName} para Empresa: ${event.payload.companyId}, Expediente: ${event.payload.shipmentId}, Total Cost: S/ ${event.payload.totalInventoryCostPen}`,
    );
    this.emit(event.eventName, event);
  }
}

