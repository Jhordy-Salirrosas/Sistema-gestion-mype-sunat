import { InvoiceStatus } from '../../src/generated/client/enums';
/** Puerto transaccional del doble: el envío simulado ya produjo su estado final.
 * La exclusión y relectura reales se prueban en parte7-concurrencia.integration.
 */
export function withBridgeTransaction<T extends object>(prisma: T, estado = InvoiceStatus.ACEPTADO) {
 return { ...prisma, $transaction: jest.fn(async (work: (tx: unknown) => unknown) => work({
  $executeRaw: jest.fn(), invoice: { findUnique: jest.fn(async () => ({ estado })) },
 })) };
}
