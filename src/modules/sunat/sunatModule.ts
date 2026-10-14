import { Module } from '@nestjs/common';
import { CertificateService } from './certificate.service';
import { SignatureService } from './signature.service';
import { PrismaModule } from '../../database/prismaModule';
import { CdrPersistenceService } from './cdr-persistence.service';
import { SunatBillService } from './sunat-bill.service';

/**
 * Modulo SUNAT.
 *
 * Contiene:
 *  - TA-04: gestion del certificado digital X.509 y firma XMLDSig
 *    (CertificateService, SignatureService).
 *  - TA-03: cliente SOAP del billService, parseo del CDR y persistencia
 *    (SunatBillService, CdrPersistenceService).
 */
@Module({
  imports: [PrismaModule],
  controllers: [],
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
