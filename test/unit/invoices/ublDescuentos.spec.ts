import { bloqueLinea } from '../../../src/modules/invoices/xmlNodesHelper';

describe('UBL descuentos por línea', () => {
  const linea = { id: 1, descripcion: 'Servicio', cantidad: 1, valorUnitario: 100, afectacion: '10', totalLinea: 106.2, igvLinea: 16.2, descuentos: [{ codigo: '00', monto: 10 }] };
  it.each(['Invoice', 'CreditNote', 'DebitNote'] as const)('usa BaseAmount básico y orden UBL para %s', (raiz) => {
    const xml = bloqueLinea(linea, 'PEN', raiz);
    if (raiz !== 'Invoice') {
      expect(xml).not.toContain('AllowanceCharge');
      expect(xml).toContain('<cbc:LineExtensionAmount currencyID="PEN">90.00</cbc:LineExtensionAmount>');
      expect(xml).toContain('<cac:Price>\n      <cbc:PriceAmount currencyID="PEN">90.00</cbc:PriceAmount>');
      expect(xml.indexOf('<cac:PricingReference>')).toBeLessThan(xml.indexOf('<cac:TaxTotal>'));
      return;
    }
    expect(xml).toContain('<cbc:BaseAmount currencyID="PEN">100.00</cbc:BaseAmount>');
    expect(xml).not.toContain('<cac:BaseAmount');
    const precio = xml.indexOf('<cac:PricingReference>');
    const descuento = xml.indexOf('<cac:AllowanceCharge>');
    const tributo = xml.indexOf('<cac:TaxTotal>');
    expect(precio).toBeLessThan(descuento);
    expect(descuento).toBeLessThan(tributo);
  });
});
