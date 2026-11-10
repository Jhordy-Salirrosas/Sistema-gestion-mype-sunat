import { validarClasificacionSpot, validarCuentaSpot } from '../../../src/modules/invoices/application/services/spotMinimo';
import { validateIssuerInput } from '../../../src/modules/invoices/application/services/issuerConfigWriter';
import { traducirEmision } from '../../../src/modules/invoices/application/services/emitirComprobanteAdapter';
import { UblGeneratorService } from '../../../src/modules/invoices/ublGeneratorService';
import { SignatureService } from '../../../src/modules/sunat/signature.service';
import { fakeIssuerCertificate } from '../../fixtures/fakeIssuerCertificate';
import { ejecutarSfs } from '../../../src/modules/invoices/application/services/sunatSfsRunner';
import type { EmitirComprobanteDto } from '../../../src/modules/invoices/application/dto/emitirComprobanteDto';
import type { InvoicePayload } from '../../../src/modules/invoices/invoicePayload';
const issuer = { ruc: '20000000001', razonSocial: 'Obviously Fake Issuer', codigoLocalAnexo: '0000', direccion: 'Domicilio ficticio 123', ubigeo: '150101', departamento: 'LIMA', provincia: 'LIMA', distrito: 'LIMA' };
const dto = (precio = 1180): EmitirComprobanteDto => ({ tipo_comprobante: '01', serie: 'F001', fecha_emision: '2026-11-10', forma_pago: 'Contado', customer_identity_type: '6', customer_identity_number: '20100070970', customer_legal_name: 'Cliente prueba', medio_pago_detraccion: precio > 700 ? '001' : undefined, items: [{ codigo: 'ARE', descripcion: 'Arena', cantidad: 1, precioUnitario: precio, unidad: 'MTQ', afectacion: '10', codigoDetraccion: '009' }] });
it.each([699.99, 700, 700.01, 1180])('009 aplica 10%% solo sobre total mayor a 700: %s', total => {
 const d = dto(total); validarClasificacionSpot(d);
 const r = traducirEmision(d, issuer, 1);
 expect(r.importes.detraccion).toBe(total > 700 ? Math.round(total * 10) / 100 : 0);
 expect(r.dto.payload_ubl.tipoOperacion).toBe(total > 700 ? '1001' : '0101');
 expect(validarCuentaSpot(d, r.importes.detraccion, total > 700 ? '00019123456' : null)).toBe(total > 700 ? '00019123456' : null);
});
it.each(['03', '07', '08'])('no habilita SPOT para documento %s', tipo => {
 expect(() => validarClasificacionSpot({ ...dto(), tipo_comprobante: tipo as never })).toThrow('solo para factura');
});
it('bloquea mezcla, códigos fuera del mínimo y líneas no gravadas', () => {
 for (const cambio of [{ codigoDetraccion: undefined }, { codigoDetraccion: '012' }, { afectacion: '20' }]) {
 const d = dto(); d.items.push({ ...d.items[0], ...cambio });
 expect(() => validarClasificacionSpot(d)).toThrow('operaciones mixtas');
 }
});
it('cuenta solo de empresa, medio explícito 001/003 y nada de 999', () => {
 expect(() => validarCuentaSpot(dto(), 118, null)).toThrow('falta la cuenta');
 expect(() => validarCuentaSpot({ ...dto(), cuenta_banco_nacion: '99999999999' }, 118, '00019123456')).toThrow('debe coincidir');
 for (const medio of [undefined, '999', '008']) expect(() => validarCuentaSpot({ ...dto(), medio_pago_detraccion: medio as never }, 118, '00019123456')).toThrow('001 o 003');
 expect(validarCuentaSpot({ ...dto(), medio_pago_detraccion: '003' }, 118, '00019123456')).toBe('00019123456');
 expect(validateIssuerInput({ cuenta_banco_nacion: '00019123456' })).toEqual({ cuenta_banco_nacion: '00019123456' });
 expect(() => validateIssuerInput({ cuenta_banco_nacion: 'abc' })).toThrow();
});
it.each(['001', '003'] as const)('XML generado 009 firmado pasa XSD/XSL real, medio %s, porcentaje y monto correctos', async medio => {
 const p = traducirEmision({ ...dto(), medio_pago_detraccion: medio, cuenta_banco_nacion: '00019123456' }, issuer, 1).dto.payload_ubl as unknown as InvoicePayload;
 expect(p.lineas?.[0].codigoDetraccion).toBe('009');
 expect(p).toMatchObject({ tasaDetraccion: 0.1, montoDetraccion: 118, cuentaBancoNacion: '00019123456' });
 const xml = new UblGeneratorService().generateInvoiceXml(p);
 expect(xml).toContain('<cbc:PaymentPercent>10.00</cbc:PaymentPercent>');
 expect(xml).toContain(`<cbc:PaymentMeansCode>${medio}</cbc:PaymentMeansCode>`);
 expect(xml).toContain('<cbc:Amount currencyID="PEN">118.00</cbc:Amount>');
 expect(xml).toContain('<cbc:PayableAmount currencyID="PEN">1180.00</cbc:PayableAmount>');
 expect(xml).toContain('languageLocaleID="1000">MIL CIENTO OCHENTA');
 expect(xml).toContain('languageLocaleID="2006">Operación sujeta al Sistema de Pago');
 const fake = fakeIssuerCertificate();
 const signed = new SignatureService({ getCertificate: () => ({ certificatePem: fake.pem, privateKeyPem: fake.privateKeyPem }) } as never).signXml(xml).signedXml;
 expect(await ejecutarSfs(signed, '01')).toEqual({ completado: true, errores: [] });
});
