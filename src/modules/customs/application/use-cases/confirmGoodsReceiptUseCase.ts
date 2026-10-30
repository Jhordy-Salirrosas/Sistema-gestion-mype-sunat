import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  GOODS_RECEIPT_REPOSITORY_PORT,
  type IGoodsReceiptRepositoryPort,
} from '../../domain/ports/goodsReceiptRepositoryPort';
import {
  CUSTOMS_EVENT_PUBLISHER_PORT,
  type ICustomsEventPublisherPort,
} from '../../domain/ports/customsEventPublisherPort';
import {
  CUSTOMS_REPOSITORY_PORT,
  type ICustomsRepositoryPort,
} from '../../domain/ports/customsRepositoryPort';
import { ConfirmGoodsReceiptDto } from '../dto/confirmGoodsReceiptDto';
import {
  GoodsReceiptEntity,
  GoodsReceiptItemEntity,
} from '../../domain/entities/goodsReceiptEntity';
import { GoodsReceiptConfirmedEvent } from '../../domain/events/GoodsReceiptConfirmedEvent';

@Injectable()
export class ConfirmGoodsReceiptUseCase {
  constructor(
    @Inject(GOODS_RECEIPT_REPOSITORY_PORT)
    private readonly goodsReceiptRepository: IGoodsReceiptRepositoryPort,
    @Inject(CUSTOMS_EVENT_PUBLISHER_PORT)
    private readonly eventPublisher: ICustomsEventPublisherPort,
    @Inject(CUSTOMS_REPOSITORY_PORT)
    private readonly customsRepository: ICustomsRepositoryPort,
  ) {}

  async execute(dto: ConfirmGoodsReceiptDto, companyId: string): Promise<GoodsReceiptEntity> {
    // 1. Validar que la DAM exista y pertenezca a la empresa
    const declaration = await this.customsRepository.findDeclarationById(
      dto.declarationId,
      companyId,
    );
    if (!declaration) {
      throw new NotFoundException(
        `Declaración aduanera (DAM) con ID '${dto.declarationId}' no encontrada para esta empresa.`,
      );
    }

    // 2. Construir ítems de recepción física con cálculo de discrepancias
    const items = dto.items.map(
      (it) =>
        new GoodsReceiptItemEntity({
          customsItemId: it.customsItemId,
          productCode: it.productCode,
          commercialDescription: it.commercialDescription,
          declaredQuantity: it.declaredQuantity,
          receivedQuantity: it.receivedQuantity,
          damagedQuantity: it.damagedQuantity ?? 0,
          discrepancyReason: it.discrepancyReason,
          unitCode: it.unitCode ?? 'NIU',
          destinationType: it.destinationType ?? 'MERCADERIA',
        }),
    );

    // 3. Crear entidad de recepción física
    const receipt = new GoodsReceiptEntity({
      companyId,
      receiptNumber: dto.receiptNumber,
      declarationId: dto.declarationId,
      shipmentId: dto.shipmentId ?? declaration.shipmentId,
      warehouseCode: dto.warehouseCode ?? 'ALM-01',
      receptionType: dto.receptionType ?? 'TOTAL',
      responsibleName: dto.responsibleName,
      responsibleDni: dto.responsibleDni,
      containerNumber: dto.containerNumber,
      sealNumber: dto.sealNumber,
      observations: dto.observations,
      items,
    });

    // 4. Persistir en base de datos
    const savedReceipt = await this.goodsReceiptRepository.save(receipt);

    // 5. Publicar evento de dominio asíncrono
    await this.eventPublisher.publishReceiptConfirmed(
      new GoodsReceiptConfirmedEvent({
        companyId,
        goodsReceiptId: savedReceipt.id ?? dto.receiptNumber,
        receiptNumber: savedReceipt.receiptNumber,
        declarationId: savedReceipt.declarationId,
        shipmentId: savedReceipt.shipmentId,
        warehouseCode: savedReceipt.warehouseCode,
        receptionDate: savedReceipt.receptionDate,
        status: savedReceipt.status,
        items: savedReceipt.items.map((it) => ({
          productCode: it.productCode,
          commercialDescription: it.commercialDescription,
          declaredQuantity: it.declaredQuantity,
          receivedQuantity: it.receivedQuantity,
          damagedQuantity: it.damagedQuantity,
          unitCode: it.unitCode,
          destinationType: it.destinationType,
        })),
      }),
    );

    return savedReceipt;
  }
}

