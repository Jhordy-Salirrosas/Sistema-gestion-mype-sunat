import { Injectable } from '@nestjs/common';
import type {
  ISireParserPort,
  SireParseFailure,
  SireParseResult,
} from '../../domain/ports/sireParserPort';

// TODO: Reemplazar este esquema provisional por el layout oficial del Anexo 2 por libro.
const COLUMN = {
  emitterRuc: 0,
  documentType: 1,
  series: 2,
  correlative: 3,
  issueDate: 4,
  taxableBase: 5,
  igvAmount: 6,
  totalAmount: 7,
  carSunat: 8,
} as const;

@Injectable()
export class SireTxtParserAdapter implements ISireParserPort {
  parse(buffer: Uint8Array): SireParseResult {
    let text: string;
    try {
      text = new TextDecoder('utf-8', { fatal: true }).decode(
        Buffer.from(buffer),
      );
    } catch {
      throw new Error('El archivo TXT debe estar codificado en UTF-8.');
    }
    text = text.replace(/^\uFEFF/, '');

    const records: SireParseResult['records'] = [];
    const rejected: SireParseFailure[] = [];
    text.split(/\r?\n/).forEach((rawLine, index) => {
      if (!rawLine.trim()) return;
      const columns = rawLine.replace(/\r$/, '').split('|');
      if (columns.at(-1) === '') columns.pop();
      const record = this.parseLine(columns, index + 1);
      if ('reason' in record) rejected.push(record);
      else records.push(record);
    });
    return { records, rejected };
  }

  private parseLine(
    columns: string[],
    line: number,
  ): SireParseResult['records'][number] | SireParseFailure {
    if (columns.length < 9) {
      return { line, reason: 'La fila no contiene las 9 columnas mínimas.' };
    }
    const values = columns.map((column) => column.trim());
    const emitterRuc = values[COLUMN.emitterRuc];
    const documentType = values[COLUMN.documentType];
    const series = values[COLUMN.series];
    const correlative = values[COLUMN.correlative];
    const issueDate = this.parseDate(values[COLUMN.issueDate]);
    const taxableBase = this.parseAmount(values[COLUMN.taxableBase]);
    const igvAmount = this.parseAmount(values[COLUMN.igvAmount]);
    const totalAmount = this.parseAmount(values[COLUMN.totalAmount]);
    const carSunat = values[COLUMN.carSunat];
    if (
      !/^\d{11}$/.test(emitterRuc) ||
      !documentType ||
      !series ||
      !correlative
    ) {
      return { line, reason: 'Identificación del comprobante inválida.' };
    }
    if (
      !issueDate ||
      taxableBase === undefined ||
      igvAmount === undefined ||
      totalAmount === undefined ||
      !carSunat
    ) {
      return { line, reason: 'Fecha, monto o CAR inválido.' };
    }
    return {
      emitterRuc,
      documentType,
      series,
      correlative,
      issueDate,
      taxableBase,
      igvAmount,
      totalAmount,
      carSunat,
    };
  }

  private parseAmount(value: string): number | undefined {
    if (!/^\d+(?:\.\d{1,2})?$/.test(value)) return undefined;
    const amount = Number(value);
    return Number.isFinite(amount) ? amount : undefined;
  }

  private parseDate(value: string): Date | undefined {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
    const parsed = new Date(`${value}T00:00:00.000Z`);
    return Number.isNaN(parsed.getTime()) ||
      parsed.toISOString().slice(0, 10) !== value
      ? undefined
      : parsed;
  }
}
