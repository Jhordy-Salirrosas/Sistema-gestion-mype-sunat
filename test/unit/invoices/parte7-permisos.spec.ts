import 'reflect-metadata';
import { Reflector } from '@nestjs/core';
import { InvoiceQueryController } from '../../../src/modules/invoices/infrastructure/controllers/invoiceQueryController';
import { CapabilityGuard } from '../../../src/modules/auth/infrastructure/guards/capabilityGuard';
import { CAPABILITY_KEY } from '../../../src/modules/auth/infrastructure/decorators/capabilityDecorator';
import { defaultActionPermissionsProvider } from '../../fixtures/defaultActionPermissions';
it.each(['resumenes/diario/enviar', 'resumenes/baja/enviar', ':id/retry-cdr'])('7G aplica roles de operación en %s', async route => {
 const proto = InvoiceQueryController.prototype;
 const handler = Object.getOwnPropertyNames(proto).map(k => (proto as any)[k]).find(h => Reflect.getMetadata('path', h) === route);
 expect(handler).toBeDefined(); expect(Reflect.getMetadata(CAPABILITY_KEY, handler)).toBe(route === ':id/retry-cdr' ? 'INVOICE_RETRY_CDR' : 'INVOICE_SUMMARY_SEND');
 expect(Reflect.getMetadata('__guards__', handler)).toContain(CapabilityGuard);
 const guard = new CapabilityGuard(new Reflector(),defaultActionPermissionsProvider.useFactory());
 const context = (role?: string) => ({ getHandler: () => handler, getClass: () => InvoiceQueryController, switchToHttp: () => ({ getRequest: () => ({ user: role ? { sub: 'test',companyId:'fake',role } : undefined }) }) });
 await expect(guard.canActivate(context('ADMIN') as never)).resolves.toBe(true);
 for (const role of ['USER', 'CONTADOR', undefined]) await expect(guard.canActivate(context(role) as never)).rejects.toThrow();
});
