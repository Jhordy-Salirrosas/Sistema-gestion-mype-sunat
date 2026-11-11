import 'reflect-metadata';
import { Reflector } from '@nestjs/core';
import { InvoiceQueryController } from '../../../src/modules/invoices/infrastructure/controllers/invoiceQueryController';
import { RolesGuard } from '../../../src/modules/auth/infrastructure/guards/rolesGuard';
import { ROLES_KEY } from '../../../src/modules/auth/infrastructure/decorators/rolesDecorator';
it.each(['resumenes/diario/enviar', 'resumenes/baja/enviar', ':id/retry-cdr'])('7G solo ADMIN en %s', route => {
 const proto = InvoiceQueryController.prototype;
 const handler = Object.getOwnPropertyNames(proto).map(k => (proto as any)[k]).find(h => Reflect.getMetadata('path', h) === route);
 expect(handler).toBeDefined(); expect(Reflect.getMetadata(ROLES_KEY, handler)).toEqual(['ADMIN']);
 expect(Reflect.getMetadata('__guards__', handler)).toContain(RolesGuard);
 const guard = new RolesGuard(new Reflector());
 const context = (role?: string) => ({ getHandler: () => handler, getClass: () => InvoiceQueryController, switchToHttp: () => ({ getRequest: () => ({ user: role ? { role } : undefined }) }) });
 expect(guard.canActivate(context('ADMIN') as never)).toBe(true);
 for (const role of ['USER', 'CONTADOR', undefined]) expect(() => guard.canActivate(context(role) as never)).toThrow();
});
