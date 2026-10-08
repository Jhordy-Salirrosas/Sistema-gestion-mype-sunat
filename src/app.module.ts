import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { HealthModule } from './modules/health/health.module';
import { InvoicesModule } from './modules/invoices/invoices.module';
import { SunatModule } from './modules/sunat/sunat.module';
import { SunatMockModule } from './modules/sunat-mock/sunat-mock.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    HealthModule,
    InvoicesModule,
    // Cliente SOAP del billService, parseo del CDR y persistencia (TA-03).
    SunatModule,
    SunatMockModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
