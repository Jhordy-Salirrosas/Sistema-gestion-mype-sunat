import { ServiceUnavailableException } from '@nestjs/common';
import { UnsupportedSireSunatGateway } from '../../../src/modules/sire/infrastructure/sunat/unsupportedSireSunatGateway';

describe('UnsupportedSireSunatGateway', () => {
  it('fails explicitly instead of returning a success-shaped proposal', async () => {
    const gateway = new UnsupportedSireSunatGateway();

    await expect(
      gateway.getProposal('company-test', '202610', 'RCE'),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('does not expose any operation that writes to SUNAT', () => {
    const gateway = new UnsupportedSireSunatGateway() as unknown as Record<
      string,
      unknown
    >;

    expect(gateway.acceptProposal).toBeUndefined();
    expect(gateway.replaceProposal).toBeUndefined();
    expect(gateway.registerPreliminary).toBeUndefined();
    expect(gateway.deletePreliminary).toBeUndefined();
    expect(gateway.generateRecord).toBeUndefined();
    expect(gateway.excludeRecord).toBeUndefined();
    expect(gateway.restoreRecord).toBeUndefined();
  });
});
