import { Module } from '@nestjs/common';
import { QueueModule } from './infrastructure/queue/queueModule';
import { SunatMockModule } from './infrastructure/mock/sunatMockModule';

@Module({
  imports: [QueueModule, SunatMockModule],
  exports: [QueueModule, SunatMockModule],
})
export class ResilienceModule {}
