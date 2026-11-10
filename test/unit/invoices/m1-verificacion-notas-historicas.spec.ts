import { prepareCreation } from '../../../src/modules/invoices/application/services/creationGuards';

function harness() {
  const product = { sale_price: 118, sku: 'HIST', is_active: false, tax_affectation: '20', sunat_unit_code: 'KGM' };
  const origin = { id: 'original', tipo_comprobante: '01', estado: 'ACEPTADO', serie: 'F001', correlativo: 1,
    monto_total: 118, customer_identity_type: '6', customer_identity_number: '20100070970',
    items: [{ item_code: 'HIST', igv_affectation_type: '10', unit_code: 'NIU' }] };
  const tx = { inventoryWarehouse: { findFirst: jest.fn(async () => ({ id: 'warehouse' })) }, inventoryProduct: { findMany: jest.fn(async ({ where }: { where: { is_active?: boolean } }) => where.is_active && !product.is_active ? [] : [product]) },
    invoice: { findFirst: jest.fn(async () => origin), findMany: jest.fn(async () => []) },
    $executeRaw: jest.fn(async () => 1) };
  const dto = { tipo_comprobante: '07', serie: 'FC01', documento_afectado: 'F001-1', codigo_motivo_nota: '07',
    customer_legal_name: 'Cliente', customer_identity_type: '6', customer_identity_number: '20100070970',
    fecha_emision: '2026-11-09', forma_pago: 'Contado',
    items: [{ codigo: 'HIST', descripcion: 'Producto histórico', cantidad: 1, precioUnitario: 118, afectacion: '10', unidad: 'NIU' }] };
  return { product, origin, tx, dto, run: () => prepareCreation(tx as never, dto as never, 'empresa') };
}
it('admite producto inactivo solo desde su línea fiscal histórica, no desde el maestro cambiado', async () => {
  const h = harness();
  expect((await h.run()).items[0]).toMatchObject({ afectacion: '10', unidad: 'NIU', precioUnitario: 118 });
  expect(h.tx.invoice.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ company_id: 'empresa' }) }));
});
it('no habilita un producto inactivo ajeno al origen', async () => {
  const h = harness(); h.origin.items = [];
  await expect(h.run()).rejects.toThrow();
});
it('no permite alterar la afectación histórica', async () => {
  const h = harness(); h.dto.items[0].afectacion = '20';
  await expect(h.run()).rejects.toThrow();
});
it('no habilita productos inactivos para una venta nueva', async () => {
  const h = harness(); h.dto.tipo_comprobante = '01';
  await expect(h.run()).rejects.toThrow();
});

it.each(['01', '02', '06'])('motivo total %s no admite devolución parcial', async motivo => {
  const h = harness(); h.dto.codigo_motivo_nota = motivo; h.dto.items[0].precioUnitario = 59;
  await expect(h.run()).rejects.toThrow('saldo disponible total');
});
it('motivo total usa el saldo restante después de notas previas', async () => {
  const h = harness(); h.dto.codigo_motivo_nota = '06'; h.dto.items[0].precioUnitario = 59;
  h.tx.invoice.findMany.mockResolvedValue([{ monto_total: 59 }] as never);
  await expect(h.run()).resolves.toMatchObject({ codigo_motivo_nota: '06' });
});
it('motivo por ítem conserva la devolución parcial', async () => {
  const h = harness(); h.dto.items[0].precioUnitario = 59;
  await expect(h.run()).resolves.toMatchObject({ codigo_motivo_nota: '07' });
});

it.each(['07', '08'])('la nota %s conserva precio histórico aunque no exista sale_price', async tipo => {
  const h = harness(); h.dto.tipo_comprobante = tipo; h.product.sale_price = null as never;
  expect((await h.run()).items[0].precioUnitario).toBe(118);
});
