import type { PrismaService } from '../../../src/database/prismaService';
import { PrismaCompanyConfigurationRepository } from '../../../src/modules/sire/infrastructure/persistence/prismaCompanyConfigurationRepository';

const COMPANY_ID = 'company-id';

function crearPrisma() {
  return {
    company: {
      findUnique: jest.fn(),
    },
    companyConfiguration: {
      findUnique: jest.fn(),
      upsert: jest.fn(),
    },
  } as unknown as PrismaService & {
    company: { findUnique: jest.Mock };
    companyConfiguration: { findUnique: jest.Mock; upsert: jest.Mock };
  };
}

describe('PrismaCompanyConfigurationRepository', () => {
  describe('findByCompanyId', () => {
    it('maps the company and its configuration', async () => {
      const prisma = crearPrisma();
      prisma.company.findUnique.mockResolvedValue({
        ruc: '20123456789',
      });
      prisma.companyConfiguration.findUnique.mockResolvedValue({
        business_name: 'Demo SAC',
        series: ['F001', 'B001'],
      });
      const repository = new PrismaCompanyConfigurationRepository(prisma);

      await expect(repository.findByCompanyId(COMPANY_ID)).resolves.toEqual({
        ruc: '20123456789',
        businessName: 'Demo SAC',
        series: ['F001', 'B001'],
      });
      expect(prisma.company.findUnique).toHaveBeenCalledWith({
        where: { id: COMPANY_ID },
        select: { ruc: true },
      });
      expect(prisma.companyConfiguration.findUnique).toHaveBeenCalledWith({
        where: { company_id: COMPANY_ID },
        select: { business_name: true, series: true },
      });
    });

    it('returns empty defaults when the company has no configuration yet', async () => {
      const prisma = crearPrisma();
      prisma.company.findUnique.mockResolvedValue({
        ruc: '20123456789',
      });
      prisma.companyConfiguration.findUnique.mockResolvedValue(null);
      const repository = new PrismaCompanyConfigurationRepository(prisma);

      await expect(repository.findByCompanyId(COMPANY_ID)).resolves.toEqual({
        ruc: '20123456789',
        businessName: null,
        series: [],
      });
    });

    it('returns null when the company does not exist', async () => {
      const prisma = crearPrisma();
      prisma.company.findUnique.mockResolvedValue(null);
      const repository = new PrismaCompanyConfigurationRepository(prisma);

      await expect(repository.findByCompanyId(COMPANY_ID)).resolves.toBeNull();
      expect(prisma.companyConfiguration.findUnique).not.toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('returns null when the company does not exist', async () => {
      const prisma = crearPrisma();
      prisma.company.findUnique.mockResolvedValue(null);
      const repository = new PrismaCompanyConfigurationRepository(prisma);

      await expect(
        repository.update(COMPANY_ID, { businessName: 'Demo SAC' }),
      ).resolves.toBeNull();
      expect(prisma.companyConfiguration.upsert).not.toHaveBeenCalled();
    });

    it('creates the configuration with defaults when it is missing', async () => {
      const prisma = crearPrisma();
      prisma.company.findUnique.mockResolvedValue({ ruc: '20123456789' });
      prisma.companyConfiguration.upsert.mockResolvedValue({
        business_name: null,
        series: [],
      });
      const repository = new PrismaCompanyConfigurationRepository(prisma);

      await expect(repository.update(COMPANY_ID, {})).resolves.toEqual({
        ruc: '20123456789',
        businessName: null,
        series: [],
      });
      expect(prisma.companyConfiguration.upsert).toHaveBeenCalledWith({
        where: { company_id: COMPANY_ID },
        create: {
          company_id: COMPANY_ID,
          business_name: null,
          series: [],
        },
        update: {},
        select: { business_name: true, series: true },
      });
    });

    it('updates both the name and the series', async () => {
      const prisma = crearPrisma();
      prisma.company.findUnique.mockResolvedValue({ ruc: '20123456789' });
      prisma.companyConfiguration.upsert.mockResolvedValue({
        business_name: 'Demo SAC',
        series: ['F001'],
      });
      const repository = new PrismaCompanyConfigurationRepository(prisma);

      await expect(
        repository.update(COMPANY_ID, {
          businessName: 'Demo SAC',
          series: ['F001'],
        }),
      ).resolves.toEqual({
        ruc: '20123456789',
        businessName: 'Demo SAC',
        series: ['F001'],
      });
      expect(prisma.companyConfiguration.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          update: { business_name: 'Demo SAC', series: ['F001'] },
        }),
      );
    });

    it('updates only the name when the series were not sent', async () => {
      const prisma = crearPrisma();
      prisma.company.findUnique.mockResolvedValue({ ruc: '20123456789' });
      prisma.companyConfiguration.upsert.mockResolvedValue({
        business_name: 'Demo SAC',
        series: ['F001'],
      });
      const repository = new PrismaCompanyConfigurationRepository(prisma);

      await repository.update(COMPANY_ID, { businessName: 'Demo SAC' });

      expect(prisma.companyConfiguration.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          update: { business_name: 'Demo SAC' },
        }),
      );
    });

    it('updates only the series when the name was not sent', async () => {
      const prisma = crearPrisma();
      prisma.company.findUnique.mockResolvedValue({ ruc: '20123456789' });
      prisma.companyConfiguration.upsert.mockResolvedValue({
        business_name: null,
        series: ['F001'],
      });
      const repository = new PrismaCompanyConfigurationRepository(prisma);

      await repository.update(COMPANY_ID, { series: ['F001'] });

      expect(prisma.companyConfiguration.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          update: { series: ['F001'] },
        }),
      );
    });
  });
});
