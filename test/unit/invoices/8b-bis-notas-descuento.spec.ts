import { createHash } from 'node:crypto';
import { traducirEmision } from '../../../src/modules/invoices/application/services/emitirComprobanteAdapter';
import { UblGeneratorService } from '../../../src/modules/invoices/ublGeneratorService';
import { SignatureService } from '../../../src/modules/sunat/signature.service';
import { fakeIssuerCertificate } from '../../fixtures/fakeIssuerCertificate';
import { ejecutarSfs } from '../../../src/modules/invoices/application/services/sunatSfsRunner';
import type { EmitirComprobanteDto } from '../../../src/modules/invoices/application/dto/emitirComprobanteDto';
import type { InvoicePayload } from '../../../src/modules/invoices/invoicePayload';
const issuer = { ruc: '20000000001', razonSocial: 'Obviously Fake Issuer', codigoLocalAnexo: '0000', direccion: 'Domicilio ficticio 123', ubigeo: '150101', departamento: 'LIMA', provincia: 'LIMA', distrito: 'LIMA' };
function payload(tipo: string, codigo: string | null, cantidad = 1): InvoicePayload {
 const d = { tipo_comprobante: tipo, serie: tipo === '07' ? 'FC01' : tipo === '08' ? 'FD01' : tipo === '03' ? 'B001' : 'F001', fecha_emision: '2026-11-11', forma_pago: 'Contado', customer_identity_type: '6', customer_identity_number: '20100070970', customer_legal_name: 'Cliente ficticio', documento_afectado: ['07', '08'].includes(tipo) ? 'F001-00000069' : undefined, codigo_motivo_nota: tipo === '07' ? '06' : tipo === '08' ? '02' : undefined, descripcion_motivo_nota: tipo === '07' ? 'Devolución total' : tipo === '08' ? 'Aumento en el valor' : undefined, items: [{ codigo: 'CEM-001', descripcion: 'Cemento Portland tipo I (bolsa 42.5 kg)', cantidad, precioUnitario: 41.3, afectacion: '10', unidad: 'NIU', descuento: codigo ? { codigo, monto: 3.5 } : undefined }] };
 return traducirEmision(d as EmitirComprobanteDto, issuer, 15).dto.payload_ubl as unknown as InvoicePayload;
}
it.each([['07',1],['08',1],['07',3],['08',3]] as const)('certificación candidata %s: descuento 00, cantidad %s, sin certificar SUNAT', async (tipo, cantidad) => {
 const p = payload(tipo, '00', cantidad); const before = JSON.stringify(p);
 const xml = new UblGeneratorService().generateInvoiceXml(p);
 const line = xml.match(/<cac:(?:CreditNoteLine|DebitNoteLine)>[\s\S]*?<\/cac:(?:CreditNoteLine|DebitNoteLine)>/)![0];
 expect(line).not.toContain('AllowanceCharge');
 expect(line).toContain(`<cac:Price>\n      <cbc:PriceAmount currencyID="PEN">${cantidad === 1 ? '31.50' : '33.8333333333'}</cbc:PriceAmount>`);
 expect(line).toContain(`<cbc:LineExtensionAmount currencyID="PEN">${cantidad === 1 ? '31.50' : '101.50'}</cbc:LineExtensionAmount>`);
 expect(line).toContain(`<cbc:PriceAmount currencyID="PEN">${cantidad === 1 ? '37.17' : '39.92333'}</cbc:PriceAmount>\n        <cbc:PriceTypeCode>01</cbc:PriceTypeCode>`);
 expect(xml).toContain(`<cbc:PayableAmount currencyID="PEN">${cantidad === 1 ? '37.17' : '119.77'}</cbc:PayableAmount>`);
 expect(JSON.stringify(p)).toBe(before);
 expect(p.lineas?.[0]).toMatchObject({ valorUnitario: 35, precioUnitario: 41.3, descuentos: [{ codigo: '00', monto: 3.5 }] });
 const cert = fakeIssuerCertificate();
 const signed = new SignatureService({ getCertificate: () => ({ certificatePem: cert.pem, privateKeyPem: cert.privateKeyPem }) } as never).signXml(xml).signedXml;
 expect(await ejecutarSfs(signed, tipo)).toEqual({ completado: true, errores: [] });
});

// SHA-256 tomados del generador main antes del cambio, sin modificar snapshots existentes.
const controles = [
  {
    "tipo": "01",
    "codigo": "00",
    "hash": "1ddae0fb20c69e5d1578c89a7c31683daa7be405fe8ccca5311b628ff11478c4"
  },
  {
    "tipo": "01",
    "codigo": "01",
    "hash": "8ce10a790d4ef6ba50980b34dac59700bbbc98363f51af894a0b30004483b1a8"
  },
  {
    "tipo": "03",
    "codigo": "00",
    "hash": "4fe52db60dfb447244ee8f949eabf161094454d53ac3877edf1d82b8fc3035dd"
  },
  {
    "tipo": "03",
    "codigo": "01",
    "hash": "268c4746bf9eb18c7c73114d0970a45baa389eb267ed67b8120b8d05ba25f057"
  },
  {
    "tipo": "07",
    "codigo": "01",
    "hash": "2e58054fae0f17a8c541c61f4b58ad128008e7966e46ebdccecbedf0404fbccf"
  },
  {
    "tipo": "08",
    "codigo": "01",
    "hash": "13dcf0efacc652c17128076369cae84a6d8d7c2886e0685e87346ebd885aff45"
  },
  {
    "tipo": "07",
    "codigo": null,
    "hash": "da337953737e766572a097635b2065b9b5eead769619e7bc17f167537fec5478"
  },
  {
    "tipo": "08",
    "codigo": null,
    "hash": "c96662beb8426d7c464ac7075b426388d758cc7606ef5abfb9699938229a3e26"
  }
];
it.each(controles)('conserva XML byte a byte: $tipo, descuento $codigo', ({tipo,codigo,hash}) => { expect(createHash('sha256').update(new UblGeneratorService().generateInvoiceXml(payload(tipo,codigo))).digest('hex')).toBe(hash); });
