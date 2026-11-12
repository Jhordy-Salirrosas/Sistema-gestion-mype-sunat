import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEmail,
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  MaxLength,
  Min,
} from 'class-validator';
import { IsPartnerDocument } from '../validators/partnerInputValidation';

export class UpsertCurrencyDto {
  @IsString()
  @Length(3, 3)
  code!: string;

  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  @IsNotEmpty()
  symbol!: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  decimals?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class CreateExchangeRateDto {
  @IsString()
  @Length(3, 3)
  baseCurrency!: string;

  @IsString()
  @Length(3, 3)
  quoteCurrency!: string;

  @IsNumber()
  @Min(0.000001)
  rate!: number;

  @IsDateString()
  date!: string;

  @IsOptional()
  @IsString()
  source?: string;
}

export class UpsertIncotermDto {
  @IsString()
  @Length(3, 3)
  code!: string;

  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsOptional()
  @IsString()
  version?: string;

  @IsOptional()
  @IsBoolean()
  namedPlaceRequired?: boolean;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

class BasePartnerOptionalFieldsDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  tradeName?: string;

  @IsOptional()
  @IsString()
  @Length(2, 2)
  countryCode?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  website?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  roles?: string[];

  @IsOptional()
  @IsString()
  paymentTerms?: string;

  @IsOptional()
  @IsBoolean()
  hasCredit?: boolean;

  @IsOptional()
  @IsBoolean()
  allowsDiscount?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(0)
  creditLimit?: number;

  @IsOptional()
  @IsString()
  @Length(3, 3)
  currencyCode?: string;

  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsString()
  postalCode?: string;

  @IsOptional()
  @IsString()
  contactName?: string;

  @IsOptional()
  @IsString()
  bankName?: string;

  @IsOptional()
  @IsString()
  accountNumber?: string;

  @IsOptional()
  @IsString()
  swiftCode?: string;
}

export class CreatePartnerDto extends BasePartnerOptionalFieldsDto {
  @IsString()
  @IsIn(['0', '1', '4', '6'])
  docType!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  @IsPartnerDocument()
  docNumber!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  legalName!: string;
}

export class UpdatePartnerDto extends BasePartnerOptionalFieldsDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  legalName?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class AddPartnerAddressDto {
  @IsOptional()
  @IsString()
  label?: string;

  @IsString()
  @IsNotEmpty()
  address!: string;

  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsString()
  state?: string;

  @IsOptional()
  @IsString()
  @Length(2, 2)
  countryCode?: string;

  @IsOptional()
  @IsString()
  postalCode?: string;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}

export class AddPartnerContactDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsOptional()
  @IsString()
  position?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean;
}

export class AddPartnerBankAccountDto {
  @IsString()
  @IsNotEmpty()
  bankName!: string;

  @IsOptional()
  @IsString()
  @Length(2, 2)
  bankCountry?: string;

  @IsString()
  @IsNotEmpty()
  accountNumber!: string;

  @IsOptional()
  @IsString()
  cci?: string;

  @IsOptional()
  @IsString()
  swift?: string;

  @IsOptional()
  @IsString()
  iban?: string;

  @IsOptional()
  @IsString()
  beneficiary?: string;

  @IsOptional()
  @IsString()
  @Length(3, 3)
  currencyCode?: string;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}

export class UpsertDocumentTypeDto {
  @IsString()
  @IsNotEmpty()
  code!: string;

  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsOptional()
  @IsString()
  stage?: string;

  @IsOptional()
  @IsBoolean()
  isRequired?: boolean;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  allowedFormats?: string[];

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpsertAccountingMappingDto {
  @IsString()
  @IsNotEmpty()
  processCode!: string;

  @IsString()
  @IsNotEmpty()
  roleCode!: string;

  @IsString()
  @IsNotEmpty()
  accountCode!: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpsertPartnerTaxStatusDto {
  @IsIn(['RETENCION', 'PERCEPCION', 'BUEN_CONTRIBUYENTE'])
  indicator!: 'RETENCION' | 'PERCEPCION' | 'BUEN_CONTRIBUYENTE';

  @IsBoolean()
  value!: boolean;

  @IsDateString()
  validFrom!: string;

  @IsOptional()
  @IsDateString()
  validTo?: string;

  @IsOptional()
  @IsIn(['MANUAL', 'SUNAT'])
  source?: 'MANUAL' | 'SUNAT';

  @IsOptional()
  @IsString()
  updatedBy?: string;
}

export class UpsertCountryDto {
  @IsString()
  @Length(2, 3)
  code!: string;

  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsOptional()
  @IsString()
  status?: string;
}

export class UpsertPortDto {
  @IsString()
  @IsNotEmpty()
  code!: string;

  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsOptional()
  @IsString()
  countryCode?: string;

  @IsOptional()
  @IsString()
  type?: string; // ORIGEN, DESTINO, AMBOS

  @IsOptional()
  @IsString()
  status?: string;
}

export class UpdateExchangeRateDto {
  @IsNumber()
  @Min(0.000001)
  rate!: number;

  @IsOptional()
  @IsString()
  source?: string;
}
