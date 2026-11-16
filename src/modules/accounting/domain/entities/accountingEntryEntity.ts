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
  /** Nota libre del contador; no va al PLE. */
  observation?: string;
  /** Persona o área que registró el asiento. */
  responsible?: string;
  sourceModule: string; // INVOICES | CUSTOMS
  journalCode?: string; // VEN | COM | CAJ | OPV | GAS
  sourceReferenceId?: string;
  idempotencyKey?: string;
  lines: AccountingLine[];
  status?: 'BORRADOR' | 'ASENTADO' | 'ANULADO';
  /** Momento en que se registró el asiento (distinto de la fecha contable). */
  createdAt?: Date;
}

export class AccountingEntryEntity {
  public readonly id?: string;
  public readonly companyId: string;
  public readonly period: string;
  public readonly entryNumber: number;
  public readonly entryDate: Date;
  public readonly glosa: string;
  public readonly observation?: string;
  public readonly responsible?: string;
  public readonly sourceModule: string;
  public readonly journalCode: string;
  public readonly sourceReferenceId?: string;
  public readonly idempotencyKey?: string;
  public readonly lines: ReadonlyArray<AccountingLine>;
  public readonly status: 'BORRADOR' | 'ASENTADO' | 'ANULADO';
  public readonly createdAt?: Date;

  constructor(props: AccountingEntryProps) {
    this.id = props.id;
    this.companyId = props.companyId;
    this.period = props.period;
    this.entryNumber = props.entryNumber;
    this.entryDate = props.entryDate;
    this.glosa = props.glosa;
    this.observation = props.observation;
    this.responsible = props.responsible;
    this.sourceModule = props.sourceModule;
    this.journalCode = props.journalCode ?? 'OPV';
    this.sourceReferenceId = props.sourceReferenceId;
    this.idempotencyKey = props.idempotencyKey;
    this.lines = Object.freeze([...props.lines]);
    this.status = props.status ?? 'ASENTADO';
    this.createdAt = props.createdAt;
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
