import { ArrayUnique, IsArray, IsString } from 'class-validator';

export class SetUserWarehousesDto {
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  warehouseCodes!: string[];
}
