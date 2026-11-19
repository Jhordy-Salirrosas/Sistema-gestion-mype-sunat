import { IsDateString, IsNotEmpty, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class CreatePaymentScheduleDto {
  @IsString() @IsNotEmpty() purchaseId!: string;
  @IsDateString() scheduledDate!: string;
  @IsNumber() @Min(0.01) amount!: number;
  @IsOptional() @IsString() notes?: string;
}

export class UpdatePurchaseDueDateDto {
  @IsOptional() @IsDateString() dueDate?: string | null;
}
