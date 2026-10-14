import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { CalculateDuaDto } from '../../application/dto/calculateDuaDto';
import { CalculateDuaUseCase } from '../../application/use-cases/calculateDuaUseCase';
import type { CalculatedDuaResponse } from '../../application/use-cases/calculateDuaUseCase';

@Controller('customs')
export class CustomsController {
  constructor(private readonly calculateDuaUseCase: CalculateDuaUseCase) {}

  @Post('calculate')
  @HttpCode(HttpStatus.OK)
  calculateLiquidation(@Body() dto: CalculateDuaDto): CalculatedDuaResponse {
    return this.calculateDuaUseCase.execute(dto);
  }
}
