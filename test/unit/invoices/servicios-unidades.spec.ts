import { readFileSync } from 'node:fs';
import { DOMParser } from '@xmldom/xmldom';
import { UNIDADES_FISCALES_SUNAT, esUnidadFiscalSunat } from '../../../src/modules/invoices/sunatUnits';
import { esUnidadFerreteria } from '../../../src/modules/invoices/sunatCatalogsQuery';
import { CATALOGO_03_UNIDADES } from '../../../src/modules/invoices/sunatCatalogs';
import { prepareCreation } from '../../../src/modules/invoices/application/services/creationGuards';
import { traducirEmision } from '../../../src/modules/invoices/application/services/emitirComprobanteAdapter';
import { InvoiceQueryService } from '../../../src/modules/invoices/application/services/invoiceQueryService';
import { UblGeneratorService } from '../../../src/modules/invoices/ublGeneratorService';
import { XsdValidatorService } from '../../../src/modules/invoices/xsdValidatorService';
import { InvoiceJobConsumer } from '../../../src/modules/invoices/invoiceJobConsumer';
import { StockValidationService } from '../../../src/modules/invoices/application/services/stockValidationService';
import { SignatureService } from '../../../src/modules/sunat/signature.service';
import { ejecutarSfs } from '../../../src/modules/invoices/application/services/sunatSfsRunner';
import { fakeIssuerCertificate } from '../../fixtures/fakeIssuerCertificate';

const issuer = { ruc: '20000000001', razonSocial: 'Empresa ficticia', codigoLocalAnexo: '0001', direccion: 'Domicilio ficticio 123', ubigeo: '150101', departamento: 'LIMA', provincia: 'LIMA', distrito: 'LIMA' };
function harness(aff: string, mixed: boolean, unit = 'ZZ') {
  const service = { id: 's', sku: `SRV-${aff}`, description: 'Servicio ficticio', is_service: true, is_inventory: false, is_active: true, sale_price: 100, sunat_unit_code: unit, tax_affectation: aff };
  const good = { id: 'g', sku: 'CEM', description: 'Bien ficticio', is_service: false, is_inventory: true, is_active: true, sale_price: 118, sunat_unit_code: 'NIU', tax_affectation: '10' };
  const products = mixed ? [good, service] : [service];
  const tx = { inventoryWarehouse: { findFirst: async () => ({ id: 'w' }) }, inventoryProduct: { findMany: async () => products }, businessPartner: { findFirst: async () => ({ id: 'c', has_credit: false, allows_discount: false }) }, partnerTaxStatus: { findFirst: async () => null }, $executeRaw: async () => 1 };
  const input = { tipo_comprobante: '01', serie: 'F001', fecha_emision: '2026-11-13', forma_pago: 'Contado', customer_identity_type: '6', customer_identity_number: '20100070970', customer_legal_name: 'Cliente ficticio', items: products.map(p => ({ codigo: p.sku, descripcion: p.description, cantidad: 1, precioUnitario: p.sale_price })) };
  return { products, tx, input };
}
function workerXml(payload: object): string {
  const worker = Object.create(InvoiceJobConsumer.prototype);
  worker.ublGenerator = new UblGeneratorService(); worker.xsdValidator = new XsdValidatorService();
  return worker.xmlDelComprobante({ id: 'servicios-local', payload_ubl: payload });
}
it('catálogo fiscal coincide exactamente con los códigos únicos del asset oficial', () => {
  const doc = new DOMParser().parseFromString(readFileSync('assets/sunat-sfs/commons/cpe/catalogo/cat_03.xml', 'utf8'), 'application/xml');
  const ids = Array.from(doc.getElementsByTagName('c')).map(n => n.getAttribute('id')!).filter(id => id !== 'Code');
  expect(UNIDADES_FISCALES_SUNAT).toEqual([...new Set(ids)]);
  expect(UNIDADES_FISCALES_SUNAT).toHaveLength(2116);
  expect(UNIDADES_FISCALES_SUNAT.every(esUnidadFiscalSunat)).toBe(true);
  expect(Object.keys(CATALOGO_03_UNIDADES)).toEqual(['NIU','DZN','CEN','MIL','KGM','MTR','MTQ','BG','BX']);
  expect(esUnidadFerreteria(' niu ')).toBe(true); expect(esUnidadFerreteria('ZZ')).toBe(false);
});
it.each(['ZZ','GLL','GRM','LTR','MTK','PK','SET','TNE'])('unidad %s de Inventario es fiscalmente válida sin alterar clasificación', async unit => {
  expect(esUnidadFiscalSunat(` ${unit.toLowerCase()} `)).toBe(true); expect(esUnidadFerreteria(unit)).toBe(false);
  const h = harness('30', false, unit);
  const query = new InvoiceQueryService({ inventoryProduct: { findMany: async () => h.products }, inventoryBalance: { findMany: async () => [] } } as never, {} as never);
  expect((await query.catalogoProductos('company')).balances[0]).toMatchObject({ vendible: true, sunatUnitCode: unit, motivo: null });
});
it.each(['', 'INVALIDA', 'BAL', 'BLS', 'BOT', 'CIL', 'FDO', 'ROL', 'Code'])('unidad no oficial %j sigue rechazada por el generador', async unit => {
  expect(esUnidadFiscalSunat(unit)).toBe(false);
  const h = harness('30', false, unit || 'ZZ');
  const prepared = await prepareCreation(h.tx as never, h.input as never, 'company');
  const payload = traducirEmision(prepared, issuer, 1).dto.payload_ubl;
  (payload.lineas as { unidad: string }[])[0].unidad = unit;
  expect(() => workerXml(payload)).toThrow(`Catálogo 03 (se aceptan ${UNIDADES_FISCALES_SUNAT.join(', ')})`);
});
it.each(['10','20','30'].flatMap(aff => [false,true].map(mixed => ({aff,mixed}))))('servicio $aff mixto=$mixed: guarda → payload → XML del worker → firma ficticia → SFS', async ({aff,mixed}) => {
  const h = harness(aff,mixed); const original = JSON.stringify(h.input);
  const prepared = await prepareCreation(h.tx as never, h.input as never, 'company');
  const payload = traducirEmision(prepared, issuer, 1).dto.payload_ubl;
  const persisted = JSON.stringify(payload); const xml = workerXml(payload);
  expect(xml).toContain('unitCode="ZZ"'); expect(xml).toContain(`<cbc:TaxExemptionReasonCode`);
  expect(xml).toContain(`>${aff}</cbc:TaxExemptionReasonCode>`);
  const fake = fakeIssuerCertificate(); const signature = new SignatureService({ getCertificate: () => ({ certificatePem: fake.pem, privateKeyPem: fake.privateKeyPem }) } as never);
  expect(await ejecutarSfs(signature.signXml(xml).signedXml, '01')).toEqual({ completado: true, errores: [] });
  expect(JSON.stringify(payload)).toBe(persisted); expect(JSON.stringify(h.input)).toBe(original);
});
it('servicio sin stock sigue permitido; bien sin stock y afectación alterada siguen bloqueados', async () => {
  const h = harness('30',true);
  const db = { inventoryProduct: { findMany: async () => h.products }, inventoryBalance: { groupBy: async () => [] } };
  const stock = new StockValidationService(db as never);
  await expect(stock.validar('company',[{ codigo:'SRV-30', descripcion:'Servicio', cantidad:1, unidad:'ZZ', afectacion:'30' }])).resolves.toMatchObject({ validados:1 });
  await expect(stock.validar('company',[{ codigo:'CEM', descripcion:'Bien', cantidad:1, unidad:'NIU', afectacion:'10' }])).rejects.toThrow('Stock insuficiente');
  await expect(stock.validar('company',[{ codigo:'SRV-30', descripcion:'Servicio', cantidad:1, unidad:'ZZ', afectacion:'20' }])).rejects.toThrow('no coincide');
  const edited = { ...h.input, items:[{...h.input.items[1],unidad:'NIU'}] };
  await expect(prepareCreation(h.tx as never,edited as never,'company')).rejects.toThrow('No puede alterar la unidad');
  await expect(prepareCreation(h.tx as never,{...h.input,items:[{...h.input.items[1],codigo:'NO-REGISTRADO'}]} as never,'company')).rejects.toThrow('no registrado');
});
it('boleta inafecta con servicio ZZ declara tasa cero y supera la hoja oficial', async () => {
  const h = harness('30', false); h.input.tipo_comprobante = '03'; h.input.serie = 'B001';
  const prepared = await prepareCreation(h.tx as never, h.input as never, 'company');
  const payload = traducirEmision(prepared, issuer, 1).dto.payload_ubl;
  const fake = fakeIssuerCertificate(); const signature = new SignatureService({ getCertificate: () => ({ certificatePem: fake.pem, privateKeyPem: fake.privateKeyPem }) } as never);
  expect(await ejecutarSfs(signature.signXml(workerXml(payload)).signedXml, '03')).toEqual({ completado: true, errores: [] });
});
