import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/authModule';
import { ResilienceStateModule } from './application/resilienceStateModule';
import { ResilienceController } from './infrastructure/controllers/resilienceController';
import { QueueModule } from './infrastructure/queue/queueModule';
import { SunatMockModule } from './infrastructure/mock/sunatMockModule';

@Module({
  // AuthModule es necesario porque ResilienceController usa AuthGuard, que
  // inyecta TOKEN_SERVICE_PORT. Igual que lo hace InvoicesModule.
  imports: [QueueModule, SunatMockModule, ResilienceStateModule, AuthModule],
  controllers: [ResilienceController],
  exports: [QueueModule, SunatMockModule],
})
export class ResilienceModule {}
