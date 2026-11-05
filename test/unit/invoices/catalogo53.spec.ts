import { CATALOGO_53_DESCUENTOS } from '../../../src/modules/invoices/sunatCatalogs';

describe('Catálogo 53 de descuentos', () => {
  it('distingue los códigos de ítem y globales', () => {
    expect(Object.keys(CATALOGO_53_DESCUENTOS)).toEqual(['00', '01', '02', '03', '04']);
    expect(CATALOGO_53_DESCUENTOS['00'].nivel).toBe('ITEM');
    expect(CATALOGO_53_DESCUENTOS['01'].nivel).toBe('ITEM');
    for (const codigo of ['02', '03', '04'] as const) expect(CATALOGO_53_DESCUENTOS[codigo].nivel).toBe('GLOBAL');
  });
});
