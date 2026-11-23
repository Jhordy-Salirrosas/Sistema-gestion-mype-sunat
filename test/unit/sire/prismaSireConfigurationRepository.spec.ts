import { NotFoundException } from '@nestjs/common';
import type { PrismaService } from '../../../src/database/prismaService';
import type { SolCredentialCipherPort } from '../../../src/modules/auth/domain/ports/solCredentialCipherPort';
import { SolCredentialCipherUnavailableError } from '../../../src/modules/auth/infrastructure/security/solCredentialCipher';
import { ClientSafeHttpException } from '../../../src/common/exceptions';
import { PrismaSireConfigurationRepository } from '../../../src/modules/sire/infrastructure/persistence/prismaSireConfigurationRepository';

const COMPANY_ID = 'company-id';

function crearPrisma(existing: Record<string, unknown> | null = null) {
  return {
    sireConfiguration: {
      findUnique: jest.fn().mockResolvedValue(existing),
      upsert: jest.fn().mockResolvedValue({ id: 'config-id' }),
    },
  } as unknown as PrismaService & {
    sireConfiguration: {
      findUnique: jest.Mock;
      upsert: jest.Mock;
    };
  };
}

function crearCifrado() {
  return {
    encrypt: jest.fn((value: string) => `enc(${value})`),
    decrypt: jest.fn((value: string) => value.replace(/^enc\((.*)\)$/, '$1')),
  } as unknown as SolCredentialCipherPort & {
    encrypt: jest.Mock;
    decrypt: jest.Mock;
  };
}

describe('PrismaSireConfigurationRepository', () => {
  describe('save', () => {
    it('encrypts every credential before storing it', async () => {
      const prisma = crearPrisma();
      const cifrado = crearCifrado();
      const repository = new PrismaSireConfigurationRepository(prisma, cifrado);

      await repository.save(COMPANY_ID, {
        clientId: 'client-id',
        clientSecret: 'client-secret',
        solUser: 'FAKEUSER',
        solPassword: 'fake-sol-password',
      });

      expect(cifrado.encrypt).toHaveBeenCalledTimes(4);
      expect(prisma.sireConfiguration.upsert).toHaveBeenCalledWith({
        where: { companyId: COMPANY_ID },
        create: {
          companyId: COMPANY_ID,
          clientId: 'enc(client-id)',
          clientSecret: 'enc(client-secret)',
          solUser: 'enc(FAKEUSER)',
          solPasswordEncrypted: 'enc(fake-sol-password)',
        },
        update: {
          clientId: 'enc(client-id)',
          clientSecret: 'enc(client-secret)',
          solUser: 'enc(FAKEUSER)',
          solPasswordEncrypted: 'enc(fake-sol-password)',
        },
      });
    });

    it('keeps the stored value when the credential was not sent', async () => {
      const prisma = crearPrisma({
        clientId: 'enc(client-id-anterior)',
        clientSecret: 'enc(client-secret-anterior)',
        solUser: 'enc(FAKEUSER-anterior)',
        solPasswordEncrypted: 'enc(fake-sol-password-anterior)',
      });
      const cifrado = crearCifrado();
      const repository = new PrismaSireConfigurationRepository(prisma, cifrado);

      await repository.save(COMPANY_ID, { solUser: 'FAKEUSER' });

      expect(cifrado.encrypt).toHaveBeenCalledTimes(1);
      expect(prisma.sireConfiguration.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          update: {
            clientId: 'enc(client-id-anterior)',
            clientSecret: 'enc(client-secret-anterior)',
            solUser: 'enc(FAKEUSER)',
            solPasswordEncrypted: 'enc(fake-sol-password-anterior)',
          },
        }),
      );
    });

    it('erases the stored value when the credential is sent as null', async () => {
      const prisma = crearPrisma({
        clientId: 'enc(client-id-anterior)',
        clientSecret: 'enc(client-secret-anterior)',
        solUser: 'enc(FAKEUSER-anterior)',
        solPasswordEncrypted: 'enc(fake-sol-password-anterior)',
      });
      const cifrado = crearCifrado();
      const repository = new PrismaSireConfigurationRepository(prisma, cifrado);

      await repository.save(COMPANY_ID, { solPassword: null });

      expect(prisma.sireConfiguration.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          update: {
            clientId: 'enc(client-id-anterior)',
            clientSecret: 'enc(client-secret-anterior)',
            solUser: 'enc(FAKEUSER-anterior)',
            solPasswordEncrypted: null,
          },
        }),
      );
    });

    it('stores nulls when the company has no configuration yet', async () => {
      const prisma = crearPrisma(null);
      const cifrado = crearCifrado();
      const repository = new PrismaSireConfigurationRepository(prisma, cifrado);

      await repository.save(COMPANY_ID, {});

      expect(prisma.sireConfiguration.upsert).toHaveBeenCalledWith({
        where: { companyId: COMPANY_ID },
        create: {
          companyId: COMPANY_ID,
          clientId: null,
          clientSecret: null,
          solUser: null,
          solPasswordEncrypted: null,
        },
        update: {
          clientId: null,
          clientSecret: null,
          solUser: null,
          solPasswordEncrypted: null,
        },
      });
    });

    it('answers 503 instead of 500 when the encryption key is missing', async () => {
      const prisma = crearPrisma(null);
      const cifrado = {
        encrypt: jest.fn(() => {
          throw new SolCredentialCipherUnavailableError();
        }),
        decrypt: jest.fn(),
      } as unknown as SolCredentialCipherPort;
      const repository = new PrismaSireConfigurationRepository(prisma, cifrado);

      await expect(
        repository.save(COMPANY_ID, { clientId: 'client-id' }),
      ).rejects.toMatchObject({
        statusCode: 503,
        clientMessage:
          'El cifrado de credenciales SIRE no está configurado en el servidor. Contacta al administrador.',
      });
      await expect(
        repository.save(COMPANY_ID, { clientId: 'client-id' }),
      ).rejects.toBeInstanceOf(ClientSafeHttpException);
      expect(prisma.sireConfiguration.upsert).not.toHaveBeenCalled();
    });

    it('answers 404 when the company does not exist', async () => {
      const prisma = crearPrisma(null);
      prisma.sireConfiguration.upsert.mockRejectedValueOnce({ code: 'P2003' });
      const repository = new PrismaSireConfigurationRepository(
        prisma,
        crearCifrado(),
      );

      await expect(
        repository.save(COMPANY_ID, { clientId: 'client-id' }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('findByCompanyId', () => {
    it('decrypts the stored credentials', async () => {
      const prisma = crearPrisma({
        clientId: 'enc(client-id)',
        clientSecret: 'enc(client-secret)',
        solUser: 'enc(FAKEUSER)',
        solPasswordEncrypted: 'enc(fake-sol-password)',
      });
      const cifrado = crearCifrado();
      const repository = new PrismaSireConfigurationRepository(prisma, cifrado);

      await expect(repository.findByCompanyId(COMPANY_ID)).resolves.toEqual({
        clientId: 'client-id',
        clientSecret: 'client-secret',
        solUser: 'FAKEUSER',
        solPassword: 'fake-sol-password',
      });
    });

    it('answers null when the company has no configuration', async () => {
      const prisma = crearPrisma(null);
      const repository = new PrismaSireConfigurationRepository(
        prisma,
        crearCifrado(),
      );

      await expect(repository.findByCompanyId(COMPANY_ID)).resolves.toBeNull();
    });

    it('treats a credential that cannot be decrypted as missing', async () => {
      const prisma = crearPrisma({
        clientId: 'enc(client-id)',
        clientSecret: 'ciphertext-corrupto',
        solUser: 'enc(FAKEUSER)',
        solPasswordEncrypted: 'enc(fake-sol-password)',
      });
      const cifrado = crearCifrado();
      (cifrado.decrypt as jest.Mock).mockImplementation((value: string) => {
        if (value === 'ciphertext-corrupto') {
          throw new Error('invalid tag');
        }
        return value.replace(/^enc\((.*)\)$/, '$1');
      });
      const repository = new PrismaSireConfigurationRepository(prisma, cifrado);

      await expect(repository.findByCompanyId(COMPANY_ID)).resolves.toEqual({
        clientId: 'client-id',
        clientSecret: undefined,
        solUser: 'FAKEUSER',
        solPassword: 'fake-sol-password',
      });
    });
  });

  describe('isConfigured', () => {
    it('answers true when the company has the four credentials', async () => {
      const prisma = crearPrisma({
        clientId: 'enc(client-id)',
        clientSecret: 'enc(client-secret)',
        solUser: 'enc(FAKEUSER)',
        solPasswordEncrypted: 'enc(fake-sol-password)',
      });
      const repository = new PrismaSireConfigurationRepository(
        prisma,
        crearCifrado(),
      );

      await expect(repository.isConfigured(COMPANY_ID)).resolves.toBe(true);
    });

    it('answers false when the company has no configuration', async () => {
      const prisma = crearPrisma(null);
      const repository = new PrismaSireConfigurationRepository(
        prisma,
        crearCifrado(),
      );

      await expect(repository.isConfigured(COMPANY_ID)).resolves.toBe(false);
    });

    it('answers false when one of the credentials is missing', async () => {
      const prisma = crearPrisma({
        clientId: 'enc(client-id)',
        clientSecret: 'enc(client-secret)',
        solUser: 'enc(FAKEUSER)',
        solPasswordEncrypted: null,
      });
      const repository = new PrismaSireConfigurationRepository(
        prisma,
        crearCifrado(),
      );

      await expect(repository.isConfigured(COMPANY_ID)).resolves.toBe(false);
    });

    it('answers false when a credential is only blank spaces', async () => {
      const prisma = crearPrisma({
        clientId: 'enc(client-id)',
        clientSecret: 'enc(client-secret)',
        solUser: 'enc(   )',
        solPasswordEncrypted: 'enc(fake-sol-password)',
      });
      const cifrado = crearCifrado();
      const repository = new PrismaSireConfigurationRepository(prisma, cifrado);

      await expect(repository.isConfigured(COMPANY_ID)).resolves.toBe(false);
    });
  });
});
