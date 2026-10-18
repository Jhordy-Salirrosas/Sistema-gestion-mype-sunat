import { Module } from '@nestjs/common';
import { ResilienceStateModule } from '../../application/resilienceStateModule';
import { SunatMockController } from './sunat-mock.controller';
import { SunatMockService } from './sunat-mock.service';

@Module({
  imports: [ResilienceStateModule],
  controllers: [SunatMockController],
  providers: [SunatMockService],
})
export class SunatMockModule {}
