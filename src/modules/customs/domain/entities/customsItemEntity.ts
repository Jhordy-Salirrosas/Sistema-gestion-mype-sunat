export interface CustomsItemProps {
  id?: string;
  declarationId?: string;
  itemOrder: number;
  itemCode?: string;
  hsCode: string;
  commercialDescription: string;
  quantity: number;
  unitCode: string;
  fobUnitUsd: number;
  fobTotalUsd: number;
  allocatedCifPen: number;
  allocatedDutiesPen: number;
  landedCostUnitPen: number;
}

export class CustomsItemEntity {
  constructor(private readonly props: CustomsItemProps) {}

  get id(): string | undefined {
    return this.props.id;
  }

  get declarationId(): string | undefined {
    return this.props.declarationId;
  }

  get itemOrder(): number {
    return this.props.itemOrder;
  }

  get itemCode(): string | undefined {
    return this.props.itemCode;
  }

  get hsCode(): string {
    return this.props.hsCode;
  }

  get commercialDescription(): string {
    return this.props.commercialDescription;
  }

  get quantity(): number {
    return this.props.quantity;
  }

  get unitCode(): string {
    return this.props.unitCode;
  }

  get fobUnitUsd(): number {
    return this.props.fobUnitUsd;
  }

  get fobTotalUsd(): number {
    return this.props.fobTotalUsd;
  }

  get allocatedCifPen(): number {
    return this.props.allocatedCifPen;
  }

  get allocatedDutiesPen(): number {
    return this.props.allocatedDutiesPen;
  }

  get landedCostUnitPen(): number {
    return this.props.landedCostUnitPen;
  }

  toPrimitives(): CustomsItemProps {
    return { ...this.props };
  }
}
