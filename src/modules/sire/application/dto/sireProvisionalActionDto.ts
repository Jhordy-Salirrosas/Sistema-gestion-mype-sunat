import { IsBoolean, IsOptional, IsString } from 'class-validator';
import { SirePeriodBookDto } from './sirePeriodBookDto';

export class SireProvisionalActionDto {
  @IsString()
  proposalId!: string;

  @IsOptional()
  @IsString()
  carSunat?: string;

  @IsOptional()
  @IsString()
  reason?: string;
}

export class AcceptSireProposalDto {
  @IsBoolean()
  confirmed!: boolean;
}

export class AcceptSirePeriodDto extends SirePeriodBookDto {
  @IsBoolean()
  confirmed!: boolean;
}
