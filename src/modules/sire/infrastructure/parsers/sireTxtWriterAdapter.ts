import { Injectable } from '@nestjs/common';
import type {
  ISireExporterPort,
  SireExportFile,
  SireExportInput,
} from '../../domain/ports/sireExporterPort';

@Injectable()
export class SireTxtWriterAdapter implements ISireExporterPort {
  export(input: SireExportInput): SireExportFile {
    const header = [
      'RUC_EMISOR',
      'TIPO_COMPROBANTE',
      'SERIE',
      'CORRELATIVO',
      'ESCENARIO',
      'TOTAL_LOCAL',
      'TOTAL_SIRE',
      'DIFERENCIA',
    ];
    const rows = input.discrepancies.map((item) => [
      item.emitterRuc,
      item.documentType,
      item.series,
      item.correlative,
      item.discrepancyType,
      this.formatAmount(item.localTotalAmount),
      this.formatAmount(item.sireTotalAmount),
      this.formatAmount(item.amountDifference),
    ]);
    const content = [header, ...rows]
      .map((row) => row.map((cell) => this.safeCell(cell)).join('|'))
      .join('\r\n');

    // TODO: Aplicar nombre, columnas y orden oficiales del Anexo 3 por libro.
    return {
      fileName: `sire-${input.bookType}-${input.period}-BORRADOR.txt`,
      content: Buffer.from(`${content}\r\n`, 'utf8'),
    };
  }

  private formatAmount(amount: number | undefined): string {
    return amount === undefined ? '' : amount.toFixed(2);
  }

  private safeCell(value: string): string {
    if (/[|\r\n]/.test(value)) {
      throw new Error('El registro contiene caracteres incompatibles con TXT.');
    }
    return value;
  }
}
