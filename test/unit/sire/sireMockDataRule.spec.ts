import {
  calcularResumenSimulado,
  cantidadComprobantesSimulados,
  generarComprobantesSimulados,
  SIRE_MAXIMO_COMPROBANTES_SIMULADOS,
  SIRE_MINIMO_COMPROBANTES_SIMULADOS,
} from '../../../src/modules/sire/domain/rules/sireMockDataRule';

describe('sireMockDataRule', () => {
  it('grows the simulated document count with the imports of the period', () => {
    expect(cantidadComprobantesSimulados(0)).toBe(
      SIRE_MINIMO_COMPROBANTES_SIMULADOS,
    );
    expect(cantidadComprobantesSimulados(10)).toBe(40);
  });

  it('never returns more documents than the allowed maximum', () => {
    expect(cantidadComprobantesSimulados(10_000)).toBe(
      SIRE_MAXIMO_COMPROBANTES_SIMULADOS,
    );
  });

  it('is deterministic: the same period and book always give the same list', () => {
    const primero = generarComprobantesSimulados('202401', 'RCE', 3);
    const segundo = generarComprobantesSimulados('202401', 'RCE', 3);

    expect(segundo).toEqual(primero);
  });

  it('produces different data for a different period', () => {
    const enero = generarComprobantesSimulados('202401', 'RCE', 3);
    const febrero = generarComprobantesSimulados('202402', 'RCE', 3);

    expect(febrero).not.toEqual(enero);
  });

  it('emits documents dated inside the requested period', () => {
    const comprobantes = generarComprobantesSimulados('202402', 'RVIE', 2);

    for (const comprobante of comprobantes) {
      expect(comprobante.fechaEmision).toMatch(/^2024-02-\d{2}$/);
    }
  });

  it('keeps the IGV at 18% of the taxable base', () => {
    const comprobantes = generarComprobantesSimulados('202401', 'RCE', 2);

    for (const comprobante of comprobantes) {
      expect(comprobante.igv).toBeCloseTo(comprobante.baseImponible * 0.18, 2);
      expect(comprobante.total).toBeCloseTo(
        comprobante.baseImponible + comprobante.igv,
        2,
      );
    }
  });

  it('adds up the summary from the generated documents', () => {
    const comprobantes = generarComprobantesSimulados('202401', 'RCE', 4);
    const resumen = calcularResumenSimulado('202401', 'RCE', comprobantes);

    expect(resumen.totalComprobantes).toBe(comprobantes.length);
    expect(resumen.conciliados + resumen.diferencias).toBe(
      comprobantes.length,
    );
    expect(resumen.total).toBeCloseTo(
      resumen.baseImponible + resumen.igv,
      2,
    );
    expect(resumen.porcentajeConciliado).toBeGreaterThanOrEqual(0);
    expect(resumen.porcentajeConciliado).toBeLessThanOrEqual(100);
  });

  it('reports a zero percentage when there is nothing to reconcile', () => {
    const resumen = calcularResumenSimulado('202401', 'RCE', []);

    expect(resumen.porcentajeConciliado).toBe(0);
    expect(resumen.totalComprobantes).toBe(0);
  });
});
