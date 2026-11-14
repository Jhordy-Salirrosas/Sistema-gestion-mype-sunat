import { factura57, historialReal57 } from '../../fixtures/f001-57-transport-history';
import { InvoiceRetryService } from '../../../src/modules/resilience/infrastructure/queue/invoiceRetryService';
import { ResilienceStateService } from '../../../src/modules/resilience/application/resilienceStateService';
import { clasificarTransporte, resumirTransporte, type EventoTransporte } from '../../../src/modules/invoices/application/services/invoiceTransportEvidence';
import { aceptado, falloDeRed, paramsBase, rechazoDeNegocio } from '../resilience/invoiceRetryTestSupport';

const evento = (codigo_error: string | null, mensaje_error: string | null = null, day = 5): EventoTransporte => ({
  created_at: new Date(`2026-11-${day.toString().padStart(2, '0')}T12:00:00Z`), codigo_error, mensaje_error,
  estado_nuevo: 'ENVIADO', tiempo_respuesta_ms: null, http_status_code: null,
});
const bloqueo = evento('3128', 'Bloqueado antes de enviar por la validación XSL: 3128');
const inicio = evento('M1_TRANSPORT_STARTED', null, 6);
function harness(history: EventoTransporte[] = [inicio], uncertain: boolean | null = true) {
  const row = { transport_uncertain: uncertain, estado: 'ENVIADO', company_id: 'empresa' };
  const prisma = { invoice: {
    findUnique: jest.fn(async () => ({ ...row })), findUniqueOrThrow: jest.fn(async () => ({ ...row })),
    update: jest.fn(async ({ data }: any) => Object.assign(row, data)),
  }, transactionHistory: {
    findMany: jest.fn(async () => history), create: jest.fn(async ({ data }: any) => data),
  } };
  const consulta = { consultarEstado: jest.fn() };
  const sunat = { sendAndProcess: jest.fn(async () => aceptado()) };
  const dlq = { enviar: jest.fn() }, sleep = jest.fn(async () => undefined);
  const state = new ResilienceStateService();
  const service = new InvoiceRetryService(dlq as never, sunat as never, state, sleep, consulta, prisma as never);
  return { row, prisma, consulta, sunat, dlq, sleep, state, service };
}
it('bloqueo previo probado y marcador presunto permite envío sin consulta', async () => {
  const h = harness([bloqueo, evento(null, 'Rescate manual F001-00000057: ENCOLADO.', 10)]);
  const result = await h.service.processWithRetry(paramsBase);
  expect(result.estado).toBe('ACEPTADO');
  expect(h.consulta.consultarEstado).not.toHaveBeenCalled();
  expect(h.sunat.sendAndProcess).toHaveBeenCalledTimes(1);
  expect(h.prisma.transactionHistory.findMany).toHaveBeenCalledWith({ where: { invoice_id: paramsBase.invoiceId }, orderBy: { created_at: 'asc' } });
});
it('envío real + existe concilia sin reenviar', async () => {
  const h = harness();
  h.consulta.consultarEstado.mockResolvedValue({ tipo: 'RECUPERADO', resultado: { ...aceptado(), cdr: { responseCode: '0' } } });
  expect(await h.service.processWithRetry(paramsBase)).toMatchObject({ estado: 'ACEPTADO', intentos: 0, enviadoADlq: false });
  expect(h.row.transport_uncertain).toBe(false);
  expect(h.sunat.sendAndProcess).not.toHaveBeenCalled();
});
it('envío real + ausencia confirmada reenvía con marcador previo', async () => {
  const h = harness(); h.consulta.consultarEstado.mockResolvedValue({ tipo: 'NO_ENCONTRADO' });
  h.sunat.sendAndProcess.mockImplementation(async () => { expect(h.row.transport_uncertain).toBe(true); return aceptado(); });
  expect((await h.service.processWithRetry(paramsBase)).estado).toBe('ACEPTADO');
  expect(h.consulta.consultarEstado.mock.invocationCallOrder[0]).toBeLessThan(h.sunat.sendAndProcess.mock.invocationCallOrder[0]);
});
it('envío real + inconclusa queda accionable sin consumir envío ni DLQ', async () => {
  const h = harness(); h.consulta.consultarEstado.mockResolvedValue({ tipo: 'INCIERTO', motivo: 'Beta sin CDR' });
  expect(await h.service.processWithRetry(paramsBase)).toMatchObject({ estado: 'ENVIADO', intentos: 0, reintentable: true, enviadoADlq: false, circuitoAbierto: false, incertidumbreTransporte: true, error: 'Incertidumbre de transporte: Beta sin CDR' });
  expect(h.sunat.sendAndProcess).not.toHaveBeenCalled(); expect(h.dlq.enviar).not.toHaveBeenCalled(); expect(h.sleep).not.toHaveBeenCalled();
  expect(h.row.transport_uncertain).toBe(true);
  expect(h.prisma.transactionHistory.create).toHaveBeenCalledWith({ data: expect.objectContaining({ codigo_error: 'M1_TRANSPORT_UNCERTAIN', intento: 0, estado_nuevo: 'ENVIADO' }) });
  expect(h.state.reservarEnvio()).toBe(true); // la consulta liberó el permiso
});
it('flujo normal sin incertidumbre permanece sin consulta', async () => {
  const h = harness([], false); expect((await h.service.processWithRetry(paramsBase)).estado).toBe('ACEPTADO');
  expect(h.consulta.consultarEstado).not.toHaveBeenCalled(); expect(h.prisma.transactionHistory.findMany).not.toHaveBeenCalled();
});
it('historial ambiguo no autoriza envío ciego', async () => {
  const h = harness([evento(null, 'Rescate manual F001-00000057: ENCOLADO.', 10)]);
  h.consulta.consultarEstado.mockResolvedValue({ tipo: 'INCIERTO', motivo: 'Sin evidencia suficiente' });
  expect((await h.service.processWithRetry(paramsBase)).incertidumbreTransporte).toBe(true);
  expect(h.sunat.sendAndProcess).not.toHaveBeenCalled(); expect(h.dlq.enviar).not.toHaveBeenCalled();
});
it('bloqueo seguido de inicio real conserva consulta obligatoria', async () => {
  const h = harness([bloqueo, inicio]); h.consulta.consultarEstado.mockResolvedValue({ tipo: 'INCIERTO', motivo: 'Timeout de consulta' });
  expect((await h.service.processWithRetry(paramsBase)).incertidumbreTransporte).toBe(true);
  expect(h.consulta.consultarEstado).toHaveBeenCalledTimes(1); expect(h.sunat.sendAndProcess).not.toHaveBeenCalled();
});
it('inconclusa inmediatamente después del timeout no genera segundo envío ni fallo DLQ', async () => {
  const h = harness([], false); h.sunat.sendAndProcess.mockResolvedValue(falloDeRed());
  h.consulta.consultarEstado.mockResolvedValue({ tipo: 'INCIERTO', motivo: 'SUNAT respondió sin CDR' });
  expect(await h.service.processWithRetry(paramsBase)).toMatchObject({ estado: 'ENVIADO', intentos: 1, incertidumbreTransporte: true, enviadoADlq: false, reintentable: true });
  expect(h.sunat.sendAndProcess).toHaveBeenCalledTimes(1); expect(h.sleep).not.toHaveBeenCalled(); expect(h.dlq.enviar).not.toHaveBeenCalled();
  expect(h.row.transport_uncertain).toBe(true);
});
it('puerto que lanza o responde sin CDR no se convierte en ausencia', async () => {
  for (const respuesta of ['throw', 'sin-cdr', 'provisional', 'invalid'] as const) {
    const h = harness();
    if (respuesta === 'throw') h.consulta.consultarEstado.mockRejectedValue(new Error('secreto-no-exponer'));
    else h.consulta.consultarEstado.mockResolvedValue(respuesta === 'invalid' ? null : { tipo: 'RECUPERADO', resultado: { ...falloDeRed(), cdr: respuesta === 'provisional' ? { responseCode: '99' } : null } });
    const result = await h.service.processWithRetry(paramsBase);
    expect(result.incertidumbreTransporte).toBe(true); expect(result.error).not.toContain('secreto-no-exponer');
    expect(h.sunat.sendAndProcess).not.toHaveBeenCalled(); expect(h.dlq.enviar).not.toHaveBeenCalled();
  }
});
it('rechazo normal conserva la decisión de no reintentar', async () => {
  const h = harness([], false); h.sunat.sendAndProcess.mockResolvedValue(rechazoDeNegocio());
  expect(await h.service.processWithRetry(paramsBase)).toMatchObject({ estado: 'RECHAZADO', reintentable: false });
  expect(h.dlq.enviar).not.toHaveBeenCalled();
});
it.each([
  [[], 'EVIDENCIA_INSUFICIENTE'], [[bloqueo], 'BLOQUEO_PREVIO_PROBADO'], [[inicio], 'ENVIO_INCIERTO'],
  [[bloqueo, inicio], 'ENVIO_INCIERTO'], [[bloqueo, { ...inicio, created_at: bloqueo.created_at }], 'ENVIO_INCIERTO'],
  [[bloqueo, evento('TRANSPORT_ERROR', null, 6)], 'ENVIO_INCIERTO'],
  [[bloqueo, evento('M1_TRANSPORT_UNCERTAIN', 'Consulta sin CDR', 10)], 'BLOQUEO_PREVIO_PROBADO'],
  [[inicio, { ...evento('0', 'Aceptado', 7), estado_nuevo: 'ACEPTADO', http_status_code: 200 }], 'EVIDENCIA_INSUFICIENTE'],
] as [EventoTransporte[], string][])('clasifica evidencia sin confundir consulta con transporte %#', (history, expected) => {
  expect(clasificarTransporte(history)).toBe(expected);
});

it('historial REAL F001-57 es insuficiente: consulta inconclusa añade pendiente, no inventa bloqueo ni envío', async () => {
  expect(clasificarTransporte(historialReal57)).toBe('EVIDENCIA_INSUFICIENTE');
  expect(historialReal57).toHaveLength(3);
  const h = harness(historialReal57); h.row.estado = factura57.estado;
  h.consulta.consultarEstado.mockResolvedValue({ tipo: 'INCIERTO', motivo: 'Beta sin CDR' });
  const result = await h.service.processWithRetry({ ...paramsBase, invoiceId: factura57.id, correlativo: 57, estadoActual: 'ERROR_RED' });
  expect(result).toMatchObject({ estado: 'ERROR_RED', intentos: 0, reintentable: true, enviadoADlq: false, incertidumbreTransporte: true });
  expect(h.sunat.sendAndProcess).not.toHaveBeenCalled(); expect(h.dlq.enviar).not.toHaveBeenCalled();
  const nuevo = h.prisma.transactionHistory.create.mock.calls[0][0].data;
  expect(nuevo).toMatchObject({ invoice_id: factura57.id, codigo_error: 'M1_TRANSPORT_UNCERTAIN', intento: 0 });
  expect(clasificarTransporte([...historialReal57, { ...nuevo, created_at: new Date('2026-11-10T18:00:00Z') }])).toBe('EVIDENCIA_INSUFICIENTE');
});

it('sin puerto de consulta queda incierto y recuperable, nunca reenvía', async () => {
  const dlq = { enviar: jest.fn() }, sunat = { sendAndProcess: jest.fn() };
  const service = new InvoiceRetryService(dlq as never, sunat as never, new ResilienceStateService());
  expect(await service.processWithRetry({ ...paramsBase, estadoActual: 'ENVIADO' })).toMatchObject({ incertidumbreTransporte: true, intentos: 0, reintentable: true, enviadoADlq: false });
  expect(sunat.sendAndProcess).not.toHaveBeenCalled(); expect(dlq.enviar).not.toHaveBeenCalled();
});

it.each(['M1_TRANSPORT_STARTED','TRANSPORT_ERROR'])('C1 bloqueo posterior no degrada %s ni permite envío ciego', async code => {
 const h = harness([evento(code, null, 5), { ...bloqueo, created_at: new Date('2026-11-10') }]);
 h.consulta.consultarEstado.mockResolvedValue({ tipo: 'INCIERTO', motivo: 'Pendiente' });
 expect(clasificarTransporte(await h.prisma.transactionHistory.findMany())).toBe('ENVIO_INCIERTO');
 expect((await h.service.processWithRetry(paramsBase)).incertidumbreTransporte).toBe(true);
 expect(h.sunat.sendAndProcess).not.toHaveBeenCalled();
});

it('C1 consulta incierta no prueba envío; una resolución concluyente no borra evidencia histórica', () => {
 expect(resumirTransporte([evento('M1_TRANSPORT_UNCERTAIN')])).toMatchObject({ envioAcreditado: false, incertidumbrePendiente: false });
 const final = { ...evento('0', 'CDR', 8), estado_nuevo: 'ACEPTADO', http_status_code: 200 };
 expect(resumirTransporte([inicio, final, { ...bloqueo, created_at: new Date('2026-11-10') }])).toMatchObject({ envioAcreditado: true, incertidumbrePendiente: false, bloqueoPrevioProbado: false });
});
