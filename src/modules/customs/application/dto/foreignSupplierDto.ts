import { IsBoolean, IsEmail, IsIn, IsNotEmpty, IsOptional, IsString, Length } from 'class-validator';

export class CreateForeignSupplierDto {
  @IsOptional() @IsString() @Length(1, 30) taxId?: string;
  @IsString() @IsNotEmpty() businessName!: string;
  @IsString() @Length(2, 2) countryCode!: string;
  @IsOptional() @IsString() defaultCurrency?: string;
  @IsOptional() @IsBoolean() isRelated?: boolean;
  @IsOptional() @IsString() address?: string;
  @IsOptional() @IsEmail() email?: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsString() contactName?: string;
  @IsOptional() @IsString() paymentTerms?: string;
  @IsOptional() @IsString() bankName?: string;
  @IsOptional() @IsString() bankAccount?: string;
  @IsOptional() @IsString() swiftCode?: string;
  @IsOptional() @IsString() vesselName?: string;
  @IsOptional() @IsString() voyageNumber?: string;
  @IsOptional() @IsString() blNumber?: string;
  @IsOptional() @IsString() portOrigin?: string;
}

export class UpdateForeignSupplierDto {
  @IsOptional() @IsString() @Length(1, 30) taxId?: string;
  @IsOptional() @IsString() businessName?: string;
  @IsOptional() @IsString() @Length(2, 2) countryCode?: string;
  @IsOptional() @IsString() defaultCurrency?: string;
  @IsOptional() @IsBoolean() isRelated?: boolean;
  @IsOptional() @IsString() address?: string;
  @IsOptional() @IsEmail() email?: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsString() contactName?: string;
  @IsOptional() @IsString() paymentTerms?: string;
  @IsOptional() @IsString() bankName?: string;
  @IsOptional() @IsString() bankAccount?: string;
  @IsOptional() @IsString() swiftCode?: string;
  @IsOptional() @IsString() vesselName?: string;
  @IsOptional() @IsString() voyageNumber?: string;
  @IsOptional() @IsString() blNumber?: string;
  @IsOptional() @IsString() portOrigin?: string;
}
