import type { EmitirComprobanteDto } from '../dto/emitirComprobanteDto';

/** Resultado interno de la preparación transaccional. Nunca es un DTO HTTP.
 * El saldo se calcula bajo bloqueo del origen después de validar la entrada.
 * Los tipos se borran al compilar: no crean class fields en el DTO del cliente.
 */
export type PreparedEmission = EmitirComprobanteDto & {
  saldoNotaCalculado?: { antes: number; importe: number; restante: number };
};
