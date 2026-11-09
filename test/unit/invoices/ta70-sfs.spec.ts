import { readFileSync } from 'node:fs';
import { ejecutarSfs } from '../../../src/modules/invoices/application/services/sunatSfsRunner';
import { SunatXslValidatorService } from '../../../src/modules/invoices/application/services/sunatXslValidatorService';

describe('TA-70: ejecución real del SFS', () => {
  const factura = () => readFileSync('test/fixtures/sfs/factura.xml', 'utf8');
  it('extrae el primer rechazo 3088 con mensaje y nodo, sin convertir avisos en errores', async () => {
    const xml = factura().replace('>PEN</cbc:DocumentCurrencyCode>', '>BTC</cbc:DocumentCurrencyCode>');
    const result = await ejecutarSfs(xml, '01');
    expect(result).toMatchObject({ completado: true, errores: [{ codigo: '3088', nodo: 'Invoice/cbc:DocumentCurrencyCode' }] });
    expect(result.errores).toHaveLength(1);
    expect(result.errores[0].mensaje).toContain('BTC');
  });

  it('mapea el primer rechazo SUNAT al contrato del servicio', async () => {
    const xml = factura().replace('<cbc:AddressTypeCode>0000</cbc:AddressTypeCode>', '');
    const result = await new SunatXslValidatorService().validar(xml, '01');
    expect(result).toMatchObject({ valido: false, bloqueado: false, validadoDeVerdad: true, errores: [{ codigo: '3030' }] });
  });

  it('rechaza estructura inválida antes del error XSL 3088 de moneda', async () => {
    const xml = factura().replace('<cbc:ID>F001-1</cbc:ID>', '').replace('>PEN</cbc:DocumentCurrencyCode>', '>BTC</cbc:DocumentCurrencyCode>');
    const result = await new SunatXslValidatorService().validar(xml, '01');
    expect(result).toMatchObject({ valido: false, validadoDeVerdad: true, errores: [{ codigo: 'XSD' }] });
    expect(result.errores[0].nodo).toBeTruthy();
  });

  it('no convierte un XML mal formado en éxito ni en fallo de infraestructura', async () => {
    expect(await ejecutarSfs('<Invoice>', '01')).toMatchObject({ completado: true, errores: [{ codigo: 'XSD' }] });
  });
});
