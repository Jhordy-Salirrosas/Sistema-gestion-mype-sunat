import { bloqueLinea } from '../../../src/modules/invoices/xmlNodesHelper';

describe('UBL descuentos por línea', () => {
  const linea = { id: 1, descripcion: 'Servicio', cantidad: 1, valorUnitario: 100, afectacion: '10', totalLinea: 118, igvLinea: 18, descuentos: [{ codigo: '00', monto: 10 }] };
  it.each(['Invoice', 'CreditNote', 'DebitNote'] as const)('usa BaseAmount básico y orden UBL para %s', (raiz) => {
    const xml = bloqueLinea(linea, 'PEN', raiz);
    expect(xml).toContain('<cbc:BaseAmount currencyID="PEN">100.00</cbc:BaseAmount>');
    expect(xml).not.toContain('<cac:BaseAmount');
    const precio = xml.indexOf('<cac:PricingReference>');
    const descuento = xml.indexOf('<cac:AllowanceCharge>');
    const tributo = xml.indexOf('<cac:TaxTotal>');
    expect(precio).toBeLessThan(descuento);
    if (raiz === 'Invoice') expect(descuento).toBeLessThan(tributo);
    else expect(tributo).toBeLessThan(descuento);
  });
});
