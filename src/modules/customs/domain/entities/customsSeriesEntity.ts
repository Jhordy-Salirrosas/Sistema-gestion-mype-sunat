import {
  CustomsItemEntity,
  CustomsItemProps,
} from './customsItemEntity';

export interface CustomsSeriesProps extends CustomsItemProps {
  seriesNumber?: number;
  physicalQuantity?: number;
  physicalUnit?: string;
  adValoremRate?: number;
  tpiCode?: string;
}

/**
 * Entidad de Dominio para una Serie de la DAM (Formato B de Declaración Aduanera).
 * Contiene la clasificación arancelaria (SPN), pesos, valores aduaneros y destino contable.
 */
export class CustomsSeriesEntity extends CustomsItemEntity {
  constructor(props: CustomsSeriesProps) {
    super({
      ...props,
      seriesOrder: props.seriesNumber ?? props.seriesOrder ?? props.itemOrder,
    });
  }

  get seriesNumber(): number {
    return this.seriesOrder ?? this.itemOrder;
  }

  get isMercaderia(): boolean {
    return this.destinationType === 'MERCADERIA';
  }

  get isActivoFijo(): boolean {
    return this.destinationType === 'ACTIVO_FIJO';
  }
}

