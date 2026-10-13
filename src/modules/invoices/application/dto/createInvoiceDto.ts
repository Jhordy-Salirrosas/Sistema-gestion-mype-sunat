import {
  IsString,
  IsInt,
  IsNumber,
  IsDateString,
  IsObject,
  Min,
  Max,
  Length,
  IsNotEmpty,
  IsPositive,
} from 'class-validator';
import { Prisma } from '../../../../generated/client/client';
import { IsRucValid } from '../validators/isRucValidDecorator';
import { IsSerieValid } from '../validators/isSerieValidDecorator';

export class CreateInvoiceDto {
  @IsNotEmpty()
  @IsString()
  @IsRucValid()
  ruc_emisor: string;

  @IsNotEmpty()
  @IsString()
  @IsSerieValid()
  serie: string;

  @IsNotEmpty()
  @IsInt()
  @Min(1)
  @Max(99999999)
  correlativo: number;

  @IsNotEmpty()
  @IsString()
  @Length(2, 2, {
    message: 'El tipo de comprobante debe ser 2 dígitos (01, 03, ...)',
  })
  tipo_comprobante: string;

  @IsNotEmpty()
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  monto_total: number;

  @IsNotEmpty()
  @IsDateString()
  fecha_emision: string;

  @IsNotEmpty()
  @IsObject()
  payload_ubl: Prisma.InputJsonValue;
}
