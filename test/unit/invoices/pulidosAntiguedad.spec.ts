import { calcularAntiguedadEnvio } from '../../../src/modules/invoices/application/services/invoiceSendAge';
import { InvoiceAlertService } from '../../../src/modules/invoices/application/services/invoiceAlertService';
const fila = (id: string, tipo = '01', fecha = '2026-11-10', estado = 'PENDIENTE') => ({ id, tipo_comprobante: tipo, serie: tipo === '03' ? 'B001' : 'F001', correlativo: Number(id), fecha_emision: new Date(fecha + 'T00:00:00Z'), estado });
afterEach(() => jest.restoreAllMocks());
it.each([['01', '2026-11-10'], ['03', '2026-11-06']])('%s: ventana civil exacta termina hoy y mañana queda vencida', (tipo, fecha) => {
  expect(calcularAntiguedadEnvio([fila('1', tipo, fecha)], '2026-11-13').documentos[0]).toMatchObject({ fechaEmision: fecha, fechaLimite: '2026-11-13', diasRestantes: 0 });
  expect(calcularAntiguedadEnvio([fila('1', tipo, fecha)], '2026-11-14').documentos[0].diasRestantes).toBe(-1);
});
it('usa hoy en Lima sin desplazar el día de emisión persistido a la víspera', () => {
  jest.spyOn(Date, 'now').mockReturnValue(Date.parse('2026-11-14T04:59:59Z'));
  expect(calcularAntiguedadEnvio([fila('1')]).documentos[0].diasRestantes).toBe(0);
});
it('ordena por urgencia de ambas ventanas y conserva estados pendientes o en error', () => {
  const r = calcularAntiguedadEnvio([fila('1', '01', '2026-11-13'), fila('2', '03', '2026-11-01', 'RECHAZADO'), fila('3', '01', '2026-11-10', 'ERROR_RED')], '2026-11-13');
  expect(r.documentos.map(d => [d.id, d.diasRestantes])).toEqual([['2', -5], ['3', 0], ['1', 3]]); expect(r.gravedad).toBe('CRITICO');
  expect(calcularAntiguedadEnvio([fila('1', '03', '2026-11-13')], '2026-11-13').gravedad).toBe('AVISO');
});
it('excluye aceptados, observados, anulados y tipos sin ventana definida', () => {
  const r = calcularAntiguedadEnvio([fila('1', '01', '2026-11-10', 'ACEPTADO'), fila('2', '03', '2026-11-06', 'OBSERVADO'), fila('3', '01', '2026-11-01', 'ANULADO'), fila('4', '07')], '2026-11-13');
  expect(r).toMatchObject({ evaluado: true, gravedad: 'OK', documentos: [] });
});
it('consulta solo documentos de la empresa, incluye la alerta en estado y no escribe', async () => {
  const db = { invoice: { findMany: jest.fn(async () => [fila('1')]), update: jest.fn(), create: jest.fn() } };
  const s = new InvoiceAlertService({ inspectCertificate: () => ({ validFrom: new Date('2020-01-01'), validTo: new Date('2030-01-01') }) } as never, { countDlq: async () => 0, countDlqHuerfanos: async () => 0 } as never, undefined, db as never);
  const r = await s.estado('empresa-a');
  expect(r.antiguedad.documentos).toHaveLength(1);
  expect(db.invoice.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { company_id: 'empresa-a', tipo_comprobante: { in: ['01', '03'] }, estado: { in: expect.arrayContaining(['PENDIENTE', 'ERROR_RED']) } } }));
  expect(db.invoice.update).not.toHaveBeenCalled(); expect(db.invoice.create).not.toHaveBeenCalled();
});
it('fallo o empresa ausente se informa como no evaluado, nunca como lista vacía certificada', async () => {
  const findMany = jest.fn().mockRejectedValue(Error('sin base'));
  const s = new InvoiceAlertService({} as never, {} as never, undefined, { invoice: { findMany } } as never);
  expect(await s.estadoAntiguedad('')).toMatchObject({ evaluado: false, gravedad: 'SIN_DATOS' }); expect(findMany).not.toHaveBeenCalled();
  expect(await s.estadoAntiguedad('empresa-a')).toMatchObject({ evaluado: false, gravedad: 'SIN_DATOS', documentos: [] });
});
