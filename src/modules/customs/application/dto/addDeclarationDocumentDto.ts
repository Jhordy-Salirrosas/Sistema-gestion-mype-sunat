import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class AddDeclarationDocumentDto {
  @IsNotEmpty({ message: 'El tipo de formato es obligatorio (ej. FORMATO_A, FORMATO_B, FORMATO_C, SUSTENTO)' })
  @IsString()
  format_type: string;

  @IsOptional()
  @IsString()
  document_number?: string;

  @IsNotEmpty({ message: 'El nombre del archivo es obligatorio' })
  @IsString()
  file_name: string;

  @IsNotEmpty({ message: 'La URL o ruta de almacenamiento es obligatoria' })
  @IsString()
  storage_url: string;

  @IsOptional()
  @IsString()
  mime_type?: string;

  @IsOptional()
  file_size_bytes?: number;

  @IsOptional()
  @IsString()
  uploaded_by?: string;
}

