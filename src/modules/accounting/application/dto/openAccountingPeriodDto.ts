import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class OpenAccountingPeriodDto {
  /**
   * La empresa sale del token; este campo es opcional y solo se usa cuando
   * llega explícito. Sin `@IsOptional`, class-validator rechazaba la petición
   * que no lo enviaba ("companyId must be a string") y la pantalla no podía
   * reabrir un período.
   */
  @IsOptional()
  @IsString()
  companyId?: string;

  @IsInt()
  @Min(2000)
  @Max(2100)
  year!: number;

  @IsInt()
  @Min(1)
  @Max(12)
  month!: number;
}
