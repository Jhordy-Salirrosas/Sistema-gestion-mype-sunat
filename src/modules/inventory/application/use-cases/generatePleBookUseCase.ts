import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import {
  INVENTORY_MOVEMENT_REPOSITORY_PORT,
  type IInventoryMovementRepositoryPort,
} from '../../domain/ports/IInventoryMovementRepositoryPort';
import { Ple13_1FlatFileWriterAdapter, Ple13_1MovementInput } from '../../infrastructure/adapters/ple13_1FlatFileWriterAdapter';
import { Ple12_1FlatFileWriterAdapter, Ple12_1MovementInput } from '../../infrastructure/adapters/ple12_1FlatFileWriterAdapter';
import { ExportPleBookDto } from '../dto/exportPleBookDto';

@Injectable()
export class GeneratePleBookUseCase {
  constructor(
    @Inject(INVENTORY_MOVEMENT_REPOSITORY_PORT)
    private readonly movementRepository: IInventoryMovementRepositoryPort,
    private readonly ple13Adapter: Ple13_1FlatFileWriterAdapter,
    private readonly ple12Adapter: Ple12_1FlatFileWriterAdapter,
  ) {}

  async execute(dto: ExportPleBookDto, companyId: string, companyRuc: string) {
    if (!companyId) throw new BadRequestException('company_id requerido.');
    if (!companyRuc) throw new BadRequestException('RUC de la empresa requerido.');

    const startDate = new Date(`${dto.fiscal_year}-01-01T00:00:00Z`);
    const endDate = new Date(`${dto.fiscal_year}-12-31T23:59:59Z`);

    const movements = await this.movementRepository.findAllByCompany(
      companyId,
      startDate,
      endDate,
    );

    const monthStr = dto.month || '00';
    const periodStr = `${dto.fiscal_year}${monthStr}00`;

    if (dto.book_type === '13.1') {
      const inputs: Ple13_1MovementInput[] = movements.map((m, idx) => ({
        periodYearMonth: periodStr,
        cuo: `M-${dto.fiscal_year}-${idx + 1}`,
        entryNumber: `M${idx + 1}`,
        establishmentCode: '0000',
        catalogCode: '9',
        typeCode: '01',
        sku: m.sku,
        documentDate: m.movementDate,
        documentTypeCode: m.documentTypeCode || '00',
        documentSerial: m.documentSerial || '-',
        documentNumber: m.documentNumber || '-',
        operationTypeCode: m.operationTypeCode,
        description: m.productDescription,
        unitCode: 'NIU',
        valuationMethodCode: '2', // Promedio ponderado móvil
        direction: m.direction,
        quantity: m.quantity,
        unitCost: m.unitCost,
        totalCost: m.totalCost,
        resultingStock: m.resultingStock,
        resultingAverageCost: m.resultingUnitCost,
        resultingTotalValue: m.resultingTotalValue,
        statusIndicator: '1',
      }));

      return this.ple13Adapter.generate(companyRuc, dto.fiscal_year, inputs);
    }

    // 12.1
    const inputs12: Ple12_1MovementInput[] = movements.map((m, idx) => ({
      periodYearMonth: periodStr,
      cuo: `M-${dto.fiscal_year}-${idx + 1}`,
      entryNumber: `M${idx + 1}`,
      establishmentCode: '0000',
      catalogCode: '9',
      typeCode: '01',
      sku: m.sku,
      documentDate: m.movementDate,
      documentTypeCode: m.documentTypeCode || '00',
      documentSerial: m.documentSerial || '-',
      documentNumber: m.documentNumber || '-',
      operationTypeCode: m.operationTypeCode,
      description: m.productDescription,
      unitCode: 'NIU',
      direction: m.direction,
      quantity: m.quantity,
      resultingStock: m.resultingStock,
      statusIndicator: '1',
    }));

    return this.ple12Adapter.generate(companyRuc, dto.fiscal_year, inputs12);
  }
}

