import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  CUSTOMS_SHIPMENT_REPOSITORY_PORT,
  type ICustomsShipmentRepositoryPort,
} from '../../domain/ports/customsShipmentRepositoryPort';

@Injectable()
export class GetShipmentByIdUseCase {
  constructor(
    @Inject(CUSTOMS_SHIPMENT_REPOSITORY_PORT)
    private readonly shipmentRepository: ICustomsShipmentRepositoryPort,
  ) {}

  async execute(id: string, companyId: string): Promise<any> {
    const shipment = await this.shipmentRepository.findShipmentById(id, companyId);

    if (!shipment) {
      throw new NotFoundException(
        `Expediente de importación con ID '${id}' no encontrado o no pertenece a su empresa`,
      );
    }

    return shipment;
  }
}
