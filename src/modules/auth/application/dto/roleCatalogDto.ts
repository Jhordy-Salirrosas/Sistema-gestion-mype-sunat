import { Transform } from 'class-transformer';
import { IsString, Length, Matches } from 'class-validator';
export class RenameRoleDto {
  @Transform(({value}) => typeof value==='string'?value.trim():value)
  @IsString() @Length(1,100) name!: string;
}
export class CreateRoleDto extends RenameRoleDto {
  @IsString() @Matches(/^[A-Z][A-Z0-9_]{0,63}$/) code!: string;
}
