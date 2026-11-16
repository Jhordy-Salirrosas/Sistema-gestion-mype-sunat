import { createHash } from 'node:crypto';
import type { Prisma } from '../../../../generated/client/client';

export async function auditSecurityChange(tx: Pick<Prisma.TransactionClient, 'auditLog'>, companyId: string, actorId: string | null, action: string, code: string, before: unknown, after: unknown) {
  const values = { actorId, companyId, code, before, after };
  await tx.auditLog.create({ data: {
    company_id: companyId, user_id: actorId, module: 'M0_AUTH', action,
    entity_name: 'RolePermissions', entity_id: code, ip_address: 'servidor',
    previous_values: JSON.parse(JSON.stringify(before ?? {})) as Prisma.InputJsonValue,
    new_values: JSON.parse(JSON.stringify(after ?? {})) as Prisma.InputJsonValue,
    digest_hash: createHash('sha256').update(JSON.stringify(values)).digest('hex'),
  } });
}
