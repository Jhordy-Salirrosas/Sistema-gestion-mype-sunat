import { harness, nota, entradaNota } from '../../fixtures/noteCreationHarness';
import { validarCantidadesNota } from '../../../src/modules/invoices/application/services/noteQuantityBalance';
describe.each(['pantalla', 'fiscal'])('06, cantidades y dinero, %s', ruta => {
 it('rechaza una de dos unidades aunque devuelva todo el dinero', async () => {
  const h = harness(); h.origin.items[0].quantity = 2;
  await expect(h.run(entradaNota(nota(), ruta))).rejects.toThrow('NOTA_DEVOLUCION_TOTAL_INCOMPLETA');
 });
 it('acepta todas las unidades y saldo exacto sobre OBSERVADO', async () => {
  const h = harness(); h.origin.estado = 'OBSERVADO'; h.origin.items[0].quantity = 2;
  const d = nota(); d.items[0].cantidad = 2; d.items[0].precioUnitario = 59;
  await expect(h.run(entradaNota(d, ruta))).resolves.toMatchObject({ referenced_invoice_id: 'origin' });
  expect(h.tx.$executeRaw.mock.invocationCallOrder[0]).toBeLessThan(h.tx.invoice.findMany.mock.invocationCallOrder[0]);
 });
 it('tras devolución parcial exige solo las unidades y el dinero pendientes', async () => {
  const h = harness(); h.origin.items[0].quantity = 2;
  h.tx.invoice.findMany.mockResolvedValue([{ monto_total: 59, credit_debit_reason_code: '07', items: [{ item_code: 'SERV', quantity: 1 }] }]);
  const d = nota(); d.items[0].precioUnitario = 59;
  await expect(h.run(entradaNota(d, ruta))).resolves.toBeDefined();
  d.items[0].precioUnitario = 58;
  await expect(h.run(entradaNota(d, ruta))).rejects.toThrow('saldo disponible total');
 });
 it('el motivo 07 conserva la devolución parcial válida', async () => {
  const h = harness(); h.origin.items[0].quantity = 2;
  const d = nota(); d.codigo_motivo_nota = '07'; d.items[0].precioUnitario = 59;
  await expect(h.run(entradaNota(d, ruta))).resolves.toBeDefined();
 });
});
it('06 no permite omitir un SKU ni ocultarlo duplicando otro', () => {
 const origen = [{ item_code: 'A', quantity: 2 }, { item_code: 'B', quantity: 1 }];
 expect(() => validarCantidadesNota([{ codigo: 'A', cantidad: 2 }], origen, [], true)).toThrow('B');
 expect(() => validarCantidadesNota([{ codigo: 'A', cantidad: 1 }, { codigo: 'A', cantidad: 1 }, { codigo: 'B', cantidad: 1 }], origen, [], true)).not.toThrow();
});
it('06 serializado: una nota reservada consume unidades aunque no haya CDR todavía', async () => {
 const h = harness(); const d = nota(); await h.run(d);
 h.tx.invoice.findMany.mockResolvedValue([{ monto_total: 118, credit_debit_reason_code: '06', items: [{ item_code: 'SERV', quantity: 1 }] }]);
 await expect(h.run(d)).rejects.toThrow('NOTA_EXCEDE_CANTIDAD');
});
