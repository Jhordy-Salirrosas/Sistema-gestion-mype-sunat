import {
  IsString,
  IsInt,
  IsNumber,
  IsDateString,
  IsObject,
  IsOptional,
  Min,
  Max,
  Length,
  IsNotEmpty,
  IsPositive,
} from 'class-validator';
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
  payload_ubl: Record<string, unknown>;

  /**
   * TA-60: documento del adquirente (Catálogo 06).
   *
   * Opcional en el DTO a propósito, porque la obligación depende del tipo de
   * comprobante y del importe, y eso lo decide `validarAdquirente` con un
   * mensaje que explica cuál de las dos reglas se incumplió. Marcarlo
   * `@IsNotEmpty` aquí haría fallar una boleta sin documento por debajo de los
   * S/ 700, que es una emisión perfectamente legal.
   */
  @IsOptional()
  @IsString()
  customer_identity_type?: string;

  @IsOptional()
  @IsString()
  customer_identity_number?: string;

  @IsOptional()
  @IsString()
  customer_legal_name?: string;

  /**
   * Referencia a la nota de crédito/débito (columnas de `invoices`).
   *
   * Se copian al registrar el comprobante porque la bandeja lee estas columnas
   * y no el `payload_ubl`: sin ellas la nota aparecía sin documento de origen
   * aunque el XML sí lo llevara.
   */
  @IsOptional()
  @IsString()
  referenced_document_type?: string;

  @IsOptional()
  @IsString()
  referenced_series_correlative?: string;

  @IsOptional()
  @IsString()
  credit_debit_reason_code?: string;
}
