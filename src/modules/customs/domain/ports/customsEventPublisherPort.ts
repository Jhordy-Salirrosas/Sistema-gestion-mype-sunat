import { GoodsReceiptConfirmedEvent } from '../events/GoodsReceiptConfirmedEvent';
import { ImportCostApprovedEvent } from '../events/ImportCostApprovedEvent';

export const CUSTOMS_EVENT_PUBLISHER_PORT = Symbol('CUSTOMS_EVENT_PUBLISHER_PORT');

export interface ICustomsEventPublisherPort {
  publishReceiptConfirmed(event: GoodsReceiptConfirmedEvent): Promise<void>;
  publishCostApproved(event: ImportCostApprovedEvent): Promise<void>;
}

