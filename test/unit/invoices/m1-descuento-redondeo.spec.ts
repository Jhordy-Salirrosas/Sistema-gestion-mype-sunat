import { createHash } from 'node:crypto';
import { traducirEmision } from '../../../src/modules/invoices/application/services/emitirComprobanteAdapter';
import { UblGeneratorService } from '../../../src/modules/invoices/ublGeneratorService';
import { SignatureService } from '../../../src/modules/sunat/signature.service';
import { fakeIssuerCertificate } from '../../fixtures/fakeIssuerCertificate';
import { ejecutarSfs } from '../../../src/modules/invoices/application/services/sunatSfsRunner';
import { repartirDescuento, descuentosGlobalesPrecio } from '../../../src/modules/invoices/globalDiscountPrices';
import type { EmitirComprobanteDto } from '../../../src/modules/invoices/application/dto/emitirComprobanteDto';
import type { InvoicePayload } from '../../../src/modules/invoices/invoicePayload';
const issuer = { ruc: '20000000001', razonSocial: 'Obviously Fake Issuer', codigoLocalAnexo: '0000', direccion: 'Domicilio ficticio 123', ubigeo: '150101', departamento: 'LIMA', provincia: 'LIMA', distrito: 'LIMA' };
const dto = (): EmitirComprobanteDto => ({ tipo_comprobante: '01', serie: 'F001', fecha_emision: '2026-11-11', forma_pago: 'Contado', customer_identity_type: '6', customer_identity_number: '20100070970', customer_legal_name: 'Cliente prueba', items: [{ codigo: 'CEM', descripcion: 'Cemento', cantidad: 1, precioUnitario: 41.3, unidad: 'NIU', afectacion: '10' }] });
const xmlDe = (d: EmitirComprobanteDto) => new UblGeneratorService().generateInvoiceXml(traducirEmision(d, issuer, 1).dto.payload_ubl as unknown as InvoicePayload);
async function validar(xml: string) {
 const fake = fakeIssuerCertificate();
 const signed = new SignatureService({ getCertificate: () => ({ certificatePem: fake.pem, privateKeyPem: fake.privateKeyPem }) } as never).signXml(xml).signedXml;
 expect(await ejecutarSfs(signed, '01')).toEqual({ completado: true, errores: [] });
}
it.each(['linea', 'global'] as const)('precio neto 37.17 con descuento %s y SFS real firmado', async tipo => {
 const d = dto();
 if (tipo === 'linea') d.items[0].descuento = { codigo: '00', monto: 3.5 }; else d.descuento_global = { codigo: '02', monto: 3.5 };
 const xml = xmlDe(d);
 expect(xml).toContain('<cbc:PriceAmount currencyID="PEN">37.17</cbc:PriceAmount>');
 expect(xml).toContain('<cbc:PayableAmount currencyID="PEN">37.17</cbc:PayableAmount>');
 expect(xml).toContain('<cbc:MultiplierFactorNumeric>0.10000</cbc:MultiplierFactorNumeric>');
 // Global: la suma de bases de línea es 35; el allowance único de 3.50 da 31.50, IGV 5.67.
 const line = xml.match(/<cac:InvoiceLine>[\s\S]*?<\/cac:InvoiceLine>/)![0];
 expect(line).toContain(`<cbc:LineExtensionAmount currencyID="PEN">${tipo === 'global' ? '35.00' : '31.50'}</cbc:LineExtensionAmount>`);
 await validar(xml);
});
it('reparto HALF_UP y residuo en mayor base, empate primera', () => {
 expect(repartirDescuento(0.01, [1, 1, 1])).toEqual([0.01, 0, 0]);
 expect(repartirDescuento(0.02, [1, 2, 1])).toEqual([0.01, 0, 0.01]);
 expect(repartirDescuento(1, [0, 0])).toEqual([0, 0]);
});

it.each([[false, '1b1750e9b5592750e2b5e66ab148cbfe06aef3340f598da23c8fec5209254486'], [true, '1bc1c696d4076091dab3ec27539a296e40a1047fc17572dc309f5ecda42936bd']] as const)('sin descuento conserva bytes previos, SPOT=%s', (spot, hash) => {
 const d = dto();
 if (spot) { d.items[0].precioUnitario = 1180; d.items[0].codigoDetraccion = '009'; d.medio_pago_detraccion = '001'; d.cuenta_banco_nacion = '00019123456'; }
 expect(createHash('sha256').update(xmlDe(d)).digest('hex')).toBe(hash);
});
it('global 02 reparte solo bases gravadas, no modifica bases de línea ni descuenta dos veces', async () => {
 const d = dto(); d.items[0].precioUnitario = 11.8;
 d.items.push({ ...d.items[0], codigo: 'CEM2', precioUnitario: 23.6 }, { ...d.items[0], codigo: 'EXO', precioUnitario: 10, afectacion: '20' });
 d.descuento_global = { codigo: '02', monto: 3 };
 const xml = xmlDe(d);
 expect(xml).toContain('<cbc:PayableAmount currencyID="PEN">41.86</cbc:PayableAmount>');
 const lines = xml.match(/<cac:InvoiceLine>[\s\S]*?<\/cac:InvoiceLine>/g)!;
 for (const [i, price] of ['10.62', '21.24', '10.00'].entries()) expect(lines[i]).toContain(`<cbc:PriceAmount currencyID="PEN">${price}</cbc:PriceAmount>`);
 // La selección de bases mixtas se comprueba aquí; SFS se ejerce arriba con ambos descuentos gravados.
});
it.each(['01', '03'] as const)('descuento no afecta base IGV %s informa neto sin deducir otra vez', async codigo => {
 const d = dto(); if (codigo === '01') d.items[0].descuento = { codigo, monto: 3.5 }; else d.descuento_global = { codigo, monto: 3.5 };
 const xml = xmlDe(d); expect(xml).toContain('<cbc:PriceAmount currencyID="PEN">37.80</cbc:PriceAmount>');
 expect(xml).toContain('<cbc:PayableAmount currencyID="PEN">37.80</cbc:PayableAmount>');
 await validar(xml);
});

it('la atribución global no rebaja IGV inexistente en líneas pequeñas redondeadas', () => {
 const l = { id: 1, descripcion: 'Prueba', cantidad: 1, valorUnitario: 0.02, totalLinea: 0.02, igvLinea: 0, afectacion: '10' };
 expect(descuentosGlobalesPrecio([l, { ...l, id: 2 }], { codigo: '02', monto: 0.02 })).toEqual([0.01, 0.01]);
});
