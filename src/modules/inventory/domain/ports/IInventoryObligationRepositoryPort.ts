export interface InventoryObligationDecisionRecord {
  id?: string;
  companyId: string;
  fiscalYear: number;
  annualRevenueUit: number;
  taxRegime: string;
  ple12_1Status: 'OBLIGATORIO' | 'EXCEPTUADO' | 'VOLUNTARIO';
  ple13_1Status: 'OBLIGATORIO' | 'EXCEPTUADO' | 'VOLUNTARIO';
  legalBasisNotes?: string | null;
  evaluatedAt?: Date;
}

export const INVENTORY_OBLIGATION_REPOSITORY_PORT = Symbol('INVENTORY_OBLIGATION_REPOSITORY_PORT');

export interface IInventoryObligationRepositoryPort {
  saveDecision(
    decision: InventoryObligationDecisionRecord,
  ): Promise<InventoryObligationDecisionRecord>;
  findByFiscalYear(
    companyId: string,
    fiscalYear: number,
  ): Promise<InventoryObligationDecisionRecord | null>;
}

