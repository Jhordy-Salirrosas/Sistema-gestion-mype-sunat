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
        { tipo_operacion: 'IGV', cuenta_contable: '401' },
        { tipo_operacion: 'VENTAS', cuenta_contable: '701' },
      ]);
      const repository = new PrismaSireAccountingMappingRepository(prisma);

      await expect(repository.findAll(COMPANY_ID)).resolves.toEqual([
        { tipoOperacion: 'IGV', cuentaContable: '401' },
        { tipoOperacion: 'VENTAS', cuentaContable: '701' },
      ]);
      expect(prisma.sireAccountingMapping.findMany).toHaveBeenCalledWith({
        where: { company_id: COMPANY_ID },
        orderBy: { tipo_operacion: 'asc' },
        select: { tipo_operacion: true, cuenta_contable: true },
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
          tipo_operacion: 'IGV',
          cuenta_contable: '401',
        })
        .mockResolvedValueOnce({
          tipo_operacion: 'VENTAS',
          cuenta_contable: '701',
        });
      prisma.$transaction.mockResolvedValue([
        { tipo_operacion: 'IGV', cuenta_contable: '401' },
        { tipo_operacion: 'VENTAS', cuenta_contable: '701' },
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
          company_id_tipo_operacion: {
            company_id: COMPANY_ID,
            tipo_operacion: 'IGV',
          },
        },
        create: {
          company_id: COMPANY_ID,
          tipo_operacion: 'IGV',
          cuenta_contable: '401',
        },
        update: { cuenta_contable: '401' },
        select: { tipo_operacion: true, cuenta_contable: true },
      });
      expect(prisma.sireAccountingMapping.upsert).toHaveBeenNthCalledWith(2, {
        where: {
          company_id_tipo_operacion: {
            company_id: COMPANY_ID,
            tipo_operacion: 'VENTAS',
          },
        },
        create: {
          company_id: COMPANY_ID,
          tipo_operacion: 'VENTAS',
          cuenta_contable: '701',
        },
        update: { cuenta_contable: '701' },
        select: { tipo_operacion: true, cuenta_contable: true },
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
