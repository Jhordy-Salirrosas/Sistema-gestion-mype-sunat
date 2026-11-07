import { selectSireSunatGateway } from '../../../src/modules/sire/infrastructure/sunat/sireGatewaySelector';
import type { SireSunatGatewayPort } from '../../../src/modules/sire/domain/ports/sireSunatGatewayPort';

describe('selectSireSunatGateway', () => {
  const mockGateway = {} as SireSunatGatewayPort;
  const unsupportedGateway = {} as SireSunatGatewayPort;

  it('uses the mock only when explicitly selected outside production', () => {
    expect(
      selectSireSunatGateway(
        'mock',
        'development',
        mockGateway,
        unsupportedGateway,
      ),
    ).toBe(mockGateway);
  });

  it.each(['beta', 'produccion', undefined])(
    'does not activate a live integration for %s',
    (environment) => {
      expect(
        selectSireSunatGateway(
          environment,
          'development',
          mockGateway,
          unsupportedGateway,
        ),
      ).toBe(unsupportedGateway);
    },
  );

  it('never enables the mock gateway in production', () => {
    expect(
      selectSireSunatGateway(
        'mock',
        'production',
        mockGateway,
        unsupportedGateway,
      ),
    ).toBe(unsupportedGateway);
  });
});
