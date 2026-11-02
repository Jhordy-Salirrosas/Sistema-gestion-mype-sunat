import { IsIn, IsOptional, IsString, Matches } from 'class-validator';

export class SireProvisionalQueryDto {
  @IsOptional()
  @IsString()
  ruc?: string;

  @IsString()
  @Matches(/^(?!0000)\d{4}(0[1-9]|1[0-2])$/)
  periodo!: string;

  @IsString()
  @IsIn(['RVIE', 'RCE', 'RVIE_VENTAS', 'RCE_COMPRAS'])
  libro!: 'RVIE' | 'RCE' | 'RVIE_VENTAS' | 'RCE_COMPRAS';
}

export function toPeriodBookDto(query: SireProvisionalQueryDto) {
  return {
    period: query.periodo,
    bookType:
      query.libro === 'RVIE' || query.libro === 'RVIE_VENTAS'
        ? ('RVIE_VENTAS' as const)
        : ('RCE_COMPRAS' as const),
  };
}
