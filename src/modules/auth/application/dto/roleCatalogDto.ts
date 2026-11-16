import { Transform } from 'class-transformer';
import { IsString, Length, Matches } from 'class-validator';
export class RenameRoleDto {
  @Transform(({value}) => typeof value==='string'?value.trim():value)
  @IsString({message:'El nombre debe ser texto.'}) @Length(1,100,{message:'El nombre debe tener entre 1 y 100 caracteres.'}) name!: string;
}
export class CreateRoleDto extends RenameRoleDto {
  @IsString({message:'El código debe ser texto.'}) @Matches(/^[A-Z][A-Z0-9_]{0,63}$/,{message:'El código de rol no tiene un formato válido.'}) code!: string;
}
