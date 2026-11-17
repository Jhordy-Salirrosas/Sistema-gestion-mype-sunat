export interface LedgerMovement {
  entryId: string;
  entryNumber: number;
  entryDate: Date;
  glosa: string;
  sourceModule: string;
  /** Documento de origen (factura, DAM, comprobante), si el asiento lo tiene. */
  sourceReferenceId?: string | null;
  accountCode: string;
  accountName: string;
  /** Estado del asiento: permite marcar las anulaciones en el mayor. */
  status?: 'BORRADOR' | 'ASENTADO' | 'ANULADO';
  debit: number;
  credit: number;
}

export interface TrialBalanceRow {
  accountCode: string;
  accountName: string;
  /** Saldo acumulado de los períodos anteriores (deudor positivo). */
  openingBalance?: number;
  debit: number;
  credit: number;
}
