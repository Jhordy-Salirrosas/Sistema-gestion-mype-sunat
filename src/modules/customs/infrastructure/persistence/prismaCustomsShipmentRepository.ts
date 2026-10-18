import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../database/prismaService';
import {
  AddDocumentData,
  AddEventData,
  CreateShipmentData,
  ICustomsShipmentRepositoryPort,
  ShipmentFilterOptions,
} from '../../domain/ports/customsShipmentRepositoryPort';
import { ShipmentStatus } from '../../domain/enums/shipmentStatus.enum';

@Injectable()
export class PrismaCustomsShipmentRepository implements ICustomsShipmentRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async createShipment(data: CreateShipmentData): Promise<any> {
    return this.prisma.customsShipment.create({
      data: {
        company_id: data.companyId,
        shipment_number: data.shipmentNumber,
        supplier_id: data.supplierId,
        customs_broker_id: data.customsBrokerId,
        incoterm: data.incoterm ?? 'FOB',
        currency_code: data.currencyCode ?? 'USD',
        transport_mode: data.transportMode ?? 'MARITIMO',
        origin_country_code: data.originCountryCode ?? 'CN',
        destination_customs: data.destinationCustoms ?? '118',
        etd_date: data.etdDate,
        eta_date: data.etaDate,
        order_reference: data.orderReference,
        status: ShipmentStatus.BORRADOR as any,
      },
      include: {
        supplier: true,
        customs_broker: true,
      },
    });
  }

  async updateShipmentStatus(
    id: string,
    companyId: string,
    status: ShipmentStatus,
  ): Promise<any> {
    return this.prisma.customsShipment.update({
      where: { id },
      data: { status: status as any },
    });
  }

  async findShipmentById(id: string, companyId: string): Promise<any | null> {
    return this.prisma.customsShipment.findFirst({
      where: { id, company_id: companyId },
      include: {
        supplier: true,
        customs_broker: true,
        documents: true,
        events: {
          orderBy: { event_timestamp: 'desc' },
        },
        declarations: {
          include: {
            items: true,
            settlements: true,
          },
        },
        local_expenses: true,
        landed_cost_sheet: true,
      },
    });
  }

  async findShipmentByNumber(
    shipmentNumber: string,
    companyId: string,
  ): Promise<any | null> {
    return this.prisma.customsShipment.findFirst({
      where: {
        company_id: companyId,
        shipment_number: shipmentNumber,
      },
      include: {
        supplier: true,
        customs_broker: true,
        documents: true,
        events: true,
      },
    });
  }

  async listShipments(
    options: ShipmentFilterOptions,
  ): Promise<{ data: any[]; total: number }> {
    const { companyId, status, search, page = 1, limit = 10 } = options;
    const skip = (page - 1) * limit;

    const where: any = { company_id: companyId };
    if (status) {
      where.status = status;
    }
    if (search) {
      where.OR = [
        { shipment_number: { contains: search, mode: 'insensitive' } },
        { order_reference: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.customsShipment.findMany({
        where,
        skip,
        take: limit,
        orderBy: { created_at: 'desc' },
        include: {
          supplier: true,
          customs_broker: true,
          _count: {
            select: {
              documents: true,
              declarations: true,
              events: true,
            },
          },
        },
      }),
      this.prisma.customsShipment.count({ where }),
    ]);

    return { data, total };
  }

  async addDocument(data: AddDocumentData): Promise<any> {
    return this.prisma.customsDocument.create({
      data: {
        shipment_id: data.shipmentId,
        document_type: data.documentType,
        document_number: data.documentNumber,
        issue_date: data.issueDate,
        issuer_name: data.issuerName,
        storage_url: data.storageUrl,
        vuce_dr_number: data.vuceDrNumber,
      },
    });
  }

  async addEvent(data: AddEventData): Promise<any> {
    return this.prisma.customsEvent.create({
      data: {
        shipment_id: data.shipmentId,
        event_type: data.eventType,
        event_timestamp: data.eventTimestamp,
        event_value: data.eventValue,
        reference_code: data.referenceCode,
        registered_by: data.registeredBy,
      },
    });
  }

  async getShipmentEvents(shipmentId: string): Promise<any[]> {
    return this.prisma.customsEvent.findMany({
      where: { shipment_id: shipmentId },
      orderBy: { event_timestamp: 'desc' },
    });
  }

  async getShipmentDocuments(shipmentId: string): Promise<any[]> {
    return this.prisma.customsDocument.findMany({
      where: { shipment_id: shipmentId },
      orderBy: { issue_date: 'desc' },
    });
  }
}
