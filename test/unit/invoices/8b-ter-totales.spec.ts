import { harness, nota, entradaNota } from '../../fixtures/noteCreationHarness';
import { esMotivoCreditoTotal, CATALOGO_09_MOTIVOS } from '../../../src/modules/invoices/application/services/noteCatalogs';
import { validarCantidadesNota, devuelveUnidades } from '../../../src/modules/invoices/application/services/noteQuantityBalance';
import { Prisma } from '../../../src/generated/client/client';

it('totalidad deriva del catálogo y es distinta de la clasificación física', () => {
  for (const motivo of CATALOGO_09_MOTIVOS) expect(esMotivoCreditoTotal(motivo.codigo)).toBe(motivo.total);
  expect(esMotivoCreditoTotal('99')).toBe(false);
  expect(devuelveUnidades('02')).toBe(true);
  expect(devuelveUnidades('07')).toBe(true);
  expect(esMotivoCreditoTotal('07')).toBe(false);
});
describe.each(['pantalla', 'fiscal'])('8B-ter totalidad, contrato %s', ruta => {
  it.each(['01', '02', '06'])('bloquea unidades parciales aunque el dinero sea exacto: %s', async motivo => {
    const h = harness(); h.origin.items[0].quantity = 10;
    const dto = nota(); dto.codigo_motivo_nota = motivo; dto.items[0].cantidad = 5; dto.items[0].precioUnitario = 23.6;
    await expect(h.run(entradaNota(dto, ruta))).rejects.toThrow('NOTA_DEVOLUCION_TOTAL_INCOMPLETA');
  });
  it.each(['01', '02', '06'])('SKU omitido cuenta como no devuelto: %s', async motivo => {
    const h = harness(); h.origin.items.push({ ...h.origin.items[0], item_code: 'OTRO' });
    const dto = nota(); dto.codigo_motivo_nota = motivo;
    await expect(h.run(entradaNota(dto, ruta))).rejects.toThrow('todas las unidades pendientes de OTRO');
  });
  it.each(['01', '02', '06'])('suma filas repetidas y acepta igualdad con saldo pendiente: %s', async motivo => {
    const h = harness(); h.origin.items[0].quantity = 10;
    const dto = nota(); dto.codigo_motivo_nota = motivo;
    dto.items = [{ ...dto.items[0], cantidad: 4, precioUnitario: 11.8 }, { ...dto.items[0], cantidad: 6, precioUnitario: 11.8 }];
    await expect(h.run(entradaNota(dto, ruta))).resolves.toMatchObject({ codigo_motivo_nota: motivo });
  });
  it.each(['01', '02', '06'])('usa pool consumido por una nota anterior, no cantidades originales: %s', async motivo => {
    const h = harness(); h.origin.items[0].quantity = 10;
    h.tx.invoice.findMany.mockResolvedValue([{ monto_total: 23.6, credit_debit_reason_code: '07', items: [{ item_code: 'SERV', quantity: 2 }] }]);
    const dto = nota(); dto.codigo_motivo_nota = motivo; dto.items[0].cantidad = 8; dto.items[0].precioUnitario = 11.8;
    await expect(h.run(entradaNota(dto, ruta))).resolves.toBeDefined();
    dto.items[0].cantidad = 4; dto.items[0].precioUnitario = 23.6;
    await expect(h.run(entradaNota(dto, ruta))).rejects.toThrow('NOTA_DEVOLUCION_TOTAL_INCOMPLETA');
    dto.items[0].cantidad = 10; dto.items[0].precioUnitario = 9.44;
    await expect(h.run(entradaNota(dto, ruta))).rejects.toThrow('NOTA_EXCEDE_CANTIDAD');
  });
  it('motivo parcial 07 y ND siguen permitiendo cantidades parciales', async () => {
    for (const tipo of ['07', '08']) {
      const h = harness(); h.origin.items[0].quantity = 10;
      const dto = { ...nota(), tipo_comprobante: tipo, serie: tipo === '07' ? 'FC01' : 'FD01', codigo_motivo_nota: tipo === '07' ? '07' : '01' };
      dto.items[0].cantidad = 5;
      dto.items[0].precioUnitario = 11.8;
      await expect(h.run(entradaNota(dto, ruta))).resolves.toBeDefined();
    }
  });
});
it('igualdad y máximo conservan precisión decimal y agrupan el SKU', () => {
  const original = [{ item_code: 'A', quantity: new Prisma.Decimal('.1') }, { item_code: 'A', quantity: new Prisma.Decimal('.2') }];
  const anteriores = [{ item_code: 'A', quantity: new Prisma.Decimal('.05') }];
  expect(() => validarCantidadesNota([{ codigo: 'A', cantidad: .1 }, { codigo: 'A', cantidad: .15 }], original, anteriores, true)).not.toThrow();
  expect(() => validarCantidadesNota([{ codigo: 'A', cantidad: .249 }], original, anteriores, true)).toThrow('TOTAL_INCOMPLETA');
  expect(() => validarCantidadesNota([{ codigo: 'A', cantidad: .251 }], original, anteriores, true)).toThrow('EXCEDE_CANTIDAD');
});

import { scenario } from '../../fixtures/8bTerAtomicHarness';
import { traducirEmision } from '../../../src/modules/invoices/application/services/emitirComprobanteAdapter';
it.each(['pantalla', 'fiscal'].flatMap(ruta => ['01', '02', '06'].map(motivo => [ruta, motivo])))('alta atómica %s bloquea total incompleto %s antes de reservar/publicar', async (ruta, motivo) => {
  const h = scenario();
  const pantalla = { ...nota(), codigo_motivo_nota: motivo,
    documento_afectado: 'F001-00000069', referenced_invoice_id: '11111111-1111-4111-8111-111111111111',
    items: [{ codigo: 'SERV', descripcion: 'Producto', cantidad: 5, precioUnitario: 23.6, afectacion: '10', unidad: 'NIU' }] };
  const fiscal = traducirEmision(pantalla as never, { ruc: '20100070970', razonSocial: 'Emisor de prueba' }, 1).dto;
  expect(fiscal.monto_total).toBe(118);
  const work = ruta === 'pantalla' ? h.service.emitir(pantalla as never, 'empresa', '8b-ter-atomic-key-01') : h.service.create(fiscal, 'empresa', '8b-ter-atomic-key-01');
  await expect(work).rejects.toThrow('NOTA_DEVOLUCION_TOTAL_INCOMPLETA');
  expect(h.tx.$queryRaw).not.toHaveBeenCalled();
  expect(h.tx.invoice.create).not.toHaveBeenCalled();
  expect(h.queue.enqueueInvoiceInTx).not.toHaveBeenCalled();
});

it.each(['pantalla', 'fiscal'])('P3: nota 02 aceptada previa reduce el pool de cualquier nueva NC total: %s', async ruta => {
 for (const motivo of ['01','02','06']) {
  const h = harness(); h.origin.items[0].quantity = 10;
  h.tx.invoice.findMany.mockResolvedValue([{ monto_total: 23.6, credit_debit_reason_code: '02', items: [{ item_code: 'SERV', quantity: 2 }] }]);
  const d = nota(); d.codigo_motivo_nota = motivo; d.items[0].cantidad = 8; d.items[0].precioUnitario = 11.8;
  await expect(h.run(entradaNota(d, ruta))).resolves.toBeDefined();
  d.items[0].cantidad = 4; d.items[0].precioUnitario = 23.6;
  await expect(h.run(entradaNota(d, ruta))).rejects.toThrow('TOTAL_INCOMPLETA');
  d.items[0].cantidad = 10; d.items[0].precioUnitario = 9.44;
  await expect(h.run(entradaNota(d, ruta))).rejects.toThrow('EXCEDE_CANTIDAD');
 }
});
it.each(['pantalla','fiscal'])('P3: el servidor sella la política 02 al crear por %s', async ruta => {
 const h = scenario();
 const pantalla = { ...nota(), codigo_motivo_nota: '02', documento_afectado: 'F001-00000069',
  items: [{ codigo: 'SERV', descripcion: 'Producto', cantidad: 10, precioUnitario: 11.8, afectacion: '10', unidad: 'NIU' }] };
 const fiscal = traducirEmision(pantalla as never, { ruc: '20100070970', razonSocial: 'Emisor' }, 1).dto;
 fiscal.payload_ubl.politicaDevolucionFisica02 = 999;
 if (ruta === 'pantalla') await h.service.emitir(pantalla as never, 'empresa', 'p3-creation-policy-01');
 else await h.service.create(fiscal, 'empresa', 'p3-creation-policy-01');
 expect(h.tx.invoice.create.mock.calls[0][0].data.payload_ubl.politicaDevolucionFisica02).toBe(1);
});

it.each(['pantalla','fiscal'])('P3: una 02 previa que agotó el dinero impide otra NC total aunque queden unidades: %s', async ruta => {
 const h = harness(); h.origin.items[0].quantity = 10;
 h.tx.invoice.findMany.mockResolvedValue([{ monto_total: 118, credit_debit_reason_code: '02', items: [{ item_code: 'SERV', quantity: 2 }] }]);
 const d = nota(); d.codigo_motivo_nota = '02'; d.items[0].cantidad = 8; d.items[0].precioUnitario = 11.8;
 await expect(h.run(entradaNota(d, ruta))).rejects.toThrow('NOTA_EXCEDE_SALDO');
});
