import { SunatBillService } from '../../../src/modules/sunat/sunat-bill.service';
import { CdrPersistenceService } from '../../../src/modules/sunat/cdr-persistence.service';
import { paramsBase } from '../resilience/invoiceRetryTestSupport';
function harness() {
  const prisma = { invoice: { findUniqueOrThrow: jest.fn(async () => ({ company_id: 'empresa', estado: 'EN_COLA' })) }, transactionHistory: { create: jest.fn(async () => ({})) } };
  const persistence = new CdrPersistenceService(prisma as never);
  jest.spyOn(persistence, 'persistFailure').mockResolvedValue({} as never);
  const sendBill = jest.fn(async () => ({ applicationResponse: null, tiempoRespuestaMs: 2 }));
  return { prisma, persistence, sendBill, service: new SunatBillService(persistence, { sendBill } as never) };
}
it('confirma inicio durable antes del cliente SOAP también en flujo normal', async () => {
  const h = harness(); await h.service.sendAndProcess(paramsBase);
  expect(h.prisma.transactionHistory.create.mock.invocationCallOrder[0]).toBeLessThan(h.sendBill.mock.invocationCallOrder[0]);
  expect(h.prisma.transactionHistory.create).toHaveBeenCalledWith({ data: expect.objectContaining({ invoice_id: paramsBase.invoiceId, company_id: 'empresa', intento: 1, estado_anterior: 'EN_COLA', estado_nuevo: 'EN_COLA', codigo_error: 'M1_TRANSPORT_STARTED', http_status_code: null }) });
});
it('auditoría de inicio fallida impide abrir conexión y no simula resultado de red', async () => {
  const h = harness(); h.prisma.transactionHistory.create.mockRejectedValue(new Error('DB local caída') as never);
  await expect(h.service.sendAndProcess(paramsBase)).rejects.toThrow('DB local caída');
  expect(h.sendBill).not.toHaveBeenCalled(); expect(h.persistence.persistFailure).not.toHaveBeenCalled();
});
it('conserva número de intento y el estado real sin sobrescribir la factura', async () => {
  const h = harness(); await h.persistence.registrarInicioTransporte({ invoiceId: 'id', intento: 3 });
  expect(h.prisma.transactionHistory.create).toHaveBeenCalledWith({ data: expect.objectContaining({ invoice_id: 'id', intento: 3, estado_nuevo: 'EN_COLA' }) });
});
