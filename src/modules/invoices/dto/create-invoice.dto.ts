import {
  IsString,
  IsInt,
  IsNumber,
  IsDateString,
  IsObject,
  Min,
  Length,
} from 'class-validator';
import { Prisma } from '../../../generated/prisma/client';

export class CreateInvoiceDto {
  @IsString()
  @Length(11, 11, { message: 'El RUC debe tener exactamente 11 dígitos' })
  ruc_emisor: string;

  @IsString()
  @Length(1, 4)
  serie: string;

  @IsInt()
  @Min(1)
  correlativo: number;

  @IsString()
  @Length(2, 2, {
    message: 'El tipo de comprobante debe ser 2 dígitos (01, 03, ...)',
  })
  tipo_comprobante: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  monto_total: number;

  @IsDateString()
  fecha_emision: string;

  @IsObject()
  payload_ubl: Prisma.InputJsonValue;
}
