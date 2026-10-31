import { Module } from '@nestjs/common';
import { ResilienceStateService } from './resilienceStateService';

/**
 * Modulo compartido del estado de resiliencia.
 *
 * Existe para que `ResilienceModule`, `SireModule` y `SunatMockModule`
 * compartan la misma instancia: el primero maneja cola/caos, SIRE expone el
 * dashboard y el mock consulta el modo de fallo forzado.
 */
@Module({
  providers: [ResilienceStateService],
  exports: [ResilienceStateService],
})
export class ResilienceStateModule {}
