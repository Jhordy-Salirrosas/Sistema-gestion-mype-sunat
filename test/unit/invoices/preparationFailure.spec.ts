import { BadRequestException } from '@nestjs/common';
import { ErrorValidacionBloqueada } from '../../../src/modules/invoices/application/services/invoiceSendGate';
import { clasificarPreparacion, registrarEtapa } from '../../../src/modules/invoices/application/services/preparationFailure';
import { presentarResultado } from '../../../src/modules/invoices/application/services/invoiceResultPresentation';
import { InvoiceJobConsumer } from '../../../src/modules/invoices/invoiceJobConsumer';
import { CdrPersistenceService } from '../../../src/modules/sunat/cdr-persistence.service';

it.each([['GENERACION_UBL', 'DATOS_INVALIDOS', false], ['FIRMA', 'CERTIFICADO', true], ['CONFIGURACION_EMISOR', 'CONFIGURACION', true], ['PERSISTENCIA_XML', 'INFRAESTRUCTURA', true]] as const)('clasifica %s y sanea la causa', (etapa, categoria, recuperable) => {
  const error = etapa === 'GENERACION_UBL' ? new BadRequestException('SECRET_PASSWORD=secreto') : new Error('SECRET_PASSWORD=secreto');
  registrarEtapa(error, etapa);
  const causa = clasificarPreparacion(error);
  expect(causa).toMatchObject({ etapa, categoria, recuperable });
  expect(JSON.stringify(causa)).not.toContain('secreto');
  const h = [{ estado_nuevo: 'ERROR_RED', codigo_error: causa.codigo, mensaje_error: JSON.stringify(causa) }];
  expect(presentarResultado('ERROR_RED', null, h, false)).toMatchObject({ origen: 'PREPARACION_LOCAL', categoria, recuperable, motivo: expect.stringContaining('Bloqueado en preparación local') });
  expect(presentarResultado('ERROR_RED', null, h, true)?.origen).toBe('TRANSPORTE_INCIERTO');
  expect(presentarResultado('ACEPTADO', null, h, false)).toBeUndefined();
});
it('el worker persiste clasificación en historial y estado atómicos antes de relanzar; no despacha', async () => {
  const row = { id: 'nota', company_id: 'empresa', tipo_comprobante: '07', estado: 'ERROR_RED', payload_ubl: { tipoComprobante: '07', codigoMotivoNota: '06', descripcionMotivoNota: 'Devolución total' } };
  const history = jest.fn(async ({ data }) => data);
  const update = jest.fn(async () => row);
  const tx = { invoice: { update }, transactionHistory: { create: history } };
  const prisma = { invoice: { findUnique: jest.fn(async () => row) }, $transaction: jest.fn(async f => f(tx)) };
  const retry = { processWithRetry: jest.fn() };
  const consumer = new InvoiceJobConsumer({} as never, retry as never, prisma as never,
    { generateInvoiceXml: () => { throw new BadRequestException('token=secreto'); } } as never,
    {} as never, {} as never, {} as never, new CdrPersistenceService(prisma as never), {} as never, {} as never);
  await expect(consumer.procesar({ invoice_id: 'nota' })).rejects.toThrow('M1_PREPARATION_PENDING');
  expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  expect(update).toHaveBeenCalledWith(expect.objectContaining({ data: { estado: 'ERROR_RED' } }));
  expect(history.mock.calls[0][0].data.codigo_error).toBe('M1_PREPARATION_DATOS_INVALIDOS');
  expect(JSON.parse(history.mock.calls[0][0].data.mensaje_error)).toMatchObject({ etapa: 'GENERACION_UBL', recuperable: false });
  expect(history.mock.calls[0][0].data.mensaje_error).not.toContain('secreto');
  expect(retry.processWithRetry).not.toHaveBeenCalled();
});
it('una causa de transporte posterior impide revivir preparación antigua', () => {
  const causa = clasificarPreparacion(new BadRequestException());
  expect(presentarResultado('ERROR_RED', null, [
    { estado_nuevo: 'ERROR_RED', codigo_error: causa.codigo, mensaje_error: JSON.stringify(causa) },
    { estado_nuevo: 'ERROR_RED', codigo_error: 'NETWORK_ERROR', mensaje_error: 'Fallo de transporte posterior' },
  ], false)).toBeUndefined();
});

// El detalle técnico permanece en el historial, sin cambiar la presentación.
describe('diagnóstico de VALIDACION_LOCAL', () => {
  function local(error: unknown) {
    registrarEtapa(error, 'VALIDACION_LOCAL');
    return clasificarPreparacion(error);
  }
  it.each([
    'Ejecutor SFS excedió 20000 ms', 'Ejecutor SFS excedió 35000 ms',
    'Ejecutor Python SFS no disponible', 'Ejecutor SFS no completó la validación',
    'Ejecutor SFS no disponible', 'NO_CONCLUYENTE', 'BYPASS_NO_PERMITIDO',
    'VALIDACION_OFICIAL_NO_DISPONIBLE', 'SIN_MOTIVO', 'XML_NO_PERSISTIDO',
  ])('conserva el motivo conocido: %s', motivo => {
    const causa = local(new ErrorValidacionBloqueada('password=secreto <XML/>', motivo));
    expect(causa.detalleDiagnostico).toEqual({ claseError: 'ErrorValidacionBloqueada', motivo });
    const { detalleDiagnostico: _detalleDiagnostico, ...anterior } = causa;
    const history = (value: unknown) => [{ estado_nuevo: 'ERROR_RED', codigo_error: causa.codigo, mensaje_error: JSON.stringify(value) }];
    expect(presentarResultado('ERROR_RED', null, history(causa), false)).toEqual(presentarResultado('ERROR_RED', null, history(anterior), false));
    expect(JSON.stringify(causa)).not.toContain('secreto');
    expect(JSON.stringify(causa)).not.toContain('<XML');
  });
  it.each(['password=secreto', 'Ejecutor SFS excedió 20000 ms <XML/>', 'Ejecutor SFS excedió 2147483648 ms', 'Ejecutor SFS excedió 0 ms'])('no persiste un motivo fuera del vocabulario: %s', motivo => {
    expect(local(new ErrorValidacionBloqueada('mensaje arbitrario', motivo)).detalleDiagnostico).toEqual({
      claseError: 'ErrorValidacionBloqueada', motivo: 'MOTIVO_NO_CATALOGADO',
    });
  });
  it.each([new TypeError('payload=secreto'), new SyntaxError('XML=secreto'), new Error('SQL=secreto')])('conserva solo la clase para %s', error => {
    error.name = 'password=secreto';
    expect(local(error).detalleDiagnostico).toEqual({ claseError: Object.getPrototypeOf(error).constructor.name });
    expect(JSON.stringify(local(error))).not.toContain('secreto');
  });
  it('conserva clases propias sin mensajes ni propiedades adicionales', () => {
    class FalloPersistencia extends Error {}
    expect(local(new FalloPersistencia('token=secreto')).detalleDiagnostico).toEqual({ claseError: 'FalloPersistencia' });
  });
  it('omite nombres de clase no seguros', () => {
    const error = new Error('secreto');
    Object.setPrototypeOf(error, { ...Error.prototype, constructor: { name: 'XML=<datos>' } });
    // Mantener instanceof Error para comprobar el saneamiento del nombre.
    Object.setPrototypeOf(Object.getPrototypeOf(error), Error.prototype);
    expect(local(error).detalleDiagnostico).toEqual({ claseError: 'ErrorNoIdentificado' });
  });
  it('no agrega detalle en otras etapas ni serializa valores lanzados sin clase Error', () => {
    const error = new Error('secreto'); registrarEtapa(error, 'FIRMA');
    expect(clasificarPreparacion(error)).not.toHaveProperty('detalleDiagnostico');
    const plain = { payload: 'secreto' };
    expect(local(plain).detalleDiagnostico).toEqual({ claseError: 'ErrorNoIdentificado' });
  });
});
