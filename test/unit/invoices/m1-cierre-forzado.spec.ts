import { InvoiceForcedResendService, FORCE_AUTH, FORCE_USED } from '../../../src/modules/invoices/application/services/invoiceForcedResendService';
import { InvoiceRetryService } from '../../../src/modules/resilience/infrastructure/queue/invoiceRetryService';
import { ResilienceStateService } from '../../../src/modules/resilience/application/resilienceStateService';
import { falloDeRed, paramsBase } from '../resilience/invoiceRetryTestSupport';
function harness() {
 const row = { id: paramsBase.invoiceId, company_id: 'empresa', estado: 'ERROR_RED', transport_uncertain: true, cdr_sunat: null };
 const history: any[] = []; let serial = Promise.resolve();
 const tx = { $queryRaw: jest.fn(async () => []), invoice: { findFirst: jest.fn(async ({ where }: any) => where.company_id === row.company_id ? row : null), findUnique: jest.fn(async () => row), findUniqueOrThrow: jest.fn(async () => row), update: jest.fn(async ({ data }: any) => Object.assign(row, data)) },
 transactionHistory: { findMany: jest.fn(async () => history), create: jest.fn(async ({ data }: any) => { const e = { ...data, id: `event-${history.length}`, created_at: new Date() }; history.push(e); return e; }) } };
 const prisma = { ...tx, $transaction: jest.fn((fn: any) => { const result = serial.then(() => fn(tx)); serial = result.catch(() => undefined); return result; }) };
 let active = false;
 const queue = { reenqueueInvoiceIfIdle: jest.fn(async (_id, _company, guard) => { expect(history.some(h => h.codigo_error === FORCE_AUTH)).toBe(true); expect(row.transport_uncertain).toBe(true); if (active) return { estado: 'YA_EN_COLA' }; if (!await guard()) return { estado: 'ESTADO_NO_PERMITIDO' }; active = true; return { estado: 'ENCOLADO' }; }) };
 const service = new InvoiceForcedResendService(prisma as never, queue as never);
 const autorizar = (body: unknown = { motivo: 'Decisión explícita de prueba', confirmado: true, decisionId: 'decision-prueba-0001' }, actor = { sub: 'admin', role: 'ADMIN' }, company = 'empresa') => service.autorizar(company, row.id, actor, body);
 return { row, history, tx, prisma, queue, service, autorizar };
}
it('6I registra quién y motivo antes de publicar; segunda acción activa no duplica autorización', async () => {
 const h = harness(); const results = await Promise.all([h.autorizar(), h.autorizar()]);
 expect(results.map(r => r.resultadoCola)).toEqual(['ENCOLADO','YA_EN_COLA']); expect(h.history.filter(e => e.codigo_error === FORCE_AUTH)).toHaveLength(1);
 expect(JSON.parse(h.history[0].mensaje_error)).toMatchObject({ usuarioId: 'admin', motivo: 'Decisión explícita de prueba' }); expect(h.tx.$queryRaw).toHaveBeenCalled();
});
it.each([{}, { motivo: ' ', confirmado: true }, { motivo: 'Motivo' }, { motivo: 'Motivo', confirmado: false }])('6I bloquea motivo/confirmación ausentes %#', async body => {
 const h = harness(); await expect(h.autorizar(body)).rejects.toThrow(); expect(h.queue.reenqueueInvoiceIfIdle).not.toHaveBeenCalled();
});
it('6I no ADMIN y empresa ajena están protegidos', async () => {
 const h = harness(); await expect(h.autorizar(undefined, { sub: 'op', role: 'OPERADOR_FACTURACION' })).rejects.toThrow('Solo ADMIN');
 await expect(h.autorizar(undefined, undefined, 'otra')).rejects.toThrow('no encontrado'); expect(h.history).toHaveLength(0);
});
it.each(['ACEPTADO','OBSERVADO','RECHAZADO','ANULADO'])('6I protege estado %s', async estado => {
 const h = harness(); h.row.estado = estado; await expect(h.autorizar()).rejects.toThrow('Solo se admite'); expect(h.history).toHaveLength(0);
});
it('6I consumo único habilita un intento sin consulta; otro timeout vuelve a conciliar', async () => {
 const h = harness(); await h.autorizar(); expect(await h.service.consumir(h.row.id)).toBe(true); expect(await h.service.consumir(h.row.id)).toBe(false);
 expect(h.history.filter(e => e.codigo_error === FORCE_USED)).toHaveLength(1);
 const consulta = { consultarEstado: jest.fn(async () => ({ tipo: 'INCIERTO', motivo: 'Beta sin CDR' })) };
 const sunat = { sendAndProcess: jest.fn(async () => { expect(h.row.transport_uncertain).toBe(true); return falloDeRed(); }) }, dlq = { enviar: jest.fn() };
 const retry = new InvoiceRetryService(dlq as never, sunat as never, new ResilienceStateService(), undefined, consulta as never, h.prisma as never);
 expect(await retry.processWithRetry(paramsBase)).toMatchObject({ incertidumbreTransporte: true, enviadoADlq: false, intentos: 1 });
 expect(sunat.sendAndProcess).toHaveBeenCalledTimes(1); expect(consulta.consultarEstado).toHaveBeenCalledTimes(1); expect(h.row.transport_uncertain).toBe(true);
 expect(await h.service.consumir(h.row.id)).toBe(false); expect(dlq.enviar).not.toHaveBeenCalled();
});
it('6I sin decisión no modifica incertidumbre ni flujo automático', async () => {
 const h = harness(); expect(await h.service.consumir(h.row.id)).toBe(false); expect(h.tx.invoice.update).not.toHaveBeenCalled();
});
it('6I publicación fallida conserva constancia durable recuperable', async () => {
 const h = harness(); h.queue.reenqueueInvoiceIfIdle.mockRejectedValueOnce(new Error('cola caída'));
 await expect(h.autorizar()).rejects.toThrow('cola caída'); expect(h.history).toHaveLength(1); expect(h.row.transport_uncertain).toBe(true);
 expect(await h.autorizar()).toMatchObject({ autorizacionId: h.history[0].id, resultadoCola: 'ENCOLADO' });
});

it('7J replay consumido no crea ni publica una segunda autorización', async () => {
 const h = harness(); await h.autorizar(); await h.service.consumir(h.row.id);
 const calls = h.queue.reenqueueInvoiceIfIdle.mock.calls.length;
 expect(await h.autorizar()).toMatchObject({ resultadoCola: 'AUTORIZACION_CONSUMIDA' });
 expect(h.history.filter(e => e.codigo_error === FORCE_AUTH)).toHaveLength(1);
 expect(h.queue.reenqueueInvoiceIfIdle).toHaveBeenCalledTimes(calls);
});
it('7J otra decisión exige renovar explícitamente la constancia consumida', async () => {
 const h = harness(); const first = await h.autorizar(); await h.service.consumir(h.row.id); h.row.transport_uncertain = true;
 const body = { motivo: 'Nueva decisión humana', confirmado: true, decisionId: 'decision-prueba-0002' };
 expect(await h.autorizar(body)).toMatchObject({ resultadoCola: 'REQUIERE_NUEVA_DECISION' });
 expect(h.history.filter(e => e.codigo_error === FORCE_AUTH)).toHaveLength(1);
 await h.autorizar({ ...body, renovarAutorizacionId: first.autorizacionId });
 expect(h.history.filter(e => e.codigo_error === FORCE_AUTH)).toHaveLength(2);
});
it('7J una clave de decisión no admite otro motivo', async () => {
 const h = harness(); await h.autorizar();
 await expect(h.autorizar({ motivo: 'Distinto', confirmado: true, decisionId: 'decision-prueba-0001' })).rejects.toThrow('DECISION_REUSED');
});
