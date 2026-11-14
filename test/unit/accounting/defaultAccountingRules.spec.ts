import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DEFAULT_ACCOUNTING_RULES } from '../../../src/modules/accounting/domain/rules/defaultAccountingRules';
import { cuentasConHijos } from '../../../src/modules/accounting/domain/rules/catalogIntegrityRule';

/**
 * Guarda de regresión de las reglas contables por defecto.
 *
 * Se contrastan contra la semilla del PCGE (la misma que se carga en
 * `accounting_accounts`) para que una regla no vuelva a apuntar a una cuenta
 * inexistente o a una cuenta de mayor con subcuentas. Ese error no rompe el
 * asiento —sigue cuadrando—, pero ensucia el mayor y el PLE, y por eso nadie lo
 * detectaba.
 *
 * Las excepciones son decisiones de Contabilidad documentadas en
 * `specs/M1-ASIENTO-DESCUENTOS.md` (cuenta 74 para descuentos) y en el informe
 * de auditoría (659, sin hoja útil en la semilla). Si aparece otra excepción,
 * esta prueba debe fallar para que se decida a conciencia.
 */

const EXCEPCIONES_DOCUMENTADAS = new Set(['74', '659']);

const leerCatalogo = (): Map<string, string> => {
  const contenido = readFileSync(join(process.cwd(), 'prisma', 'seeds', 'pcge2019.ts'), 'utf8');
  const cuentas = new Map<string, string>();
  for (const coincidencia of contenido.matchAll(/\["([0-9.]+)"\s*,\s*"([^"]*)"\]/g)) {
    cuentas.set(coincidencia[1], coincidencia[2]);
  }
  return cuentas;
};

const reglas = DEFAULT_ACCOUNTING_RULES.map(([proceso, doc, orden, cuenta, lado, base, descripcion]) => ({
  proceso,
  documento: doc,
  orden,
  cuenta,
  lado,
  base,
  descripcion,
}));

describe('Reglas contables por defecto', () => {
  const catalogo = leerCatalogo();

  it('el catálogo de la semilla tiene cuentas', () => {
    expect(catalogo.size).toBeGreaterThan(1000);
  });

  it('todas las cuentas de las reglas existen en el PCGE', () => {
    const faltantes = reglas.filter((r) => !catalogo.has(r.cuenta)).map((r) => `${r.proceso}:${r.cuenta}`);
    expect(faltantes).toEqual([]);
  });

  it('ninguna regla usa una cuenta de mayor con subcuentas (salvo las excepciones documentadas)', () => {
    // La regla de "cuenta agregada" es la misma que usa la auditoría: una
    // divisionaria con subdivisionarias opcionales (40111) sí se postea.
    const catalogoConPadres = [...catalogo.keys()].map((code) => ({
      code,
      parentCode: code.length > 1 ? code.slice(0, -1) : null,
    }));
    const agregadas = cuentasConHijos(catalogoConPadres);

    const problematicas = reglas
      .filter((r) => agregadas.has(r.cuenta) && !EXCEPCIONES_DOCUMENTADAS.has(r.cuenta))
      .map((r) => `${r.proceso} línea ${r.orden}: ${r.cuenta}`);

    expect(problematicas).toEqual([]);
  });

  it('cada proceso tiene sus líneas sin huecos', () => {
    const porProceso = new Map<string, number[]>();
    for (const r of reglas) {
      porProceso.set(r.proceso, [...(porProceso.get(r.proceso) ?? []), r.orden]);
    }
    for (const [proceso, ordenes] of porProceso) {
      const ordenadas = [...ordenes].sort((a, b) => a - b);
      expect({ proceso, ordenes: ordenadas }).toEqual({
        proceso,
        ordenes: ordenadas.map((_, i) => i + 1),
      });
    }
  });

  it('venta y compra usan las cuentas PCGE del diseño 60/40/42 y 12/40/70', () => {
    const venta = reglas.filter((r) => r.proceso === 'VENTA');
    const compra = reglas.filter((r) => r.proceso === 'COMPRA');
    expect(venta.find((r) => r.orden === 1)?.cuenta).toBe('12121');
    expect(venta.find((r) => r.orden === 2)?.cuenta).toBe('40111');
    expect(venta.find((r) => r.orden === 3)?.cuenta).toBe('70121');
    expect(compra.find((r) => r.orden === 1)?.cuenta).toBe('60111');
    expect(compra.find((r) => r.orden === 3)?.cuenta).toBe('42121');
  });

  it('la recepción y el ajuste usan subcuentas, no cuentas de mayor', () => {
    expect(reglas.find((r) => r.proceso === 'RECEPCION' && r.orden === 2)?.cuenta).toBe('6111');
    expect(reglas.find((r) => r.proceso === 'AJUSTE' && r.orden === 3)?.cuenta).toBe('7599');
  });
});
