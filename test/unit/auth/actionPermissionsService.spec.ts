import { withSecurityCatalog } from '../../fixtures/securityCatalogPrisma';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { ActionPermissionsService, ACTIONS } from '../../../src/modules/auth/application/services/actionPermissionsService';
import { ROLES } from '../../../src/modules/auth/application/services/modulePermissionsService';
function setup() {
  const prisma: any = { roleActionPermission: { findMany: jest.fn(async () => []), upsert: jest.fn() } };
  prisma.$transaction = jest.fn(async cb => cb(prisma));
  return { prisma, service: new ActionPermissionsService(withSecurityCatalog(prisma)) };
}
it.each(ROLES)('defaults efectivos para %s preservan los roles existentes', async role => {
  const { service, prisma } = setup();
  const rows = await service.forRole('empresa', role);
  expect(rows).toHaveLength(ACTIONS.length);
  for (const action of ACTIONS.filter(a=>['INVOICE_EDIT_ISSUE_DATE','INVOICE_FORCE_RESEND','INVOICE_RESOLVE_DLQ','INVOICE_REPROCESS_BRIDGE'].includes(a.code))) expect(rows.find(r => r.actionCode === action.code)?.allowed).toBe(
    role === 'ADMIN' || role === 'OPERADOR_FACTURACION' && action.code === 'INVOICE_RESOLVE_DLQ');
  expect(prisma.roleActionPermission.findMany).toHaveBeenCalledWith({ where: { company_id: 'empresa' } });
});
it('lista el catálogo por rol y aplica overrides false incluso a ADMIN', async () => {
  const { service, prisma } = setup();
  prisma.roleActionPermission.findMany.mockResolvedValue([{ role: 'ADMIN', action_code: 'INVOICE_FORCE_RESEND', allowed: false }]);
  const rows = await service.list('empresa'); expect(rows).toHaveLength(ACTIONS.length*5);
  expect(rows.find(r => r.role === 'ADMIN' && r.actionCode === 'INVOICE_FORCE_RESEND')?.allowed).toBe(false);
  await expect(service.assertAllowed('empresa','ADMIN','INVOICE_FORCE_RESEND')).rejects.toBeInstanceOf(ForbiddenException);
});
it('persiste solo para la empresa del token y admite habilitar/deshabilitar sin reescribir defaults', async () => {
  const { service, prisma } = setup();
  await service.replace('empresa', [{ role: 'OPERADOR_FACTURACION', actionCode: 'INVOICE_EDIT_ISSUE_DATE', allowed: true, company_id: 'ajena' }]);
  expect(prisma.roleActionPermission.upsert).toHaveBeenCalledWith(expect.objectContaining({
    where: { company_id_role_action_code: { company_id: 'empresa', role: 'OPERADOR_FACTURACION', action_code: 'INVOICE_EDIT_ISSUE_DATE' } },
    create: { company_id: 'empresa', role: 'OPERADOR_FACTURACION', action_code: 'INVOICE_EDIT_ISSUE_DATE', allowed: true },
    update: { allowed: true },
  }));
});
it.each([null, {}, [null], [{role:'INVALIDO',actionCode:'INVOICE_FORCE_RESEND',allowed:true}],
  [{role:'ADMIN',actionCode:'OTRA',allowed:true}], [{role:'ADMIN',actionCode:'INVOICE_FORCE_RESEND',allowed:'false'}],
  [{role:'ADMIN',actionCode:'INVOICE_FORCE_RESEND',allowed:false},{role:'ADMIN',actionCode:'INVOICE_FORCE_RESEND',allowed:true}],
])('rechaza una matriz inválida antes de escribir: %j', async input => {
  const { service, prisma } = setup(); await expect(service.replace('empresa',input)).rejects.toBeInstanceOf(BadRequestException);
  expect(prisma.$transaction).not.toHaveBeenCalled();
});
it('rechaza rol desconocido y acciones denegadas con 403 identificable', async () => {
  const { service } = setup();
  await expect(service.forRole('empresa','OTRO')).rejects.toBeInstanceOf(ForbiddenException);
  await expect(service.assertAllowed('empresa','OPERADOR_FACTURACION','INVOICE_EDIT_ISSUE_DATE')).rejects.toMatchObject({
    status: 403, response: expect.objectContaining({code:'ACTION_PERMISSION_DENIED',action:'INVOICE_EDIT_ISSUE_DATE'}),
  });
});
