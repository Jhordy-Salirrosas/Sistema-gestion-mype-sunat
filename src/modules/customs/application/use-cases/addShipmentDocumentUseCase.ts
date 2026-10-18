import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { AddDocumentDto } from '../dto/addDocumentDto';
import {
  CUSTOMS_SHIPMENT_REPOSITORY_PORT,
  type ICustomsShipmentRepositoryPort,
} from '../../domain/ports/customsShipmentRepositoryPort';

@Injectable()
export class AddShipmentDocumentUseCase {
  constructor(
    @Inject(CUSTOMS_SHIPMENT_REPOSITORY_PORT)
    private readonly shipmentRepository: ICustomsShipmentRepositoryPort,
  ) {}

  async execute(shipmentId: string, dto: AddDocumentDto, companyId: string): Promise<any> {
    const shipment = await this.shipmentRepository.findShipmentById(shipmentId, companyId);
    if (!shipment) {
      throw new NotFoundException(`Expediente con ID '${shipmentId}' no encontrado`);
    }

    const document = await this.shipmentRepository.addDocument({
      shipmentId,
      documentType: dto.document_type,
      documentNumber: dto.document_number,
      issueDate: new Date(dto.issue_date),
      issuerName: dto.issuer_name,
      storageUrl: dto.storage_url,
      vuceDrNumber: dto.vuce_dr_number,
    });

    await this.shipmentRepository.addEvent({
      shipmentId,
      eventType: 'DOCUMENTO_ADJUNTO',
      eventTimestamp: new Date(),
      registeredBy: dto.issuer_name ?? 'USUARIO',
      referenceCode: dto.document_number,
      eventValue: `Tipo: ${dto.document_type} ${dto.vuce_dr_number ? `| VUCE DR: ${dto.vuce_dr_number}` : ''}`,
    });

    return document;
  }
}
