import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PaySettlementDto } from '../dto/paySettlementDto';
import {
  CUSTOMS_SETTLEMENT_REPOSITORY_PORT,
  type ICustomsSettlementRepositoryPort,
} from '../../domain/ports/customsSettlementRepositoryPort';
import {
  CUSTOMS_SHIPMENT_REPOSITORY_PORT,
  type ICustomsShipmentRepositoryPort,
} from '../../domain/ports/customsShipmentRepositoryPort';
import { SettlementStatus } from '../../domain/enums/settlementStatus.enum';
import { ShipmentStatus } from '../../domain/enums/shipmentStatus.enum';

@Injectable()
export class PaySettlementUseCase {
  constructor(
    @Inject(CUSTOMS_SETTLEMENT_REPOSITORY_PORT)
    private readonly settlementRepository: ICustomsSettlementRepositoryPort,
    @Inject(CUSTOMS_SHIPMENT_REPOSITORY_PORT)
    private readonly shipmentRepository: ICustomsShipmentRepositoryPort,
  ) {}

  async execute(settlementId: string, dto: PaySettlementDto, companyId?: string): Promise<any> {
    const settlement = await this.settlementRepository.findSettlementById(settlementId, companyId);

    if (!settlement) {
      throw new NotFoundException(`Liquidación de cobranza con ID '${settlementId}' no encontrada`);
    }

    if (settlement.status === SettlementStatus.PAGADA) {
      throw new BadRequestException(
        `La liquidación ${settlement.cda_number || settlement.id} ya se encuentra registrada como PAGADA`,
      );
    }

    // 1. Asentar pago bancario y actualizar estado a PAGADA
    const paidAt = dto.paid_at ? new Date(dto.paid_at) : new Date();
    const updatedSettlement = await this.settlementRepository.registerSettlementPayment({
      settlementId,
      bankCode: dto.bank_code,
      bankOperationNumber: dto.bank_operation_number,
      paidAt,
      voucherStorageUrl: dto.voucher_storage_url,
    });

    // 2. Si la DAM está asociada a un expediente, auditar evento de pago
    const shipmentId = settlement.declaration?.shipment_id || settlement.declaration?.shipment?.id;

    if (shipmentId) {
      await this.shipmentRepository.addEvent({
        shipmentId,
        eventType: 'PAGO_TRIBUTOS',
        eventTimestamp: paidAt,
        registeredBy: 'TESORERIA',
        referenceCode: settlement.cda_number ?? settlement.settlement_number,
        eventValue: `Banco: ${dto.bank_code} | OP: ${dto.bank_operation_number} | Monto: S/ ${Number(settlement.amount_pen).toFixed(2)}`,
      });

      // 3. Verificar si todas las liquidaciones de la DAM están pagadas para autorizar levante (Canal Verde)
      const allSettlements = await this.settlementRepository.findSettlementsByDeclarationId(
        settlement.declaration_id,
        companyId,
      );
      const allPaid = allSettlements.every((s) => s.status === SettlementStatus.PAGADA);

      if (allPaid && settlement.declaration?.channel === 'VERDE') {
        const targetCompanyId = companyId || settlement.declaration?.company_id;
        if (targetCompanyId) {
          await this.shipmentRepository.updateShipmentStatus(
            shipmentId,
            targetCompanyId,
            ShipmentStatus.CON_LEVANTE,
          );
        }
      }
    }

    return updatedSettlement;
  }
}
