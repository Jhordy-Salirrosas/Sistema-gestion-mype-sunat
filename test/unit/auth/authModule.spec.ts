import { MODULE_METADATA } from '@nestjs/common/constants';
import { AuthModule } from '../../../src/modules/auth/authModule';
import { SOL_CREDENTIAL_CIPHER } from '../../../src/modules/auth/domain/ports/solCredentialCipherPort';
import { SolCredentialCipher } from '../../../src/modules/auth/infrastructure/security/solCredentialCipher';

describe('AuthModule SOL cipher provider', () => {
  const originalKey = process.env.SOL_CREDENTIALS_ENCRYPTION_KEY;

  afterEach(() => {
    if (originalKey === undefined) {
      delete process.env.SOL_CREDENTIALS_ENCRYPTION_KEY;
    } else {
      process.env.SOL_CREDENTIALS_ENCRYPTION_KEY = originalKey;
    }
  });

  it('creates a cipher from the configured key and fails closed when absent', () => {
    const providers = Reflect.getMetadata(
      MODULE_METADATA.PROVIDERS,
      AuthModule,
    ) as Array<{
      provide: unknown;
      useFactory?: () => unknown;
    }>;
    const cipherProvider = providers.find(
      (provider) => provider.provide === SOL_CREDENTIAL_CIPHER,
    );

    expect(cipherProvider?.useFactory).toBeDefined();
    process.env.SOL_CREDENTIALS_ENCRYPTION_KEY =
      'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=';
    expect(cipherProvider?.useFactory?.()).toBeInstanceOf(SolCredentialCipher);

    delete process.env.SOL_CREDENTIALS_ENCRYPTION_KEY;
    expect(() => cipherProvider?.useFactory?.()).toThrow(
      /clave Base64 válida de 32 bytes/,
    );
  });
});
