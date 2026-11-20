import type { PrismaService } from '../../../src/database/prismaService';
import { PrismaSireAccountingMappingRepository } from '../../../src/modules/sire/infrastructure/persistence/prismaSireAccountingMappingRepository';

const COMPANY_ID = 'company-id';

function crearPrisma() {
  return {
    company: {
      findUnique: jest.fn(),
    },
    sireAccountingMapping: {
      findMany: jest.fn(),
      upsert: jest.fn(),
    },
    $transaction: jest.fn(),
  } as unknown as PrismaService & {
    company: { findUnique: jest.Mock };
    sireAccountingMapping: { findMany: jest.Mock; upsert: jest.Mock };
    $transaction: jest.Mock;
  };
}

describe('PrismaSireAccountingMappingRepository', () => {
  describe('findAll', () => {
    it('returns null when the company does not exist', async () => {
      const prisma = crearPrisma();
      prisma.company.findUnique.mockResolvedValue(null);
      const repository = new PrismaSireAccountingMappingRepository(prisma);

      await expect(repository.findAll(COMPANY_ID)).resolves.toBeNull();
      expect(prisma.sireAccountingMapping.findMany).not.toHaveBeenCalled();
    });

    it('maps the stored rows', async () => {
      const prisma = crearPrisma();
      prisma.company.findUnique.mockResolvedValue({ id: COMPANY_ID });
      prisma.sireAccountingMapping.findMany.mockResolvedValue([
        { tipoOperacion: 'IGV', cuentaContable: '401' },
        { tipoOperacion: 'VENTAS', cuentaContable: '701' },
      ]);
      const repository = new PrismaSireAccountingMappingRepository(prisma);

      await expect(repository.findAll(COMPANY_ID)).resolves.toEqual([
        { tipoOperacion: 'IGV', cuentaContable: '401' },
        { tipoOperacion: 'VENTAS', cuentaContable: '701' },
      ]);
      expect(prisma.sireAccountingMapping.findMany).toHaveBeenCalledWith({
        where: { companyId: COMPANY_ID },
        orderBy: { tipoOperacion: 'asc' },
        select: { tipoOperacion: true, cuentaContable: true },
      });
    });
  });

  describe('upsertMany', () => {
    it('returns null when the company does not exist', async () => {
      const prisma = crearPrisma();
      prisma.company.findUnique.mockResolvedValue(null);
      const repository = new PrismaSireAccountingMappingRepository(prisma);

      await expect(
        repository.upsertMany(COMPANY_ID, [
          { tipoOperacion: 'VENTAS', cuentaContable: '701' },
        ]),
      ).resolves.toBeNull();
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('upserts every mapping in a transaction', async () => {
      const prisma = crearPrisma();
      prisma.company.findUnique.mockResolvedValue({ id: COMPANY_ID });
      prisma.sireAccountingMapping.upsert
        .mockResolvedValueOnce({
          tipoOperacion: 'IGV',
          cuentaContable: '401',
        })
        .mockResolvedValueOnce({
          tipoOperacion: 'VENTAS',
          cuentaContable: '701',
        });
      prisma.$transaction.mockResolvedValue([
        { tipoOperacion: 'IGV', cuentaContable: '401' },
        { tipoOperacion: 'VENTAS', cuentaContable: '701' },
      ]);
      const repository = new PrismaSireAccountingMappingRepository(prisma);

      await expect(
        repository.upsertMany(COMPANY_ID, [
          { tipoOperacion: 'IGV', cuentaContable: '401' },
          { tipoOperacion: 'VENTAS', cuentaContable: '701' },
        ]),
      ).resolves.toEqual([
        { tipoOperacion: 'IGV', cuentaContable: '401' },
        { tipoOperacion: 'VENTAS', cuentaContable: '701' },
      ]);
      expect(prisma.sireAccountingMapping.upsert).toHaveBeenNthCalledWith(1, {
        where: {
          companyId_tipoOperacion: {
            companyId: COMPANY_ID,
            tipoOperacion: 'IGV',
          },
        },
        create: {
          companyId: COMPANY_ID,
          tipoOperacion: 'IGV',
          cuentaContable: '401',
        },
        update: { cuentaContable: '401' },
        select: { tipoOperacion: true, cuentaContable: true },
      });
      expect(prisma.sireAccountingMapping.upsert).toHaveBeenNthCalledWith(2, {
        where: {
          companyId_tipoOperacion: {
            companyId: COMPANY_ID,
            tipoOperacion: 'VENTAS',
          },
        },
        create: {
          companyId: COMPANY_ID,
          tipoOperacion: 'VENTAS',
          cuentaContable: '701',
        },
        update: { cuentaContable: '701' },
        select: { tipoOperacion: true, cuentaContable: true },
      });
      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    });

    it('runs an empty transaction when there is nothing to save', async () => {
      const prisma = crearPrisma();
      prisma.company.findUnique.mockResolvedValue({ id: COMPANY_ID });
      prisma.$transaction.mockResolvedValue([]);
      const repository = new PrismaSireAccountingMappingRepository(prisma);

      await expect(repository.upsertMany(COMPANY_ID, [])).resolves.toEqual([]);
      expect(prisma.$transaction).toHaveBeenCalledWith([]);
    });
  });
});
