import {
  IsArray,
  IsIn,
  IsNumber,
  IsNotEmpty,
  IsString,
  Matches,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class SireRecordDto {
  @IsString()
  @IsNotEmpty()
  emitterRuc!: string;

  @IsString()
  @IsNotEmpty()
  documentType!: string;

  @IsString()
  @IsNotEmpty()
  series!: string;

  @IsString()
  @IsNotEmpty()
  correlative!: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  taxableBase!: number;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  igvAmount!: number;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  totalAmount!: number;
}

export class ReconcilePeriodDto {
  @IsString()
  @IsNotEmpty()
  @Matches(/^\d{4}(0[1-9]|1[0-2])$/, {
    message: 'El periodo debe tener formato YYYYMM y ser un mes válido',
  })
  period!: string;

  @IsString()
  @IsIn(['RVIE_VENTAS', 'RCE_COMPRAS'])
  bookType!: 'RVIE_VENTAS' | 'RCE_COMPRAS';

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SireRecordDto)
  localRecords!: SireRecordDto[];
}
