import { aHistorial } from '../../../src/modules/invoices/application/services/invoiceQueryMapper';
const event = (mensaje: string) => [{ id: 'h', codigo_error: 'M1_DETRACTION_DEPOSIT', mensaje_error: mensaje, created_at: new Date('2026-11-01') }];
it('detalle presenta actor y ambos valores del depósito de forma legible', () => {
 const result = aHistorial(event(JSON.stringify({ accion: 'Depósito actualizado', actor: 'usuario', anterior: { fecha: '2026-11-01', monto: 10, constancia: 'ABC' }, nuevo: { fecha: '2026-11-02', monto: 20, constancia: '002' } })) as never);
 expect(result[0].mensaje_error).toBe('Depósito actualizado. Usuario: usuario. Anterior: fecha 2026-11-01, monto 10, constancia ABC. Nuevo: fecha 2026-11-02, monto 20, constancia 002.');
});
it('conserva evidencia antigua incluso si no tiene JSON legible', () => {
 expect(aHistorial(event('histórico') as never)[0].mensaje_error).toBe('histórico');
});

it('el historial local no oculta el rechazo fiscal ni el bloqueo de reintento', () => {
 const { presentarResultado } = require('../../../src/modules/invoices/application/services/invoiceResultPresentation');
 const { ultimoErrorDelHistorial } = require('../../../src/modules/invoices/application/services/invoiceQueryMapper');
 const { clasificarReintentoMasivo } = require('../../../src/modules/invoices/application/services/invoiceBatchRetryService');
 const fiscal = { estado_nuevo: 'RECHAZADO', codigo_error: '2992', mensaje_error: 'SOAP Fault del billService: rechazo', created_at: new Date('2026-11-01') };
 const local = { estado_nuevo: 'RECHAZADO', codigo_error: 'M1_DETRACTION_DEPOSIT', mensaje_error: '{}', created_at: new Date('2026-11-02') };
 expect(presentarResultado('RECHAZADO', null, [fiscal, local])).toMatchObject({ origen: 'SUNAT', codigo: '2992' });
 expect(ultimoErrorDelHistorial([fiscal, local])).toMatchObject({ ultimo_error_codigo: '2992' });
 const preparation = {...fiscal, estado_nuevo: 'ERROR_RED', codigo_error: 'M1_PREPARATION_CONFIG', mensaje_error: JSON.stringify({recuperable:false,causa:'Configuración'})};
 expect(clasificarReintentoMasivo({id:'i',serie:'F001',correlativo:1,estado:'ERROR_RED',history:[{...local,estado_nuevo:'ERROR_RED'},preparation]}).resultado).toBe('OMITIDO_BLOQUEO_LOCAL');
});
