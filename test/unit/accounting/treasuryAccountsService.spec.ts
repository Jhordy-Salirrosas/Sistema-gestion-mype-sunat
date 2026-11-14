import { BadRequestException, NotFoundException } from '@nestjs/common';
import { TreasuryAccountsService } from '../../../src/modules/accounting/application/services/treasuryAccountsService';

const CATALOGO = [
  { code: '10', name: 'Efectivo', parent_code: null, is_active: true },
  { code: '101', name: 'Caja', parent_code: '10', is_active: true },
  { code: '1011', name: 'Caja principal', parent_code: '101', is_active: true },
  { code: '1041', name: 'Cuentas corrientes operativas', parent_code: '104', is_active: true },
  { code: '1043', name: 'Cuenta corriente 3', parent_code: '104', is_active: true },
];

const cuenta = (over: Record<string, unknown> = {}) => ({
  id: 't1',
  company_id: 'c1',
  code: '1041',
  name: 'BCP cuenta corriente',
  kind: 'BANCO',
  currency: 'PEN',
  is_active: true,
  ...over,
});

const crearPrisma = (over: Record<string, any> = {}) => ({
  accountingAccount: { findMany: jest.fn().mockResolvedValue(CATALOGO) },
  companyTreasuryAccount: {
    findMany: jest.fn().mockResolvedValue([]),
    findFirst: jest.fn().mockResolvedValue(null),
    create: jest.fn().mockImplementation(async ({ data }: any) => cuenta({ ...data, id: 'nueva' })),
    update: jest.fn().mockImplementation(async ({ data }: any) => cuenta({ ...data })),
  },
  ...over,
});

describe('TreasuryAccountsService', () => {
  it('lista las cuentas de la empresa con nombres de API', async () => {
    const prisma = crearPrisma();
    prisma.companyTreasuryAccount.findMany.mockResolvedValue([cuenta()]);
    const r = await new TreasuryAccountsService(prisma as never).list('c1');
    expect(r[0]).toEqual({
      id: 't1',
      code: '1041',
      name: 'BCP cuenta corriente',
      kind: 'BANCO',
      currency: 'PEN',
      isActive: true,
    });
    expect(prisma.companyTreasuryAccount.findMany).toHaveBeenCalledWith({
      where: { company_id: 'c1' },
      orderBy: [{ is_active: 'desc' }, { kind: 'asc' }, { name: 'asc' }],
    });
  });

  it('rechaza una subcuenta que no existe en el catálogo PCGE', async () => {
    const prisma = crearPrisma();
    await expect(
      new TreasuryAccountsService(prisma as never).create('c1', { code: '9999', name: 'Inventada' }),
    ).rejects.toThrow(BadRequestException);
    expect(prisma.companyTreasuryAccount.create).not.toHaveBeenCalled();
  });

  it('rechaza una cuenta de mayor con subcuentas', async () => {
    const prisma = crearPrisma();
    await expect(
      new TreasuryAccountsService(prisma as never).create('c1', { code: '101', name: 'Caja' }),
    ).rejects.toThrow('es de mayor y tiene subcuentas');
  });

  it('rechaza registrar dos veces la misma subcuenta', async () => {
    const prisma = crearPrisma();
    prisma.companyTreasuryAccount.findFirst.mockResolvedValue({ id: 't1', name: 'BCP' });
    await expect(
      new TreasuryAccountsService(prisma as never).create('c1', { code: '1041', name: 'BCP' }),
    ).rejects.toThrow('ya está registrada');
  });

  it('crea la cuenta con los valores por defecto', async () => {
    const prisma = crearPrisma();
    const r = await new TreasuryAccountsService(prisma as never).create('c1', {
      code: '1043',
      name: '  BBVA  ',
    });
    expect(prisma.companyTreasuryAccount.create).toHaveBeenCalledWith({
      data: { company_id: 'c1', code: '1043', name: 'BBVA', kind: 'BANCO', currency: 'PEN' },
    });
    expect(r.code).toBe('1043');
  });

  it('exige nombre en el alta', async () => {
    const prisma = crearPrisma();
    await expect(
      new TreasuryAccountsService(prisma as never).create('c1', { code: '1011', name: '   ' }),
    ).rejects.toThrow('El nombre de la cuenta es obligatorio.');
  });

  it('actualiza solo los campos enviados', async () => {
    const prisma = crearPrisma();
    prisma.companyTreasuryAccount.findFirst.mockResolvedValue(cuenta());
    await new TreasuryAccountsService(prisma as never).update('c1', 't1', { isActive: false });
    expect(prisma.companyTreasuryAccount.update).toHaveBeenCalledWith({
      where: { id: 't1' },
      data: { is_active: false },
    });
  });

  it('no actualiza una cuenta de otra empresa', async () => {
    const prisma = crearPrisma();
    await expect(
      new TreasuryAccountsService(prisma as never).update('c1', 'ajena', { name: 'X' }),
    ).rejects.toThrow(NotFoundException);
  });

  it('no resuelve una cuenta inactiva o de otra empresa', async () => {
    const prisma = crearPrisma();
    await expect(
      new TreasuryAccountsService(prisma as never).resolve('c1', 't1'),
    ).rejects.toThrow('no existe, está inactiva o no pertenece a la empresa');
  });

  describe('cuentaParaAsiento', () => {
    it('devuelve el respaldo cuando no se eligió cuenta', async () => {
      const prisma = crearPrisma();
      const r = await new TreasuryAccountsService(prisma as never).cuentaParaAsiento(
        'c1',
        undefined,
        { code: '1041', name: 'Cuenta corriente' },
      );
      expect(r).toEqual({ code: '1041', name: 'Cuenta corriente' });
      expect(prisma.companyTreasuryAccount.findFirst).not.toHaveBeenCalled();
    });

    it('usa la cuenta elegida por el usuario', async () => {
      const prisma = crearPrisma();
      prisma.companyTreasuryAccount.findFirst.mockResolvedValue(
        cuenta({ code: '1043', name: 'BBVA', is_active: true }),
      );
      const r = await new TreasuryAccountsService(prisma as never).cuentaParaAsiento('c1', 't1', {
        code: '1041',
        name: 'Cuenta corriente',
      });
      expect(r).toEqual({ code: '1043', name: 'BBVA' });
    });
  });
});
