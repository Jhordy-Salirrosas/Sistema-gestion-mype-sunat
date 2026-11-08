import { prepareCreation, fiscalToEmission } from '../../../src/modules/invoices/application/services/creationGuards';
const base = () => ({ tipo_comprobante: '01', serie: 'F001', customer_legal_name: 'Cliente',
  customer_identity_type: '6', customer_identity_number: '20100070970', forma_pago: 'Contado', fecha_emision: '2026-11-07',
  items: [{ codigo: 'SERV', descripcion: 'Servicio', precioUnitario: 118, cantidad: 1 }] });
function harness() {
  const product = { sku: 'SERV', tax_affectation: '10', sunat_unit_code: 'NIU' };
  const origin = { id: 'origin', tipo_comprobante: '01', serie: 'F001', correlativo: 1, estado: 'ACEPTADO',
    monto_total: 118, customer_identity_type: '6', customer_identity_number: '20100070970' };
  const tx = { inventoryProduct: { findMany: jest.fn(async () => [product]) },
    businessPartner: { findFirst: jest.fn(async () => ({ id: 'cli', has_credit: true, allows_discount: true })) },
    partnerTaxStatus: { findFirst: jest.fn(async () => null) }, $executeRaw: jest.fn(async () => 1),
    invoice: { findFirst: jest.fn(async () => origin), findMany: jest.fn(async () => [] as any[]) } };
  return { product, origin, tx, run: (dto: any = base()) => prepareCreation(tx as never, dto, 'empresa') };
}
it('hereda afectación y unidad sin mutar la solicitud y evalúa retención a la fecha fiscal', async () => {
  const h = harness(), dto = base();
  const result = await h.run(dto);
  expect(result.items[0]).toMatchObject({ afectacion: '10', unidad: 'NIU' });
  expect(dto.items[0]).not.toHaveProperty('afectacion');
  expect(h.tx.partnerTaxStatus.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ valid_from: { lte: new Date('2026-11-07T00:00:00Z') } }) }));
});
it.each([null, '', '99'])('bloquea afectación ausente o inválida %s', async (tax) => {
  const h = harness(); h.product.tax_affectation = tax as any;
  await expect(h.run()).rejects.toThrow('sin afectación');
});
it.each([{ afectacion: '20' }, { unidad: 'KGM' }, { precioUnitario: undefined }, { cantidad: 0 }, { codigo: undefined }])(
  'bloquea línea no autorizada: %j', async (changes) => {
    const h = harness(), dto = base(); Object.assign(dto.items[0], changes);
    await expect(h.run(dto)).rejects.toThrow();
  },
);
it('bloquea código inexistente, tipo, nombre, forma y líneas faltantes', async () => {
  const h = harness(); h.tx.inventoryProduct.findMany.mockResolvedValueOnce([]);
  await expect(h.run()).rejects.toThrow('no registrado');
  for (const changes of [{ tipo_comprobante: '99' }, { customer_legal_name: '' }, { forma_pago: undefined }, { items: [] }]) {
    await expect(h.run({ ...base(), ...changes })).rejects.toThrow();
  }
});
it.each([false, null, undefined])('crédito exige has_credit=true aunque existan términos: %s', async (flag) => {
  const h = harness(); h.tx.businessPartner.findFirst.mockResolvedValue({ has_credit: flag, allows_discount: true, payment_terms: '30_DIAS' } as any);
  await expect(h.run({ ...base(), forma_pago: 'Credito', cuotas: [{ monto: 118, vencimiento: '2026-12-01' }] })).rejects.toThrow('maestro');
});
it('descuento exige permiso explícito y contado no acepta cuotas', async () => {
  const h = harness(); h.tx.businessPartner.findFirst.mockResolvedValue({ has_credit: true, allows_discount: false } as any);
  await expect(h.run({ ...base(), descuento_global: { codigo: '02', monto: 10 } })).rejects.toThrow('maestro');
  await expect(h.run({ ...base(), cuotas: [{ monto: 118, vencimiento: '2026-12-01' }] })).rejects.toThrow('contado');
});
it('permite crédito autorizado y descuento autorizado con cronograma exacto', async () => {
  const h = harness();
  await expect(h.run({ ...base(), forma_pago: 'Credito', cuotas: [{ monto: 118, vencimiento: '2026-12-01' }] })).resolves.toMatchObject({ forma_pago: 'Credito' });
  await expect(h.run({ ...base(), descuento_global: { codigo: '02', monto: 10 } })).resolves.toMatchObject({ descuento_global: { monto: 10 } });
});
const note = () => ({ ...base(), tipo_comprobante: '07', serie: 'FC01', documento_afectado: 'F001-00000001', codigo_motivo_nota: '01' });
it('bloquea el origen antes de leer el saldo y asigna vínculo real', async () => {
  const h = harness(); const result = await h.run(note());
  expect(result.referenced_invoice_id).toBe('origin');
  expect(h.tx.$executeRaw.mock.invocationCallOrder[0]).toBeLessThan(h.tx.invoice.findMany.mock.invocationCallOrder[0]);
});
it.each(['PENDIENTE', 'EN_COLA', 'RECHAZADO', 'ERROR_RED', 'ANULADO', 'OBSERVADO'])(
  'bloquea origen %s', async (estado) => { const h = harness(); h.origin.estado = estado; await expect(h.run(note())).rejects.toThrow('aceptada'); },
);
it('bloquea un céntimo de exceso y consume las notas vigentes por UUID', async () => {
  const h = harness(); h.tx.invoice.findMany.mockResolvedValue([{ monto_total: 0.01 }]);
  await expect(h.run(note())).rejects.toThrow('NOTA_EXCEDE_SALDO');
  expect(h.tx.invoice.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ referenced_invoice_id: 'origin', estado: { notIn: ['RECHAZADO', 'ANULADO'] } }) }));
});
it('no permite origen inexistente, otra nota, otro adquirente o referencias contradictorias', async () => {
  const h = harness(); h.tx.invoice.findFirst.mockResolvedValueOnce(null as any);
  await expect(h.run(note())).rejects.toThrow('no encontrado');
  h.origin.tipo_comprobante = '07'; await expect(h.run(note())).rejects.toThrow('factura o boleta');
  h.origin.tipo_comprobante = '01'; h.origin.customer_identity_number = 'otro'; await expect(h.run(note())).rejects.toThrow('adquirente');
  h.origin.customer_identity_number = '20100070970';
  await expect(h.run({ ...note(), documento_afectado: 'F001-00000002', referenced_invoice_id: 'origin' })).rejects.toThrow('no coinciden');
  await expect(h.run({ ...note(), documento_afectado: undefined })).rejects.toThrow('exige');
});
it('débito por UUID recupera número y no consume saldo de crédito', async () => {
  const h = harness();
  const result = await h.run({ ...note(), tipo_comprobante: '08', documento_afectado: undefined, referenced_invoice_id: 'origin' });
  expect(result.documento_afectado).toBe('F001-00000001'); expect(h.tx.invoice.findMany).not.toHaveBeenCalled();
});
const raw = () => ({ ruc_emisor: '20100070970', tipo_comprobante: '01', serie: 'F001', fecha_emision: '2026-11-07',
  payload_ubl: { rucEmisor: '20100070970', tipoComprobante: '01', serie: 'F001', fechaEmision: '2026-11-07',
    formaPago: 'Contado', tipoMoneda: 'PEN', lineas: [{ codigo: 'SERV', descripcion: 'Servicio', precioUnitario: 118, cantidad: 1 }] } });
it('ruta fiscal se traduce al mismo contrato sin inferir impuestos faltantes', () => {
  const result = fiscalToEmission(raw() as never); expect(result.items[0].afectacion).toBeUndefined();
  expect(result.items[0].precioUnitario).toBe(118);
});
it.each([null, { tipoComprobante: '03' }, { formaPago: undefined }, { tipoMoneda: undefined }, { lineas: [] },
  { lineas: [null] }, { lineas: [{ descuentos: [{}, {}] }] }, { codigoDetraccion: '027' },
  { cliente: { numeroDocumento: 'otro' } }])('rechaza payload fiscal incompleto o contradictorio %j', (change) => {
    const dto = raw(); dto.payload_ubl = change === null ? null as any : { ...dto.payload_ubl, ...change } as any;
    expect(() => fiscalToEmission(dto as never)).toThrow();
  });
