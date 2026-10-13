import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prismaService';

@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
