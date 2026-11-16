import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { ModulePermissionsService } from '../../../src/modules/auth/application/services/modulePermissionsService';

function setup() {
  const prisma: any = {
    roleModulePermission: {
      findMany: jest.fn().mockResolvedValue([{ role: 'CONTADOR', module_code: 'M1', can_view: false, can_write: false }]),
      upsert: jest.fn().mockResolvedValue({}),
    },
    $transaction: jest.fn(async (cb: any) => cb(prisma)),
  };
  return { prisma, service: new ModulePermissionsService(prisma) };
}

describe('ModulePermissionsService', () => {
  it('lista la matriz completa con defaults', async () => {
    const { service } = setup();
    const rows = await service.list('c1');
    expect(rows).toHaveLength(50);
    expect(rows.find((r) => r.role === 'CONTADOR' && r.moduleCode === 'M1')).toMatchObject({ canView: false, canWrite: false });
    expect(rows.find((r) => r.role === 'ADMIN' && r.moduleCode === 'M1')).toMatchObject({ canView: true, canWrite: true });
  });

  it('obtiene permisos por rol', async () => {
    const { prisma, service } = setup();
    prisma.roleModulePermission.findMany.mockResolvedValueOnce([]);
    const rows = await service.forRole('c1', 'AUDITOR');
    expect(rows.find((r) => r.moduleCode === 'M1')).toMatchObject({ canView: true, canWrite: false });
  });

  it('guarda la matriz y rechaza filas inválidas', async () => {
    const { prisma, service } = setup();
    await expect(service.replace('c1', [{ role: 'CONTADOR', moduleCode: 'M7', canView: true, canWrite: true }])).resolves.toHaveLength(50);
    expect(prisma.roleModulePermission.upsert).toHaveBeenCalled();
    await expect(service.replace('c1', [{ role: 'NO_EXISTE', moduleCode: 'M1', canView: true, canWrite: true }])).rejects.toBeInstanceOf(BadRequestException);
  });

  it('valida escritura y bloquea el módulo sin permiso', async () => {
    const { service } = setup();
    await expect(service.assertWrite('c1', 'CONTADOR', 'M7')).resolves.toBeUndefined();
    await expect(service.assertWrite('c1', 'CONTADOR', 'M1')).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.assertWrite('c1', 'ADMIN', 'M1')).resolves.toBeUndefined();
  });
});

it('can_view es independiente de can_write y respeta una denegación persistida de ADMIN',async()=>{
 const {service,prisma}=setup();
 prisma.roleModulePermission.findMany.mockResolvedValue([{role:'ADMIN',module_code:'M1',can_view:false,can_write:true}]);
 await expect(service.assertView('c1','ADMIN','M1')).rejects.toBeInstanceOf(ForbiddenException);
 await expect(service.assertWrite('c1','ADMIN','M1')).resolves.toBeUndefined();
 prisma.roleModulePermission.findMany.mockResolvedValue([]);
 await expect(service.assertView('c1','AUDITOR','M1')).resolves.toBeUndefined();
 await expect(service.assertView('c1','OPERADOR_FACTURACION','M4')).rejects.toBeInstanceOf(ForbiddenException);
});
