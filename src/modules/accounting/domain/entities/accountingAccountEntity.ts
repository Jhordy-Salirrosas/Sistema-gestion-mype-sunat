export interface AccountingAccountEntity {
  code: string;
  name: string;
  element: string;
  nature: 'Deudora' | 'Acreedora';
  parentCode: string | null;
  level: number;
  isActive: boolean;
}
