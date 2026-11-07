import { describe, expect, it } from 'vitest';
import { requiereRevisionContableXml } from '@/modules/invoices/lib/invoiceTributosXml';
const wrap = (codigo: string) => `<Invoice xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2" xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2"><cac:AllowanceCharge><cbc:AllowanceChargeReasonCode>${codigo}</cbc:AllowanceChargeReasonCode></cac:AllowanceCharge></Invoice>`;
describe('aviso contable por descuentos', () => {
  it('detecta solo 01 y 03 en el XML', () => {
    expect(requiereRevisionContableXml(wrap('01'))).toBe(true);
    expect(requiereRevisionContableXml(wrap('03'))).toBe(true);
    expect(requiereRevisionContableXml(wrap('02'))).toBe(false);
    expect(requiereRevisionContableXml('<mal')).toBe(false);
  });
});
