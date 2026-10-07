import { Module } from '@nestjs/common';
import { CertificateService } from './certificate.service';
import { SignatureService } from './signature.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { CdrPersistenceService } from './cdr-persistence.service';
import { SunatBillMockController } from './mock/sunat-bill-mock.controller';
import { SunatBillService } from './sunat-bill.service';

/**
 * Modulo SUNAT.
 *
 * Contiene dos conjuntos de responsabilidades que llegaron en paralelo:
 *  - TA-04: gestion del certificado digital X.509 y firma XMLDSig
 *    (CertificateService, SignatureService).
 *  - TA-03: cliente SOAP del billService, parseo del CDR y persistencia
 *    (SunatBillService, CdrPersistenceService), mas el Mock minimo del
 *    billService como insumo de TA-06.
 */
@Module({
  imports: [PrismaModule],
  controllers: [SunatBillMockController],
  providers: [
    CertificateService,
    SignatureService,
    CdrPersistenceService,
    // El servicio se construye con su factory, que resuelve el endpoint y el
    // timeout del entorno. Al recibir sus dependencias por constructor sigue
    // siendo testeable con un cliente que apunte al Mock.
    {
      provide: SunatBillService,
      useFactory: (persistence: CdrPersistenceService) =>
        SunatBillService.create(persistence),
      inject: [CdrPersistenceService],
    },
  ],
  exports: [SunatBillService, CertificateService, SignatureService],
})
export class SunatModule {}
