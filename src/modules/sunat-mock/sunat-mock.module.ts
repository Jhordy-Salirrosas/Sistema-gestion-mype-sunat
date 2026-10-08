import { Module } from '@nestjs/common';
import { SunatMockController } from './sunat-mock.controller';
import { SunatMockService } from './sunat-mock.service';

@Module({
  controllers: [SunatMockController],
  providers: [SunatMockService]
})
export class SunatMockModule {}
