import { readFileSync } from 'node:fs';
import { ejecutarSfs } from '../../../src/modules/invoices/application/services/sunatSfsRunner';
import { SunatXslValidatorService } from '../../../src/modules/invoices/application/services/sunatXslValidatorService';

describe('TA-70: ejecución real del SFS', () => {
  it('extrae el primer rechazo 3088 con mensaje y nodo, sin convertir avisos en errores', async () => {
    const xml = readFileSync('assets/sunat-sfs/verificacion/factura_btc.xml', 'utf8');
    const result = await ejecutarSfs(xml, '01');
    expect(result).toMatchObject({ completado: true, errores: [{ codigo: '3088', nodo: 'Invoice/cbc:DocumentCurrencyCode' }] });
    expect(result.errores).toHaveLength(1);
    expect(result.errores[0].mensaje).toContain('BTC');
  });

  it('mapea el primer rechazo SUNAT al contrato del servicio', async () => {
    const xml = readFileSync('assets/sunat-sfs/verificacion/factura_pen.xml', 'utf8');
    const result = await new SunatXslValidatorService().validar(xml, '01');
    expect(result).toMatchObject({ valido: false, bloqueado: false, validadoDeVerdad: true, errores: [{ codigo: '3030' }] });
  });
});
