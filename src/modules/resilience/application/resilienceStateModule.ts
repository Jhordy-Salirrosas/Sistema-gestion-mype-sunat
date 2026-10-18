import { Module } from '@nestjs/common';
import { ResilienceStateService } from './resilienceStateService';

/**
 * Modulo compartido del estado de resiliencia.
 *
 * Existe para que `ResilienceModule` (que expone el controlador) y
 * `SunatMockModule` (que consulta el modo de caos forzado) reciban **la misma
 * instancia** del servicio. Si cada modulo lo declarara como su propio
 * provider, habria dos instancias y los contadores se partirian en dos.
 */
@Module({
  providers: [ResilienceStateService],
  exports: [ResilienceStateService],
})
export class ResilienceStateModule {}
