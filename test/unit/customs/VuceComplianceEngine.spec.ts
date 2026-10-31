import { VuceComplianceEngine } from '../../../src/modules/customs/domain/rules/VuceComplianceEngine';

describe('VuceComplianceEngine (Domain Rule)', () => {
  it('debe detectar mercancías restringidas controladas por MTC (telecomunicaciones)', () => {
    const result = VuceComplianceEngine.verifyRestriction('8517.13.00.00'); // Smartphones
    expect(result.isRestricted).toBe(true);
    expect(result.controllingEntity).toBe('MTC');
    expect(result.isResolutionRequired).toBe(true);
    expect(result.permitName).toContain('Homologación');
  });

  it('debe detectar mercancías restringidas controladas por DIGEMID (medicamentos)', () => {
    const result = VuceComplianceEngine.verifyRestriction('3004.90.29.00');
    expect(result.isRestricted).toBe(true);
    expect(result.controllingEntity).toBe('DIGEMID');
  });

  it('debe detectar juguetes restringidos controlados por DIGESA', () => {
    const result = VuceComplianceEngine.verifyRestriction('9503.00.10.00');
    expect(result.isRestricted).toBe(true);
    expect(result.controllingEntity).toBe('DIGESA');
  });

  it('debe permitir mercancías de libre comercialización sin restricciones', () => {
    const result = VuceComplianceEngine.verifyRestriction('8471.30.00.00'); // Laptops estándar
    expect(result.isRestricted).toBe(false);
    expect(result.controllingEntity).toBeUndefined();
    expect(result.isResolutionRequired).toBe(false);
  });

  it('debe procesar lotes de ítems y retornar solo las restricciones detectadas', () => {
    const items = [
      { hsCode: '8471.30.00.00', commercialDescription: 'Laptop Gamer' },
      { hsCode: '8517.13.00.00', commercialDescription: 'Smartphone 5G' },
      { hsCode: '9503.00.10.00', commercialDescription: 'Set de juguetes plásticos' },
    ];
    const restricted = VuceComplianceEngine.verifyBatch(items);
    expect(restricted).toHaveLength(2);
    expect(restricted.map((r) => r.controllingEntity)).toEqual(['MTC', 'DIGESA']);
  });
});

