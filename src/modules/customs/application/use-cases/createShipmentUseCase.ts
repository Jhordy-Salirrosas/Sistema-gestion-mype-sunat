import { ConflictException, Inject, Injectable } from '@nestjs/common';
import { CreateShipmentDto } from '../dto/createShipmentDto';
import {
  CUSTOMS_SHIPMENT_REPOSITORY_PORT,
  type ICustomsShipmentRepositoryPort,
} from '../../domain/ports/customsShipmentRepositoryPort';

@Injectable()
export class CreateShipmentUseCase {
  constructor(
    @Inject(CUSTOMS_SHIPMENT_REPOSITORY_PORT)
    private readonly shipmentRepository: ICustomsShipmentRepositoryPort,
  ) {}

  async execute(dto: CreateShipmentDto, companyId: string): Promise<any> {
    // 1. Validar unicidad del número de expediente dentro de la empresa
    const existing = await this.shipmentRepository.findShipmentByNumber(
      dto.shipment_number,
      companyId,
    );

    if (existing) {
      throw new ConflictException(
        `El expediente de importación con número '${dto.shipment_number}' ya existe en esta empresa`,
      );
    }

    // 2. Persistir nuevo expediente
    const shipment = await this.shipmentRepository.createShipment({
      companyId,
      shipmentNumber: dto.shipment_number,
      supplierId: dto.supplier_id,
      customsBrokerId: dto.customs_broker_id,
      incoterm: dto.incoterm ?? 'FOB',
      currencyCode: dto.currency_code ?? 'USD',
      transportMode: dto.transport_mode ?? 'MARITIMO',
      originCountryCode: dto.origin_country_code ?? 'CN',
      destinationCustoms: dto.destination_customs ?? '118',
      etdDate: dto.etd_date ? new Date(dto.etd_date) : null,
      etaDate: dto.eta_date ? new Date(dto.eta_date) : null,
      orderReference: dto.order_reference,
    });

    // 3. Registrar hito inicial en la bitácora de eventos
    await this.shipmentRepository.addEvent({
      shipmentId: shipment.id,
      eventType: 'CREACION_EXPEDIENTE',
      eventTimestamp: new Date(),
      registeredBy: 'SISTEMA_ERP',
      referenceCode: shipment.shipment_number,
      eventValue: `Incoterm: ${shipment.incoterm} | Origen: ${shipment.origin_country_code}`,
    });

    return shipment;
  }
}
