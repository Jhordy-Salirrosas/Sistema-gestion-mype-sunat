import { Module } from '@nestjs/common';
import { ResilienceStateModule } from '../../application/resilienceStateModule';
import { SunatMockController } from './sunat-mock.controller';
import { SunatMockService } from './sunat-mock.service';
import { SunatConsultMockController } from './sunatConsultMockController';

@Module({
  imports: [ResilienceStateModule],
  // TA-30: el Mock del consultService (getStatusCdr) se registra junto al del
  // billService, pero en su propio controlador para no tocar el de HU-04.
  controllers: [SunatMockController, SunatConsultMockController],
  providers: [SunatMockService],
})
export class SunatMockModule {}
