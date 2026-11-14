import { InvoiceQueryService } from '../../../src/modules/invoices/application/services/invoiceQueryService';
import { clasificarReintentoMasivo } from '../../../src/modules/invoices/application/services/invoiceBatchRetryService';
import { InvoiceSunatConsultController } from '../../../src/modules/invoices/infrastructure/controllers/invoiceSunatConsultController';
import { resumirTransporte } from '../../../src/modules/invoices/application/services/invoiceTransportEvidence';

const evento = (codigo_error: string, mensaje_error: string, estado_nuevo = 'ERROR_RED') => ({ codigo_error, mensaje_error, estado_nuevo, created_at: new Date(), tiempo_respuesta_ms: null, http_status_code: null });
const fila = (extra = {}) => ({ id: 'i', serie: 'F001', correlativo: 1, estado: 'ERROR_RED', transport_uncertain: false, cdr_sunat: null, history: [], ...extra });
function harness(row: ReturnType<typeof fila>) {
  const db = { invoice: { findFirst: jest.fn(async () => row), findUnique: jest.fn(async () => row), updateMany: jest.fn() }, auditLog: { create: jest.fn() }, transactionHistory: { create: jest.fn() } };
  const queue = { reenqueueInvoiceIfIdle: jest.fn(async (_id, _company, permitido) => ({ estado: await permitido() ? 'ENCOLADO' : 'ESTADO_NO_PERMITIDO' })) };
  return { db, queue, service: new InvoiceQueryService(db as never, queue as never) };
}
it.each([
  fila({ transport_uncertain: true }),
  fila({ estado: 'RECHAZADO', cdr_sunat: { responseCode: '3105' } }),
  fila({ estado: 'RECHAZADO', history: [evento('3236', 'Validación XSL local: error', 'RECHAZADO')] }),
  fila({ history: [evento('M1_PREPARATION_DATOS_INVALIDOS', '{"recuperable":false}')] }),
  fila({ history: [evento('M1_PREPARATION_DATOS_INVALIDOS', 'JSON inválido')] }),
  fila({ estado: 'PROCESANDO' }),
  fila({ estado: 'ACEPTADO' }),
  fila(),
  fila({ estado: 'ENVIADO' }),
  fila({ estado: 'PENDIENTE' }),
  fila({ estado: 'EN_COLA' }),
  fila({ history: [evento('M1_PREPARATION_CERTIFICADO', '{"recuperable":true}')] }),
])('individual y masivo comparten decisión: %j', async row => {
  const h = harness(row);
  const elegible = clasificarReintentoMasivo(row as never).resultado === 'ELEGIBLE';
  expect((await h.service.reintentarCdr('c', 'i')).encolado).toBe(elegible);
  expect(h.queue.reenqueueInvoiceIfIdle).toHaveBeenCalledTimes(elegible ? 1 : 0);
  if (!elegible) expect(h.db.invoice.updateMany).not.toHaveBeenCalled();
});
it.each(['ERROR_RED', 'PENDIENTE'])('relee la compuerta antes de publicar desde %s', async estado => {
  const h = harness(fila({ estado }));
  const bloqueado = fila({ estado, history: [evento('M1_PREPARATION_DATOS_INVALIDOS', '{}')] });
  h.db.invoice.findFirst.mockResolvedValueOnce(fila({ estado })).mockResolvedValue(bloqueado);
  h.db.invoice.findUnique.mockResolvedValue(bloqueado);
  expect((await h.service.reintentarCdr('c', 'i')).encolado).toBe(false);
  expect(h.db.invoice.updateMany).not.toHaveBeenCalled();
});
it.each([
  fila(),
  fila({ transport_uncertain: null, history: [evento('3236', 'Validación XSL local: error', 'RECHAZADO'), evento('M1_TRANSPORT_UNCERTAIN', 'Consulta fallida')] }),
])('consulta sin transmisión probada no crea incertidumbre ni llama a SUNAT: %j', async row => {
  const consultar = jest.fn();
  const db = { invoice: { findFirst: jest.fn(async () => row), updateMany: jest.fn() } };
  const controller = new InvoiceSunatConsultController(db as never, { consultar } as never);
  expect(await controller.consultar('c', 'i')).toMatchObject({ tipo: 'SIN_TRANSMISION' });
  expect(consultar).not.toHaveBeenCalled(); expect(db.invoice.updateMany).not.toHaveBeenCalled();
});
it('una consulta aislada no acredita ni vuelve incierto el transporte', () => {
  expect(resumirTransporte([evento('M1_TRANSPORT_UNCERTAIN', 'Consulta fallida')])).toMatchObject({ envioAcreditado: false, incertidumbrePendiente: false });
  expect(resumirTransporte([evento('M1_TRANSPORT_STARTED', 'Inicio'), evento('M1_TRANSPORT_UNCERTAIN', 'Consulta fallida')])).toMatchObject({ envioAcreditado: true, incertidumbrePendiente: true });
});
