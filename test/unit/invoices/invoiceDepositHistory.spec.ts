import { aHistorial } from '../../../src/modules/invoices/application/services/invoiceQueryMapper';
const event = (mensaje: string) => [{ id: 'h', codigo_error: 'M1_DETRACTION_DEPOSIT', mensaje_error: mensaje, created_at: new Date('2026-11-01') }];
it('detalle presenta actor y ambos valores del depósito de forma legible', () => {
 const result = aHistorial(event(JSON.stringify({ accion: 'Depósito actualizado', actor: 'usuario', anterior: { fecha: '2026-11-01', monto: 10, constancia: 'ABC' }, nuevo: { fecha: '2026-11-02', monto: 20, constancia: '002' } })) as never);
 expect(result[0].mensaje_error).toBe('Depósito actualizado. Usuario: usuario. Anterior: fecha 2026-11-01, monto 10, constancia ABC. Nuevo: fecha 2026-11-02, monto 20, constancia 002.');
});
it('conserva evidencia antigua incluso si no tiene JSON legible', () => {
 expect(aHistorial(event('histórico') as never)[0].mensaje_error).toBe('histórico');
});
