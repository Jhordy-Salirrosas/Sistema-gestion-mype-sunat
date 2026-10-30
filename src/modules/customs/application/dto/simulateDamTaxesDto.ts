import {
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class SimulateDamItemDto {
  @IsNotEmpty()
  @IsString()
  hsCode!: string;

  @IsNotEmpty()
  @IsString()
  commercialDescription!: string;

  @IsNumber()
  @Min(0.0001)
  quantity!: number;

  @IsNumber()
  @Min(0)
  fobUnitUsd!: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  netWeightKg?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  grossWeightKg?: number;

  @IsOptional()
  @IsEnum([0, 6, 11])
  adValoremRate?: number;
}

export class SimulateDamTaxesDto {
  @IsNumber()
  @Min(0.01)
  fobValueUsd!: number;

  @IsNumber()
  @Min(0)
  freightValueUsd!: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  insuranceValueUsd?: number;

  @IsNumber()
  @Min(0.0001)
  exchangeRate!: number;

  @IsOptional()
  @IsEnum([0, 6, 11])
  adValoremRate?: number;

  @IsOptional()
  @IsEnum([3.5, 5, 10])
  perceptionRate?: number;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SimulateDamItemDto)
  items?: SimulateDamItemDto[];
}

