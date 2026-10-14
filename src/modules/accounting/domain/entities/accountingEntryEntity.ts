export interface AccountingLine {
  lineOrder: number;
  accountCode: string;
  accountName: string;
  debitAmount: number;
  creditAmount: number;
}

export interface AccountingEntryProps {
  id?: string;
  companyId: string;
  period: string; // YYYY-MM
  entryNumber: number;
  entryDate: Date;
  glosa: string;
  sourceModule: string; // INVOICES | CUSTOMS
  sourceReferenceId?: string;
  lines: AccountingLine[];
  status?: 'BORRADOR' | 'ASENTADO' | 'ANULADO';
}

export class AccountingEntryEntity {
  public readonly id?: string;
  public readonly companyId: string;
  public readonly period: string;
  public readonly entryNumber: number;
  public readonly entryDate: Date;
  public readonly glosa: string;
  public readonly sourceModule: string;
  public readonly sourceReferenceId?: string;
  public readonly lines: ReadonlyArray<AccountingLine>;
  public readonly status: 'BORRADOR' | 'ASENTADO' | 'ANULADO';

  constructor(props: AccountingEntryProps) {
    this.id = props.id;
    this.companyId = props.companyId;
    this.period = props.period;
    this.entryNumber = props.entryNumber;
    this.entryDate = props.entryDate;
    this.glosa = props.glosa;
    this.sourceModule = props.sourceModule;
    this.sourceReferenceId = props.sourceReferenceId;
    this.lines = Object.freeze([...props.lines]);
    this.status = props.status ?? 'ASENTADO';
  }

  getTotalDebit(): number {
    const sum = this.lines.reduce((acc, l) => acc + l.debitAmount, 0);
    return Math.round(sum * 100) / 100;
  }

  getTotalCredit(): number {
    const sum = this.lines.reduce((acc, l) => acc + l.creditAmount, 0);
    return Math.round(sum * 100) / 100;
  }
}
