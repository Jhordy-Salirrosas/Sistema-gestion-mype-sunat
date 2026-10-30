export type ShipmentStatusType =
  | 'BORRADOR'
  | 'EN_TRANSITO'
  | 'ARRIBADO'
  | 'EN_DESPACHO'
  | 'CON_LEVANTE'
  | 'COSTEADO'
  | 'CERRADO'
  | 'CANCELADO';

export interface CustomsShipmentProps {
  id?: string;
  companyId: string;
  shipmentNumber: string;
  supplierId?: string | null;
  customsBrokerId?: string | null;
  incoterm: string;
  currencyCode: string;
  transportMode: string;
  originCountryCode: string;
  destinationCustoms: string;
  etdDate?: Date | null;
  etaDate?: Date | null;
  orderReference?: string | null;
  status: ShipmentStatusType;
  isObserved?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export class CustomsShipmentEntity {
  constructor(private readonly props: CustomsShipmentProps) {
    if (props.etaDate && props.etdDate && props.etaDate < props.etdDate) {
      throw new Error('La fecha estimada de arribo (ETA) no puede ser anterior al zarpe (ETD).');
    }
  }

  get id(): string | undefined {
    return this.props.id;
  }

  get companyId(): string {
    return this.props.companyId;
  }

  get shipmentNumber(): string {
    return this.props.shipmentNumber;
  }

  get incoterm(): string {
    return this.props.incoterm;
  }

  get currencyCode(): string {
    return this.props.currencyCode;
  }

  get transportMode(): string {
    return this.props.transportMode;
  }

  get originCountryCode(): string {
    return this.props.originCountryCode;
  }

  get destinationCustoms(): string {
    return this.props.destinationCustoms;
  }

  get status(): ShipmentStatusType {
    return this.props.status;
  }

  get isObserved(): boolean {
    return this.props.isObserved ?? false;
  }

  updateStatus(newStatus: ShipmentStatusType): void {
    if (this.props.status === 'CERRADO' || this.props.status === 'CANCELADO') {
      throw new Error(`No se puede modificar un expediente en estado ${this.props.status}.`);
    }
    this.props.status = newStatus;
  }

  markObserved(observed: boolean): void {
    this.props.isObserved = observed;
  }

  toPrimitives(): CustomsShipmentProps {
    return { ...this.props };
  }
}

