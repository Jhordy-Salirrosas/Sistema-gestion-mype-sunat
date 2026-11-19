import { ServiceUnavailableException } from '@nestjs/common';
import { UnsupportedSireSunatGateway } from '../../../src/modules/sire/infrastructure/sunat/unsupportedSireSunatGateway';

describe('UnsupportedSireSunatGateway', () => {
  it('fails explicitly instead of returning a success-shaped proposal', async () => {
    const gateway = new UnsupportedSireSunatGateway();

    await expect(
      gateway.getProposal('company-test', '202610', 'RCE'),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('does not simulate successful production operations', async () => {
    const gateway = new UnsupportedSireSunatGateway();

    await expect(
      gateway.generateRecord('company-test', '202610', 'RVIE'),
    ).rejects.toMatchObject({ status: 503 });
  });
});
