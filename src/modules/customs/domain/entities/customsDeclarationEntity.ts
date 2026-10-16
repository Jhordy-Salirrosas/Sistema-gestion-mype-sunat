import { CustomsItemEntity } from './customsItemEntity';

export type CustomsDeclarationStatus =
  | 'REGISTRADO'
  | 'LIQUIDADO'
  | 'APLICADO_KARDEX'
  | 'ANULADO';

export interface CustomsDeclarationProps {
  id?: string;
  companyId: string;
  duaNumber: string;
  customsAgencyCode: string;
  regimeCode: string;
  numerationDate: Date;
  fobValueUsd: number;
  freightValueUsd: number;
  insuranceValueUsd: number;
  cifValueUsd: number;
  exchangeRate: number;
  cifValuePen: number;
  adValoremRate: number;
  adValoremAmountPen: number;
  igvRate: number;
  ipmRate: number;
  igvIpmAmountPen: number;
  perceptionRate: number;
  perceptionAmountPen: number;
  totalCustomsTaxesPen: number;
  status: CustomsDeclarationStatus;
  duaPdfStorageUrl?: string | null;
  items?: CustomsItemEntity[];
  createdAt?: Date;
  updatedAt?: Date;
}

export class CustomsDeclarationEntity {
  private readonly itemsList: CustomsItemEntity[];

  constructor(private readonly props: CustomsDeclarationProps) {
    this.itemsList = props.items ? [...props.items] : [];
  }

  get id(): string | undefined {
    return this.props.id;
  }

  get companyId(): string {
    return this.props.companyId;
  }

  get duaNumber(): string {
    return this.props.duaNumber;
  }

  get customsAgencyCode(): string {
    return this.props.customsAgencyCode;
  }

  get regimeCode(): string {
    return this.props.regimeCode;
  }

  get numerationDate(): Date {
    return this.props.numerationDate;
  }

  get fobValueUsd(): number {
    return this.props.fobValueUsd;
  }

  get freightValueUsd(): number {
    return this.props.freightValueUsd;
  }

  get insuranceValueUsd(): number {
    return this.props.insuranceValueUsd;
  }

  get cifValueUsd(): number {
    return this.props.cifValueUsd;
  }

  get exchangeRate(): number {
    return this.props.exchangeRate;
  }

  get cifValuePen(): number {
    return this.props.cifValuePen;
  }

  get adValoremRate(): number {
    return this.props.adValoremRate;
  }

  get adValoremAmountPen(): number {
    return this.props.adValoremAmountPen;
  }

  get igvRate(): number {
    return this.props.igvRate;
  }

  get ipmRate(): number {
    return this.props.ipmRate;
  }

  get igvIpmAmountPen(): number {
    return this.props.igvIpmAmountPen;
  }

  get perceptionRate(): number {
    return this.props.perceptionRate;
  }

  get perceptionAmountPen(): number {
    return this.props.perceptionAmountPen;
  }

  get totalCustomsTaxesPen(): number {
    return this.props.totalCustomsTaxesPen;
  }

  get status(): CustomsDeclarationStatus {
    return this.props.status;
  }

  get duaPdfStorageUrl(): string | null | undefined {
    return this.props.duaPdfStorageUrl;
  }

  get items(): CustomsItemEntity[] {
    return [...this.itemsList];
  }

  get createdAt(): Date | undefined {
    return this.props.createdAt;
  }

  get updatedAt(): Date | undefined {
    return this.props.updatedAt;
  }

  addItem(item: CustomsItemEntity): void {
    this.itemsList.push(item);
  }

  toPrimitives(): CustomsDeclarationProps {
    return {
      ...this.props,
      items: this.itemsList.map((item) => item),
    };
  }
}
