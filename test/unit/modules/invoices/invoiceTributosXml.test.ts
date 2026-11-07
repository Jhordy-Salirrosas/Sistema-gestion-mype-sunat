import { describe, expect, it } from 'vitest';
import { leerTributosXml, NOMBRES_AFECTACION, NOMBRES_TRIBUTO, rotularCodigo } from '@/modules/invoices/lib/invoiceTributosXml';

describe('códigos fiscales del XML firmado', () => {
  it('distingue afectación 07 del tributo 05 sin rellenar datos ausentes', () => {
    const xml = `<Invoice xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2" xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2"><cac:InvoiceLine><cbc:ID>1</cbc:ID><cac:TaxTotal><cac:TaxSubtotal><cac:TaxCategory><cbc:TaxExemptionReasonCode>20</cbc:TaxExemptionReasonCode><cac:TaxScheme><cbc:ID>9997</cbc:ID></cac:TaxScheme></cac:TaxCategory></cac:TaxSubtotal><cac:TaxSubtotal><cac:TaxCategory><cac:TaxScheme><cbc:ID>7152</cbc:ID></cac:TaxScheme></cac:TaxCategory></cac:TaxSubtotal></cac:TaxTotal><cac:Item><cbc:Description>Bolsa</cbc:Description></cac:Item></cac:InvoiceLine></Invoice>`;
    expect(leerTributosXml(xml)).toEqual([
      { id: '1', descripcion: 'Bolsa', afectacion: '20', tributo: '9997' },
      { id: '1', descripcion: 'Bolsa', afectacion: null, tributo: '7152' },
    ]);
    expect(rotularCodigo('20', NOMBRES_AFECTACION)).toContain('Exonerado');
    for (const id of ['9996', '9997', '9998']) expect(rotularCodigo(id, NOMBRES_TRIBUTO)).not.toContain('no reconocido');
    expect(rotularCodigo(null, NOMBRES_TRIBUTO)).toBe('No registrado');
    expect(leerTributosXml('<broken')).toEqual([]);
  });
});
