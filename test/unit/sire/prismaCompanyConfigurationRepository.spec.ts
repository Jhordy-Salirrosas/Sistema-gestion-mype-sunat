import type { PrismaService } from '../../../src/database/prismaService';
import { PrismaCompanyConfigurationRepository } from '../../../src/modules/sire/infrastructure/persistence/prismaCompanyConfigurationRepository';

const COMPANY_ID = 'company-id';

const COMPANY_ROW = {
  ruc: '20123456789',
  legal_name: 'DEMO SOCIEDAD ANONIMA CERRADA',
  trade_name: 'DEMO SAC',
  domicilio_fiscal: 'AV. LEGAL 123',
  ubigeo_fiscal: '150101',
};

const CONFIGURATION_ROW = {
  business_name: 'Demo SAC',
  direccion: 'AV. SIEMPRE VIVA 123',
  estado: 'ACTIVO',
  condicion: 'HABIDO',
  ubigeo: '150102',
  es_agente_retencion: false,
  series: ['F001', 'B001'],
};

const COMPANY_SELECT = {
  ruc: true,
  legal_name: true,
  trade_name: true,
  domicilio_fiscal: true,
  ubigeo_fiscal: true,
};

const CONFIGURATION_SELECT = {
  business_name: true,
  direccion: true,
  estado: true,
  condicion: true,
  ubigeo: true,
  es_agente_retencion: true,
  series: true,
};

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
      prisma.company.findUnique.mockResolvedValue(COMPANY_ROW);
      prisma.companyConfiguration.findUnique.mockResolvedValue(
        CONFIGURATION_ROW,
      );
      const repository = new PrismaCompanyConfigurationRepository(prisma);

      await expect(repository.findByCompanyId(COMPANY_ID)).resolves.toEqual({
        ruc: '20123456789',
        businessName: 'Demo SAC',
        direccion: 'AV. SIEMPRE VIVA 123',
        estado: 'ACTIVO',
        condicion: 'HABIDO',
        ubigeo: '150102',
        esAgenteRetencion: false,
        series: ['F001', 'B001'],
      });
      expect(prisma.company.findUnique).toHaveBeenCalledWith({
        where: { id: COMPANY_ID },
        select: COMPANY_SELECT,
      });
      expect(prisma.companyConfiguration.findUnique).toHaveBeenCalledWith({
        where: { company_id: COMPANY_ID },
        select: CONFIGURATION_SELECT,
      });
    });

    it('falls back to the company fiscal data when there is no configuration', async () => {
      const prisma = crearPrisma();
      prisma.company.findUnique.mockResolvedValue(COMPANY_ROW);
      prisma.companyConfiguration.findUnique.mockResolvedValue(null);
      const repository = new PrismaCompanyConfigurationRepository(prisma);

      await expect(repository.findByCompanyId(COMPANY_ID)).resolves.toEqual({
        ruc: '20123456789',
        businessName: 'DEMO SAC',
        direccion: 'AV. LEGAL 123',
        estado: null,
        condicion: null,
        ubigeo: '150101',
        esAgenteRetencion: null,
        series: [],
      });
    });

    it('uses the legal name when the trade name is missing', async () => {
      const prisma = crearPrisma();
      prisma.company.findUnique.mockResolvedValue({
        ...COMPANY_ROW,
        trade_name: null,
      });
      prisma.companyConfiguration.findUnique.mockResolvedValue(null);
      const repository = new PrismaCompanyConfigurationRepository(prisma);

      await expect(
        repository.findByCompanyId(COMPANY_ID),
      ).resolves.toMatchObject({
        businessName: 'DEMO SOCIEDAD ANONIMA CERRADA',
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
      prisma.company.findUnique.mockResolvedValue(COMPANY_ROW);
      prisma.companyConfiguration.upsert.mockResolvedValue({
        business_name: null,
        direccion: null,
        estado: null,
        condicion: null,
        ubigeo: null,
        es_agente_retencion: null,
        series: [],
      });
      const repository = new PrismaCompanyConfigurationRepository(prisma);

      await expect(repository.update(COMPANY_ID, {})).resolves.toEqual({
        ruc: '20123456789',
        businessName: 'DEMO SAC',
        direccion: 'AV. LEGAL 123',
        estado: null,
        condicion: null,
        ubigeo: '150101',
        esAgenteRetencion: null,
        series: [],
      });
      expect(prisma.companyConfiguration.upsert).toHaveBeenCalledWith({
        where: { company_id: COMPANY_ID },
        create: {
          company_id: COMPANY_ID,
          business_name: null,
          direccion: null,
          estado: null,
          condicion: null,
          ubigeo: null,
          es_agente_retencion: null,
          series: [],
        },
        update: {},
        select: CONFIGURATION_SELECT,
      });
    });

    it('updates all the company data', async () => {
      const prisma = crearPrisma();
      prisma.company.findUnique.mockResolvedValue(COMPANY_ROW);
      prisma.companyConfiguration.upsert.mockResolvedValue(
        CONFIGURATION_ROW,
      );
      const repository = new PrismaCompanyConfigurationRepository(prisma);

      await expect(
        repository.update(COMPANY_ID, {
          businessName: 'Demo SAC',
          direccion: 'AV. SIEMPRE VIVA 123',
          estado: 'ACTIVO',
          condicion: 'HABIDO',
          ubigeo: '150102',
          esAgenteRetencion: false,
          series: ['F001', 'B001'],
        }),
      ).resolves.toEqual({
        ruc: '20123456789',
        businessName: 'Demo SAC',
        direccion: 'AV. SIEMPRE VIVA 123',
        estado: 'ACTIVO',
        condicion: 'HABIDO',
        ubigeo: '150102',
        esAgenteRetencion: false,
        series: ['F001', 'B001'],
      });
      expect(prisma.companyConfiguration.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          update: {
            business_name: 'Demo SAC',
            direccion: 'AV. SIEMPRE VIVA 123',
            estado: 'ACTIVO',
            condicion: 'HABIDO',
            ubigeo: '150102',
            es_agente_retencion: false,
            series: ['F001', 'B001'],
          },
        }),
      );
    });

    it('updates only the name when the other fields were not sent', async () => {
      const prisma = crearPrisma();
      prisma.company.findUnique.mockResolvedValue(COMPANY_ROW);
      prisma.companyConfiguration.upsert.mockResolvedValue(
        CONFIGURATION_ROW,
      );
      const repository = new PrismaCompanyConfigurationRepository(prisma);

      await repository.update(COMPANY_ID, { businessName: 'Demo SAC' });

      expect(prisma.companyConfiguration.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          update: { business_name: 'Demo SAC' },
        }),
      );
    });

    it('updates only the series when the other fields were not sent', async () => {
      const prisma = crearPrisma();
      prisma.company.findUnique.mockResolvedValue(COMPANY_ROW);
      prisma.companyConfiguration.upsert.mockResolvedValue(
        CONFIGURATION_ROW,
      );
      const repository = new PrismaCompanyConfigurationRepository(prisma);

      await repository.update(COMPANY_ID, { series: ['F001'] });

      expect(prisma.companyConfiguration.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          update: { series: ['F001'] },
        }),
      );
    });

    it('updates only the SUNAT fiscal fields when they are the only ones sent', async () => {
      const prisma = crearPrisma();
      prisma.company.findUnique.mockResolvedValue(COMPANY_ROW);
      prisma.companyConfiguration.upsert.mockResolvedValue(
        CONFIGURATION_ROW,
      );
      const repository = new PrismaCompanyConfigurationRepository(prisma);

      await repository.update(COMPANY_ID, {
        direccion: 'AV. SIEMPRE VIVA 123',
        estado: 'ACTIVO',
        condicion: 'HABIDO',
        ubigeo: '150102',
        esAgenteRetencion: false,
      });

      expect(prisma.companyConfiguration.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          update: {
            direccion: 'AV. SIEMPRE VIVA 123',
            estado: 'ACTIVO',
            condicion: 'HABIDO',
            ubigeo: '150102',
            es_agente_retencion: false,
          },
        }),
      );
    });
  });
});
