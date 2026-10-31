import { Module } from '@nestjs/common';
import { CertificateService } from './certificate.service';
import { SignatureService } from './signature.service';
import { PrismaModule } from '../../database/prismaModule';
import { CdrPersistenceService } from './cdr-persistence.service';
import { SunatBillService } from './sunat-bill.service';
import { ResilienceStateModule } from '../resilience/application/resilienceStateModule';
import { ResilienceStateService } from '../resilience/application/resilienceStateService';
import { SunatStatusConsultaService } from './statusConsultaService';
import { CONSULTA_ESTADO_PORT } from '../resilience/infrastructure/queue/invoiceRetryService';

/**
 * Modulo SUNAT.
 *
 * Contiene:
 *  - TA-04: gestion del certificado digital X.509 y firma XMLDSig
 *    (CertificateService, SignatureService).
 *  - TA-03: cliente SOAP del billService, parseo del CDR y persistencia
 *    (SunatBillService, CdrPersistenceService).
 *  - TA-30: consulta de estado y recuperacion del CDR de un envio que quedo
 *    en timeout (SunatStatusConsultaService).
 *  - TA-58: el puerto `CONSULTA_ESTADO_PORT` queda enlazado al servicio de
 *    consulta de TA-30. Sin este enlace, `InvoiceRetryService` lo recibia como
 *    `undefined` (la inyeccion es `@Optional()`, asi que nada fallaba al
 *    arrancar) y la conciliacion de TA-32 nunca se ejecutaba.
 */
@Module({
  imports: [PrismaModule, ResilienceStateModule],
  controllers: [],
  providers: [
    CertificateService,
    SignatureService,
    CdrPersistenceService,
    SunatStatusConsultaService,
    // TA-58: `useExisting` y no `useClass`, para que el token y el provider
    // apunten a la MISMA instancia. Con `useClass` Nest construye dos objetos
    // y se pierden tanto el cache como el estado del logger.
    {
      provide: CONSULTA_ESTADO_PORT,
      useExisting: SunatStatusConsultaService,
    },
    // El servicio se construye con su factory, que resuelve el endpoint y el
    // timeout del entorno. Al recibir sus dependencias por constructor sigue
    // siendo testeable con un cliente que apunte al Mock.
    {
      provide: SunatBillService,
      useFactory: (
        persistence: CdrPersistenceService,
        resilienceState: ResilienceStateService,
      ) => SunatBillService.create(persistence, undefined, resilienceState),
      inject: [CdrPersistenceService, ResilienceStateService],
    },
  ],
  exports: [
    SunatBillService,
    CertificateService,
    SignatureService,
    SunatStatusConsultaService,
    // TA-58: el consumidor de facturas audita el rechazo de la compuerta XSL
    // con `CdrPersistenceService`, para que la traza sea la misma que la de un
    // rechazo de SUNAT. Se exporta porque `InvoicesModule` lo inyecta.
    CdrPersistenceService,
    // TA-58: se exporta el token para que `ResilienceModule` no tenga que
    // conocer la clase concreta que hay detras.
    CONSULTA_ESTADO_PORT,
  ],
})
export class SunatModule {}
