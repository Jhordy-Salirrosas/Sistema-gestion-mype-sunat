import { readFileSync } from 'node:fs';
import { harness, nota, entradaNota } from '../../fixtures/noteCreationHarness';
import { validarMotivoNota, validarImporteNota, MOTIVOS_OFICIALES_NC, MOTIVOS_OFICIALES_ND } from '../../../src/modules/invoices/application/services/noteReasonGuard';
import { traducirEmision } from '../../../src/modules/invoices/application/services/emitirComprobanteAdapter';
import { CATALOGO_09_MOTIVOS, CATALOGO_10_MOTIVOS } from '../../../src/modules/invoices/application/services/invoiceNoteService';
describe.each(['pantalla', 'fiscal'])('motivos e importes, %s', ruta => {
 it.each(['07', '08'])('rechaza motivo 99 en documento %s', async tipo => {
  const d = nota(); d.tipo_comprobante = tipo; d.serie = tipo === '07' ? 'FC01' : 'FD01'; d.codigo_motivo_nota = '99';
  await expect(harness().run(entradaNota(d, ruta))).rejects.toThrow('no pertenece al Catálogo');
 });
 it.each(['07', '08'])('rechaza precio cero oneroso en documento %s', async tipo => {
  const d = nota(); d.tipo_comprobante = tipo; d.serie = tipo === '07' ? 'FC01' : 'FD01'; d.codigo_motivo_nota = tipo === '07' ? '07' : '02'; d.items[0].precioUnitario = 0;
  await expect(harness().run(entradaNota(d, ruta))).rejects.toThrow('línea onerosa');
 });
 it('rechaza una línea onerosa cero aunque el total sea positivo', async () => {
  const h = harness(); h.origin.items[0].quantity = 2;
  const d = nota(); d.codigo_motivo_nota = '07'; d.items[0].precioUnitario = 0; d.items.push({ ...d.items[0], precioUnitario: 59 });
  await expect(h.run(entradaNota(d, ruta))).rejects.toThrow('línea onerosa');
 });
 it('oficial 08 no habilitado es distinto de inválido 99', async () => {
  const d = nota(); d.codigo_motivo_nota = '08';
  await expect(harness().run(entradaNota(d, ruta))).rejects.toThrow('oficial pero no está habilitado');
 });
 it('un descuento no permite esconder una nota de total cero', async () => {
  const d = nota(); d.codigo_motivo_nota = '07'; Object.assign(d, { descuento_global: { codigo: '02', monto: 100 } });
  await expect(harness().run(entradaNota(d, ruta))).rejects.toThrow('importe total');
 });
 it('gratuita con precio cero y referencia positiva no se trata como onerosa', async () => {
  const h = harness(); h.tx.inventoryProduct.findMany.mockResolvedValue([h.product, { ...h.product, sku: 'GRAT', tax_affectation: '11' }]); h.origin.items.push({ item_code: 'GRAT', quantity: 1, unit_code: 'NIU', igv_affectation_type: '11' });
  const d: any = nota(); d.codigo_motivo_nota = '07';
  d.items.push({ codigo: 'GRAT', descripcion: 'Obsequio', cantidad: 1, precioUnitario: 0, valorUnitario: 35, afectacion: '11', unidad: 'NIU' });
  const preparada = await h.run(entradaNota(d, ruta));
  const r = traducirEmision(preparada, { ruc: '20000000001', razonSocial: 'Prueba' }, 1);
  expect(r.importes.total).toBe(118); expect(r.lineas[1]).toMatchObject({ precioUnitario: 0, valorUnitario: 35, totalLinea: 0 });
 });
});
it.each([0, -1, NaN, Infinity])('total no positivo/no finito %s se rechaza', total => expect(() => validarImporteNota(total)).toThrow('mayor que cero'));
it('los catálogos oficiales coinciden con los assets SFS; el conjunto habilitado no crece', () => {
 for (const [id, codigos] of [['09', MOTIVOS_OFICIALES_NC], ['10', MOTIVOS_OFICIALES_ND]] as const) {
  const xml = readFileSync(`assets/sunat-sfs/commons/cpe/catalogo/cat_${id}.xml`, 'utf8');
  expect([...xml.matchAll(/<c id="(\d+)"/g)].map(m => m[1])).toEqual(codigos);
 }
 expect(CATALOGO_09_MOTIVOS.map(m => m.codigo)).toEqual(['01','02','03','04','05','06','07','09','13']);
 expect(CATALOGO_10_MOTIVOS.map(m => m.codigo)).toEqual(['01','02','03','11','12']);
 for (const m of CATALOGO_09_MOTIVOS) expect(() => validarMotivoNota('07', m.codigo)).not.toThrow();
 for (const m of CATALOGO_10_MOTIVOS) expect(() => validarMotivoNota('08', m.codigo)).not.toThrow();
});
