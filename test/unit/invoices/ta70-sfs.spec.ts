import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { validaDeVerdad } from '../../../src/modules/invoices/application/services/sunatXslAdapter';
import { ejecutarSfs } from '../../../src/modules/invoices/application/services/sunatSfsRunner';
import { SunatXslValidatorService } from '../../../src/modules/invoices/application/services/sunatXslValidatorService';

describe('TA-70: ejecución real del SFS', () => {
  const factura = () => readFileSync('test/fixtures/sfs/factura.xml', 'utf8');
  const python = process.env.SUNAT_SFS_PYTHON;
  afterEach(() => {
    if (python === undefined) delete process.env.SUNAT_SFS_PYTHON;
    else process.env.SUNAT_SFS_PYTHON = python;
  });
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

  it('sin evidencia de ejecución no acredita validación', () => {
    expect(validaDeVerdad()).toBe(false);
    expect(validaDeVerdad({ completado: false })).toBe(false);
    expect(validaDeVerdad({ completado: true })).toBe(true);
  });

  it('ejecutor ausente devuelve NO concluyente y nunca válido', async () => {
    process.env.SUNAT_SFS_PYTHON = '/no-existe/python-sfs';
    const result = await new SunatXslValidatorService().validar(factura(), '01');
    expect(result).toMatchObject({ valido: false, bloqueado: true, validadoDeVerdad: false, errores: [] });
    expect(result.motivoBloqueo).toContain('no disponible');
  });

  it('mata un ejecutor que excede el plazo y no reutiliza un éxito previo', async () => {
    const servicio = new SunatXslValidatorService();
    expect((await servicio.validar(factura().replace('<cbc:AddressTypeCode>0000</cbc:AddressTypeCode>', ''), '01')).validadoDeVerdad).toBe(true);
    const dir = mkdtempSync(join(tmpdir(), 'ta70-timeout-'));
    try {
      const slow = join(dir, 'python');
      writeFileSync(slow, '#!/usr/bin/env python3\nimport time\ntime.sleep(30)\n');
      chmodSync(slow, 0o700);
      process.env.SUNAT_SFS_PYTHON = slow;
      const inicio = Date.now();
      expect(await servicio.validar(factura(), '01')).toMatchObject({ valido: false, bloqueado: true, validadoDeVerdad: false, motivoBloqueo: 'Ejecutor SFS excedió 2000 ms' });
      expect(Date.now() - inicio).toBeLessThan(4000);
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });
});
