import { Type } from 'class-transformer';
import {
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  Max,
  Min,
} from 'class-validator';

export const SIRE_DASHBOARD_GRANULARITIES = ['minute', 'hour', 'day'] as const;
export type SireDashboardGranularity =
  (typeof SIRE_DASHBOARD_GRANULARITIES)[number];

export class SireDashboardHistoryQueryDto {
  @IsDateString()
  start!: string;

  @IsDateString()
  end!: string;

  @IsIn(SIRE_DASHBOARD_GRANULARITIES)
  granularity!: SireDashboardGranularity;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(500)
  limit = 100;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(50_000)
  offset = 0;
}
