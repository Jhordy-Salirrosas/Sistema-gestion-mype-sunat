import { BadRequestException, Injectable } from '@nestjs/common';
import * as XLSX from 'xlsx';
import type {
  SireParseFailure,
  SireParseResult,
} from '../../domain/ports/sireParserPort';
import type { ParsedSireProposal } from '../../domain/ports/sireParserPort';

type Column = keyof ParsedSireProposal;

const aliases: Record<Column, string[]> = {
  emitterRuc: ['ruc', 'rucemisor', 'rucdelproveedor', 'rucemisorproveedor'],
  documentType: ['tipodocumento', 'tipocomprobante', 'tipodoc'],
  series: ['serie', 'seriedelcomprobante'],
  correlative: ['correlativo', 'numero', 'numerocomprobante', 'nrocomprobante'],
  issueDate: ['fechaemision', 'fechaemisiondocumento', 'fecha'],
  taxableBase: ['baseimponible', 'baseimponiblegravada', 'valorventa'],
  igvAmount: ['igv', 'igvtotal', 'impuestoigv'],
  totalAmount: ['total', 'importetotal', 'totalcomprobante'],
  carSunat: ['car', 'carsunat', 'idcar'],
};

const requiredColumns = Object.keys(aliases) as Column[];

const normalizeHeader = (value: unknown) =>
  String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');

@Injectable()
export class SireReportFileParser {
  parse(buffer: Uint8Array): SireParseResult {
    let rows: unknown[][];
    try {
      const source = Buffer.from(buffer);
      const isXlsx = source.subarray(0, 2).toString('ascii') === 'PK';
      const workbook = XLSX.read(isXlsx ? source : source.toString('utf8'), {
        type: isXlsx ? 'buffer' : 'string',
        cellDates: true,
        raw: false,
      });
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      if (!firstSheet) throw new Error('El archivo no contiene hojas.');
      rows = XLSX.utils.sheet_to_json<unknown[]>(firstSheet, {
        header: 1,
        defval: '',
        raw: false,
      });
    } catch (error) {
      throw new BadRequestException(
        `No se pudo leer el archivo: ${error instanceof Error ? error.message : 'formato inválido'}`,
      );
    }

    const header = rows.shift();
    if (!header) throw new BadRequestException('El archivo no contiene encabezado.');
    const normalizedHeaders = header.map(normalizeHeader);
    const indexes = new Map<Column, number>();
    for (const column of requiredColumns) {
      const index = normalizedHeaders.findIndex((value) =>
        aliases[column].includes(value),
      );
      if (index >= 0) indexes.set(column, index);
    }
    const missing = requiredColumns.filter((column) => !indexes.has(column));
    if (missing.length) {
      throw new BadRequestException(
        `Faltan columnas obligatorias: ${missing.join(', ')} (encabezado, fila 1).`,
      );
    }

    const records: SireParseResult['records'] = [];
    const rejected: SireParseFailure[] = [];
    rows.forEach((row, index) => {
      if (row.every((value) => String(value ?? '').trim() === '')) return;
      const line = index + 2;
      const values = Object.fromEntries(
        requiredColumns.map((column) => [column, String(row[indexes.get(column)!] ?? '').trim()]),
      ) as Record<Column, string>;
      const record = this.parseRow(values, line);
      if ('reason' in record) rejected.push(record);
      else records.push(record);
    });
    return { records, rejected };
  }

  private parseRow(
    values: Record<Column, string>,
    line: number,
  ): ParsedSireProposal | SireParseFailure {
    const issueDate = this.parseDate(values.issueDate);
    const taxableBase = this.parseAmount(values.taxableBase);
    const igvAmount = this.parseAmount(values.igvAmount);
    const totalAmount = this.parseAmount(values.totalAmount);
    if (
      !/^\d{11}$/.test(values.emitterRuc) ||
      !values.documentType ||
      !values.series ||
      !values.correlative
    ) {
      return { line, reason: 'RUC, tipo, serie o correlativo inválido.' };
    }
    if (
      !issueDate ||
      taxableBase === undefined ||
      igvAmount === undefined ||
      totalAmount === undefined ||
      !values.carSunat
    ) {
      return { line, reason: 'Fecha, monto o CAR inválido.' };
    }
    return {
      emitterRuc: values.emitterRuc,
      documentType: values.documentType,
      series: values.series,
      correlative: values.correlative,
      issueDate,
      taxableBase,
      igvAmount,
      totalAmount,
      carSunat: values.carSunat,
    };
  }

  private parseAmount(value: string): number | undefined {
    const normalized = value.replace(/,/g, '');
    if (!/^-?\d+(?:\.\d{1,2})?$/.test(normalized)) return undefined;
    const amount = Number(normalized);
    return Number.isFinite(amount) ? amount : undefined;
  }

  private parseDate(value: string): Date | undefined {
    const normalized = value.trim();
    const iso = /^\d{4}-\d{2}-\d{2}$/.test(normalized)
      ? `${normalized}T00:00:00.000Z`
      : normalized;
    const parsed = new Date(iso);
    return Number.isNaN(parsed.getTime()) ? undefined : parsed;
  }
}
