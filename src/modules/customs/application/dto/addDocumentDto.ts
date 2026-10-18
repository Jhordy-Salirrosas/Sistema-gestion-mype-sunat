import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class AddDocumentDto {
  @IsNotEmpty({ message: 'El tipo de documento es obligatorio (FAC, BL, SEG, DR_VUCE)' })
  @IsString()
  document_type: string;

  @IsNotEmpty({ message: 'El número de documento es obligatorio' })
  @IsString()
  document_number: string;

  @IsNotEmpty({ message: 'La fecha de emisión es obligatoria' })
  issue_date: Date;

  @IsOptional()
  @IsString()
  issuer_name?: string;

  @IsNotEmpty({ message: 'La URL de almacenamiento es obligatoria' })
  @IsString()
  storage_url: string;

  @IsOptional()
  @IsString()
  vuce_dr_number?: string;
}
