import { presentarResultado } from '../../../src/modules/invoices/application/services/invoiceResultPresentation';
const evento = (mensaje_error: string, codigo_error = '3128', created_at = new Date('2026-11-10')) => ({ estado_nuevo: 'RECHAZADO', mensaje_error, codigo_error, created_at });
it.each(['3128: PaymentMeansID Contado', 'XSD: DebitNoteTypeCode no esperado'])('identifica bloqueo local %s desde evidencia persistida, no por el código', detalle => {
  expect(presentarResultado('RECHAZADO', null, [evento(`Bloqueado antes de enviar por la validación XSL: ${detalle}`)])).toMatchObject({ origen: 'VALIDACION_LOCAL', motivo: expect.stringContaining(detalle) });
});
it('CDR real posterior prevalece sobre un bloqueo local antiguo', () => {
  expect(presentarResultado('RECHAZADO', { codigo: '3128', descripcion: 'Rechazo real' }, [evento('Validación XSL local: error')])).toEqual({ origen: 'SUNAT', codigo: '3128', motivo: 'Rechazo real' });
});
it('distingue SOAP Fault real sin CDR y no confunde falta de CDR con bloqueo local', () => {
  expect(presentarResultado('RECHAZADO', null, [evento('SOAP Fault del billService [2335]: documento duplicado', '2335')])?.origen).toBe('SUNAT');
  expect(presentarResultado('RECHAZADO', null, [evento('Rechazo sin origen registrado')])?.origen).toBe('NO_DETERMINADO');
  expect(presentarResultado('RECHAZADO', null)?.origen).toBe('NO_DETERMINADO');
});
it('respeta orden temporal y no revive un bloqueo antiguo tras una decisión posterior distinta', () => {
  const viejo = evento('Validación XSL local: error', '3128', new Date('2026-11-09'));
  const nuevo = evento('SOAP Fault del billService [2335]: duplicado', '2335');
  expect(presentarResultado('RECHAZADO', null, [nuevo, viejo])?.origen).toBe('SUNAT');
  expect(presentarResultado('RECHAZADO', null, [viejo, evento('Resultado sin origen explícito')])?.origen).toBe('NO_DETERMINADO');
  expect(presentarResultado('RECHAZADO', null, [viejo, evento('Rescate manual F001: ENCOLADO')])?.origen).toBe('VALIDACION_LOCAL');
});
it.each(['ACEPTADO', 'OBSERVADO', 'EN_COLA', 'ERROR_RED', 'ANULADO'])('un evento antiguo no cambia la lectura actual %s', estado => {
  expect(presentarResultado(estado, null, [evento('Validación XSL local: error')])).toBeUndefined();
});

it('incertidumbre se presenta con motivo sin convertirla en rechazo ni ausencia', () => {
  const history = [{ estado_nuevo: 'ERROR_RED', codigo_error: 'M1_TRANSPORT_UNCERTAIN', mensaje_error: 'Incertidumbre de transporte: Beta sin CDR', created_at: new Date('2026-11-10') }];
  expect(presentarResultado('ERROR_RED', null, history, true)).toEqual({ origen: 'TRANSPORTE_INCIERTO', codigo: 'M1_TRANSPORT_UNCERTAIN', motivo: history[0].mensaje_error });
  expect(presentarResultado('ENVIADO', null, [], true)?.motivo).toContain('consultar antes de reenviar');
  expect(presentarResultado('ACEPTADO', null, history, true)).toBeUndefined();
  expect(presentarResultado('ERROR_RED', null, history, false)).toBeUndefined();
});
