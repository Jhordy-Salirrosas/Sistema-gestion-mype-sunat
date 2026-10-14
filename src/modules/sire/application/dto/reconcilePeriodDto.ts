import {
  IsArray,
  IsIn,
  IsNotEmpty,
  IsString,
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

  taxableBase!: number;
  igvAmount!: number;
  totalAmount!: number;
}

export class ReconcilePeriodDto {
  @IsString()
  @IsNotEmpty()
  period!: string;

  @IsString()
  @IsIn(['RVIE_VENTAS', 'RCE_COMPRAS'])
  bookType!: 'RVIE_VENTAS' | 'RCE_COMPRAS';

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SireRecordDto)
  localRecords!: SireRecordDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SireRecordDto)
  sireRecords!: SireRecordDto[];
}
