import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { validate } from './config/env.validation';
import { PrismaModule } from './database/prismaModule';
import { HealthModule } from './common/health/healthModule';
import { InvoicesModule } from './modules/invoices/invoicesModule';
import { SunatModule } from './modules/sunat/sunatModule';
import { ResilienceModule } from './modules/resilience/resilienceModule';
import { CustomsModule } from './modules/customs/customsModule';
import { AuthModule } from './modules/auth/authModule';
import { SireModule } from './modules/sire/sireModule';
import { AccountingModule } from './modules/accounting/accountingModule';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate,
    }),
    PrismaModule,
    HealthModule,
    InvoicesModule,
    // Cliente SOAP del billService, parseo del CDR y persistencia (TT-03).
    SunatModule,
    ResilienceModule,
    CustomsModule,
    AuthModule,
    SireModule,
    AccountingModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
