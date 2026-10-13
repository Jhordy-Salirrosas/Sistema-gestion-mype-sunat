import { Module } from '@nestjs/common';
import { CustomsController } from './infrastructure/controllers/customsController';
import { CalculateDuaUseCase } from './application/use-cases/calculateDuaUseCase';

@Module({
  controllers: [CustomsController],
  providers: [CalculateDuaUseCase],
  exports: [CalculateDuaUseCase],
})
export class CustomsModule {}
