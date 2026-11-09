import { IsOptional, IsString, Matches, MinLength } from 'class-validator';

export class CreateAccountingAccountDto {
  @Matches(/^\d{2,6}$/, { message: 'El código debe tener entre 2 y 6 dígitos.' })
  code!: string;

  @IsString()
  @MinLength(3)
  name!: string;

  @IsOptional()
  @Matches(/^\d{1,5}$/, { message: 'La cuenta padre debe ser numérica.' })
  parentCode?: string;
}
