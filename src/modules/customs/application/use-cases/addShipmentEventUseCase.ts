import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { AddEventDto } from '../dto/addEventDto';
import {
  CUSTOMS_SHIPMENT_REPOSITORY_PORT,
  type ICustomsShipmentRepositoryPort,
} from '../../domain/ports/customsShipmentRepositoryPort';
import { ShipmentStatus } from '../../domain/enums/shipmentStatus.enum';

@Injectable()
export class AddShipmentEventUseCase {
  constructor(
    @Inject(CUSTOMS_SHIPMENT_REPOSITORY_PORT)
    private readonly shipmentRepository: ICustomsShipmentRepositoryPort,
  ) {}

  async execute(shipmentId: string, dto: AddEventDto, companyId: string): Promise<any> {
    const shipment = await this.shipmentRepository.findShipmentById(shipmentId, companyId);
    if (!shipment) {
      throw new NotFoundException(`Expediente con ID '${shipmentId}' no encontrado`);
    }

    const event = await this.shipmentRepository.addEvent({
      shipmentId,
      eventType: dto.event_type,
      eventTimestamp: new Date(dto.event_timestamp),
      eventValue: dto.event_value,
      referenceCode: dto.reference_code,
      registeredBy: dto.registered_by,
    });

    // Sincronizar estado del expediente según el tipo de hito aduanero
    if (dto.event_type === 'ZARPE' && shipment.status === ShipmentStatus.BORRADOR) {
      await this.shipmentRepository.updateShipmentStatus(
        shipmentId,
        companyId,
        ShipmentStatus.EN_TRANSITO,
      );
    } else if (dto.event_type === 'ARRIBO') {
      await this.shipmentRepository.updateShipmentStatus(
        shipmentId,
        companyId,
        ShipmentStatus.ARRIBADO,
      );
    } else if (dto.event_type === 'NUMERACION') {
      await this.shipmentRepository.updateShipmentStatus(
        shipmentId,
        companyId,
        ShipmentStatus.EN_DESPACHO,
      );
    } else if (dto.event_type === 'LEVANTE') {
      await this.shipmentRepository.updateShipmentStatus(
        shipmentId,
        companyId,
        ShipmentStatus.CON_LEVANTE,
      );
    }

    return event;
  }
}
