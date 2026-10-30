import { Injectable } from '@nestjs/common';
import { PleStructureValidatorService } from './pleStructureValidatorService';

export interface Ple13_1MovementInput {
  periodYearMonth: string; // YYYYMM00
  cuo: string;
  entryNumber: string;
  establishmentCode: string;
  catalogCode?: string;
  typeCode: string;
  sku: string;
  sunatCode?: string;
  documentDate: Date;
  documentTypeCode?: string | null;
  documentSerial?: string | null;
  documentNumber?: string | null;
  operationTypeCode: string;
  description: string;
  unitCode: string;
  valuationMethodCode?: string; // 2 = Promedio ponderado móvil
  direction: 'ENTRADA' | 'SALIDA';
  quantity: number;
  unitCost: number;
  totalCost: number;
  resultingStock: number;
  resultingAverageCost: number;
  resultingTotalValue: number;
  statusIndicator?: string; // 1 = Registrado en el periodo
}

@Injectable()
export class Ple13_1FlatFileWriterAdapter {
  constructor(private readonly validator: PleStructureValidatorService) {}

  public generate(
    ruc: string,
    year: number,
    movements: Ple13_1MovementInput[],
  ): { fileName: string; content: string; recordsCount: number } {
    const hasInformation = movements.length > 0;
    const fileName = this.validator.generateOfficialFileName(ruc, year, '00', '130100', hasInformation);

    if (!hasInformation) {
      return { fileName, content: '', recordsCount: 0 };
    }

    const lines: string[] = [];

    for (const m of movements) {
      const formatDate = (d: Date) =>
        `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;

      const isEntry = m.direction === 'ENTRADA';
      const inQty = isEntry ? m.quantity.toFixed(4) : '0.0000';
      const inUnitCost = isEntry ? m.unitCost.toFixed(4) : '0.0000';
      const inTotalCost = isEntry ? m.totalCost.toFixed(2) : '0.00';

      const outQty = !isEntry ? m.quantity.toFixed(4) : '0.0000';
      const outUnitCost = !isEntry ? m.unitCost.toFixed(4) : '0.0000';
      const outTotalCost = !isEntry ? m.totalCost.toFixed(2) : '0.00';

      const rowFields = [
        m.periodYearMonth,
        this.validator.sanitizeField(m.cuo, 40),
        this.validator.sanitizeField(m.entryNumber, 10),
        this.validator.sanitizeField(m.establishmentCode || '0000', 4),
        m.catalogCode || '9',
        this.validator.sanitizeField(m.typeCode, 2),
        this.validator.sanitizeField(m.sku, 24),
        this.validator.sanitizeField(m.sunatCode || '', 24),
        formatDate(m.documentDate),
        this.validator.sanitizeField(m.documentTypeCode || '00', 2),
        this.validator.sanitizeField(m.documentSerial || '-', 20),
        this.validator.sanitizeField(m.documentNumber || '-', 20),
        this.validator.sanitizeField(m.operationTypeCode, 2),
        this.validator.sanitizeField(m.description, 80),
        this.validator.sanitizeField(m.unitCode, 3),
        m.valuationMethodCode || '2', // 2 = Promedio ponderado
        inQty,
        inUnitCost,
        inTotalCost,
        outQty,
        outUnitCost,
        outTotalCost,
        m.resultingStock.toFixed(4),
        m.resultingAverageCost.toFixed(4),
        m.resultingTotalValue.toFixed(2),
        m.statusIndicator || '1',
        '', // Campo 27 libre
      ];

      lines.push(`${rowFields.join('|')}|`);
    }

    const content = lines.join('\r\n') + '\r\n';
    return { fileName, content, recordsCount: lines.length };
  }
}

