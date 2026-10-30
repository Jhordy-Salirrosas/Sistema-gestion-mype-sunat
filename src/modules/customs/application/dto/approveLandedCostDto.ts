import { IsBoolean, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class ApproveLandedCostDto {
  @IsNotEmpty()
  @IsString()
  shipmentId!: string;

  @IsOptional()
  @IsString()
  declarationId?: string;

  @IsOptional()
  @IsBoolean()
  approvedByAccountant?: boolean;

  @IsOptional()
  @IsString()
  notes?: string;
}

