import { Inject, Injectable } from '@nestjs/common';
import {
  CUSTOMS_SHIPMENT_REPOSITORY_PORT,
  type ICustomsShipmentRepositoryPort,
} from '../../domain/ports/customsShipmentRepositoryPort';
import { ShipmentStatus } from '../../domain/enums/shipmentStatus.enum';

export interface ListShipmentsQuery {
  status?: string;
  search?: string;
  page?: number;
  limit?: number;
}

@Injectable()
export class ListShipmentsUseCase {
  constructor(
    @Inject(CUSTOMS_SHIPMENT_REPOSITORY_PORT)
    private readonly shipmentRepository: ICustomsShipmentRepositoryPort,
  ) {}

  async execute(companyId: string, query?: ListShipmentsQuery): Promise<any> {
    const page = query?.page && query.page > 0 ? Number(query.page) : 1;
    const limit = query?.limit && query.limit > 0 ? Number(query.limit) : 10;

    let statusFilter: ShipmentStatus | undefined;
    if (query?.status && Object.values(ShipmentStatus).includes(query.status as ShipmentStatus)) {
      statusFilter = query.status as ShipmentStatus;
    }

    const result = await this.shipmentRepository.listShipments({
      companyId,
      status: statusFilter,
      search: query?.search,
      page,
      limit,
    });

    return {
      data: result.data,
      total: result.total,
      page,
      limit,
      totalPages: Math.ceil(result.total / limit),
    };
  }
}
