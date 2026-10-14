import { IsNotEmpty, IsNumber, IsString, Length } from 'class-validator';

export class ExportPleDto {
  @IsString()
  @IsNotEmpty()
  companyId: string;

  @IsString()
  @Length(11, 11)
  companyRuc: string;

  @IsNumber()
  year: number;

  @IsNumber()
  month: number;

  @IsString()
  @IsNotEmpty()
  bookCode: string; // e.g. "140100" (Ventas) o "080100" (Compras)
}
