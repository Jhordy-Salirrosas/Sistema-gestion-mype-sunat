import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { WarehouseAccessService } from '../../../src/modules/auth/application/services/warehouseAccessService';

const user = (over: Record<string, any> = {}) => ({ sub: 'u1', companyId: 'c1', role: 'OPERADOR_FACTURACION', ...over });

function setup() {
  const prisma: any = {
    inventoryWarehouse: {
      findMany: jest.fn(({ where }: any) => Promise.resolve([{ warehouse_code: 'ALM-01', description: 'Principal' }, { warehouse_code: 'ALM-02', description: 'Secundario' }].filter((w) => !where?.warehouse_code?.in || where.warehouse_code.in.includes(w.warehouse_code)))),
    },
    userWarehouse: {
      findMany: jest.fn().mockResolvedValue([{ warehouse: { warehouse_code: 'ALM-01' } }]),
      deleteMany: jest.fn().mockResolvedValue({}),
      createMany: jest.fn().mockResolvedValue({}),
    },
    user: {
      findMany: jest.fn().mockResolvedValue([{ id: 'u1', email: 'u@mype.pe', full_name: 'Usuario', role: 'OPERADOR_FACTURACION', is_active: true, warehouse_access: [{ warehouse: { warehouse_code: 'ALM-01' } }] }]),
      findFirst: jest.fn().mockResolvedValue({ id: 'u1' }),
    },
    $transaction: jest.fn(async (cb: any) => cb(prisma)),
  };
  return { prisma, service: new WarehouseAccessService(prisma) };
}

describe('WarehouseAccessService', () => {
  it('el ADMIN ve todos los almacenes activos', async () => {
    const { service } = setup();
    await expect(service.allowedCodes(user({ role: 'ADMIN' }))).resolves.toEqual(['ALM-01', 'ALM-02']);
  });

  it('un usuario normal solo ve sus almacenes asignados', async () => {
    const { service } = setup();
    await expect(service.allowedCodes(user())).resolves.toEqual(['ALM-01']);
    await expect(service.listAllowed(user())).resolves.toHaveLength(1);
  });

  it('bloquea un almacén no asignado', async () => {
    const { service } = setup();
    await expect(service.assertWarehouse(user(), 'ALM-02')).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.assertWarehouse(user(), 'ALM-01')).resolves.toBeUndefined();
  });

  it('lista usuarios con sus almacenes', async () => {
    const { service } = setup();
    await expect(service.listUsers('c1')).resolves.toEqual([{ id: 'u1', email: 'u@mype.pe', fullName: 'Usuario', role: 'OPERADOR_FACTURACION', isActive: true, warehouseCodes: ['ALM-01'] }]);
  });

  it('rechaza usuario o almacén inexistente y guarda la asignación', async () => {
    const { prisma, service } = setup();
    prisma.user.findFirst.mockResolvedValueOnce(null);
    await expect(service.setUserWarehouses('c1', 'no', ['ALM-01'])).rejects.toBeInstanceOf(NotFoundException);
    prisma.inventoryWarehouse.findMany.mockResolvedValueOnce([]);
    await expect(service.setUserWarehouses('c1', 'u1', ['ALM-99'])).rejects.toBeInstanceOf(NotFoundException);
    prisma.inventoryWarehouse.findMany.mockResolvedValueOnce([{ id: 'w1', warehouse_code: 'ALM-01' }]);
    await expect(service.setUserWarehouses('c1', 'u1', ['ALM-01'])).resolves.toEqual({ userId: 'u1', warehouseCodes: ['ALM-01'] });
    expect(prisma.userWarehouse.deleteMany).toHaveBeenCalledWith({ where: { user_id: 'u1' } });
  });
});
