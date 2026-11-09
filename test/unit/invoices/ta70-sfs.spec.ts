import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
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

  it.each([['factura', '01'], ['boleta', '03'], ['nota-credito', '07'], ['nota-debito', '08']])('valida %s completa de punta a punta con las adaptaciones autorizadas', async (nombre, tipo) => {
    const xml = readFileSync(`test/fixtures/sfs/${nombre}.xml`, 'utf8');
    expect(await ejecutarSfs(xml, tipo)).toEqual({ completado: true, errores: [] });
    expect(await new SunatXslValidatorService().validar(xml, tipo)).toEqual({
      valido: true, bloqueado: false, validadoDeVerdad: true, errores: [],
      motivoBloqueo: null, codigosDesconocidos: [],
    });
  });

  it('la cuarta adaptación cambia solo identificadores en las líneas autorizadas', () => {
    execFileSync(python ?? 'python3', ['test/unit/invoices/ta70_sfs_adaptations_test.py'], {
      env: { ...process.env, PYTHONDONTWRITEBYTECODE: '1' }, timeout: 2000,
    });
  });

  it('NC conserva el rechazo SUNAT 2172 para un motivo fuera de catálogo', async () => {
    const xml = readFileSync('test/fixtures/sfs/nota-credito.xml', 'utf8')
      .replace('<cbc:ResponseCode>01</cbc:ResponseCode>', '<cbc:ResponseCode>99</cbc:ResponseCode>');
    expect(await ejecutarSfs(xml, '07')).toMatchObject({ completado: true, errores: [{ codigo: '2172', nodo: 'cac:DiscrepancyResponse/cbc:ResponseCode' }] });
  });

  it('Factura conserva el rechazo SUNAT 2369 en la validación de líneas', async () => {
    const xml = factura().replace('<cbc:PriceAmount currencyID="PEN">100.00</cbc:PriceAmount>', '<cbc:PriceAmount currencyID="PEN">-1.00</cbc:PriceAmount>');
    expect(await ejecutarSfs(xml, '01')).toMatchObject({ completado: true, errores: [{ codigo: '2369', nodo: 'cac:Price/cbc:PriceAmount' }] });
  });

  it.each(['01', '03', '07', '08'])('aplica el esquema oficial del tipo %s antes de la hoja', async tipo => {
    const result = await ejecutarSfs('<OtroDocumento/>', tipo);
    expect(result).toMatchObject({ completado: true, errores: [{ codigo: 'XSD' }] });
  });

  it('ejecutor ausente devuelve NO concluyente y nunca válido', async () => {
    process.env.SUNAT_SFS_PYTHON = '/no-existe/python-sfs';
    const result = await new SunatXslValidatorService().validar(factura(), '01');
    expect(result).toMatchObject({ valido: false, bloqueado: true, validadoDeVerdad: false, errores: [] });
    expect(result.motivoBloqueo).toContain('no disponible');
  });

  it('mata un ejecutor que excede el plazo y no reutiliza un éxito previo', async () => {
    const servicio = new SunatXslValidatorService();
    expect((await servicio.validar(factura(), '01')).valido).toBe(true);
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
