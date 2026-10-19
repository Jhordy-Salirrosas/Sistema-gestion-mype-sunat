import { IsIn, IsString, Matches } from 'class-validator';

export class SirePeriodBookDto {
  @IsString()
  @Matches(/^(?!0000)\d{4}(0[1-9]|1[0-2])$/)
  period!: string;

  @IsString()
  @IsIn(['RVIE_VENTAS', 'RCE_COMPRAS'])
  bookType!: 'RVIE_VENTAS' | 'RCE_COMPRAS';
}
