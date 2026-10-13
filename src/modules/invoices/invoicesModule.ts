import { Module } from '@nestjs/common';
import { InvoicesController } from './infrastructure/controllers/invoicesController';
import { InvoicesService } from './application/services/invoicesService';
import { QueueModule } from '../resilience/infrastructure/queue/queueModule';

@Module({
  imports: [QueueModule],
  controllers: [InvoicesController],
  providers: [InvoicesService],
  exports: [InvoicesService],
})
export class InvoicesModule {}
