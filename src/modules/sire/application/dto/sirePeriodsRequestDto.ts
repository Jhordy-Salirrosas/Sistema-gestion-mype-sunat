import {
  IsIn,
  IsNotEmpty,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';

export class SirePeriodsRequestDto {
  @IsString()
  @IsIn(['140000', '080000'])
  bookCode!: '140000' | '080000';

  @IsString()
  @IsNotEmpty()
  @Matches(/^\S+$/)
  @MaxLength(50)
  solUser!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  solPassword!: string;
}
