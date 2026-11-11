import { ControlSaldoNotas } from '../../../src/modules/invoices/application/services/creditNoteBalanceGuard';
import { Prisma } from '../../../src/generated/client/client';
import { harness, nota, entradaNota } from '../../fixtures/noteCreationHarness';
function lectura(items: any[], notas: any[]) {
 const invoice = { findFirst: jest.fn(async () => ({ id: 'origin', estado: 'OBSERVADO', serie: 'F001', correlativo: 1, monto_total: 118, items })), findMany: jest.fn(async () => notas) };
 return { invoice, run: () => new ControlSaldoNotas({ invoice } as never).calcular('empresa', 'origin') };
}
it('proyecta original y pendiente por SKU; 04 no consume unidades, 07 pendiente sí', async () => {
 const h = lectura([{ item_code: 'A', quantity: 1 }, { item_code: 'A', quantity: 1 }, { item_code: 'B', quantity: 5 }], [
  { monto_total: 10, credit_debit_reason_code: '07', items: [{ item_code: 'A', quantity: .5 }] },
  { monto_total: 20, credit_debit_reason_code: '04', items: [{ item_code: 'B', quantity: 5 }] },
 ]);
 expect(await h.run()).toMatchObject({ disponible: 88, cantidades_pendientes: [{ codigo: 'A', original: 2, pendiente: 1.5 }, { codigo: 'B', original: 5, pendiente: 5 }] });
 expect(h.invoice.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ company_id: 'empresa', referenced_invoice_id: 'origin', tipo_comprobante: '07', estado: { notIn: ['RECHAZADO', 'ANULADO'] } }) }));
});
it('01/06 también reservan cantidades, sin perder precisión decimal', async () => {
 const h = lectura([{ item_code: 'A', quantity: new Prisma.Decimal('.1') }, { item_code: 'A', quantity: new Prisma.Decimal('.2') }], [
  { monto_total: 1, credit_debit_reason_code: '01', items: [{ item_code: 'A', quantity: .05 }] },
  { monto_total: 1, credit_debit_reason_code: '06', items: [{ item_code: 'A', quantity: .05 }] },
 ]);
 expect((await h.run()).cantidades_pendientes).toEqual([{ codigo: 'A', original: .3, pendiente: .2 }]);
});
it('una sobrededucción histórica no se presenta como unidades disponibles negativas', async () => {
 const h = lectura([{ item_code: 'A', quantity: 1 }], [{ monto_total: 1, credit_debit_reason_code: '07', items: [{ item_code: 'A', quantity: 2 }] }]);
 expect((await h.run()).cantidades_pendientes).toEqual([{ codigo: 'A', original: 1, pendiente: 0 }]);
});
it('sin movimientos previos devuelve todas las unidades originales', async () => {
 const h = lectura([{ item_code: 'A', quantity: 2 }], []);
 expect((await h.run()).cantidades_pendientes).toEqual([{ codigo: 'A', original: 2, pendiente: 2 }]);
});
it.each(['pantalla', 'fiscal'])('B3 conserva tope del servidor para 3 contra 2: %s', async ruta => {
 const h = harness(); h.origin.items[0].quantity = 2;
 const d = nota(); d.codigo_motivo_nota = '07'; d.items[0].precioUnitario = 1; d.items[0].cantidad = 3;
 await expect(h.run(entradaNota(d, ruta))).rejects.toThrow('NOTA_EXCEDE_CANTIDAD');
});

import { CATALOGO_09_MOTIVOS } from '../../../src/modules/invoices/application/services/noteCatalogs';
it('saldo transporta totales del catálogo y descuenta unidades de notas 02 anteriores', async () => {
 const h = lectura([{ item_code: 'A', quantity: 10 }], [{ monto_total: 118, credit_debit_reason_code: '02', items: [{ item_code: 'A', quantity: 5 }] }]);
 const saldo = await h.run();
 expect(saldo.motivos_totales).toEqual(CATALOGO_09_MOTIVOS.filter(m => m.total).map(m => m.codigo));
 expect(saldo.cantidades_pendientes).toEqual([{ codigo: 'A', original: 10, pendiente: 5 }]);
});
