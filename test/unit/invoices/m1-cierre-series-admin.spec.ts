import { defaultActionPermissionsProvider } from '../../fixtures/defaultActionPermissions';
import 'reflect-metadata';
import { Reflector } from '@nestjs/core';
import { CapabilityGuard } from '../../../src/modules/auth/infrastructure/guards/capabilityGuard';
import { InvoiceConfigController } from '../../../src/modules/invoices/infrastructure/controllers/invoiceConfigController';
it.each(['ADMIN','OPERADOR_FACTURACION','CONTADOR'])('6F POST series exige ADMIN incluso para %s autenticado', async role => {
 const guard = new CapabilityGuard(new Reflector(), defaultActionPermissionsProvider.useFactory());
 const context = { getHandler: () => InvoiceConfigController.prototype.crearSerie, getClass: () => InvoiceConfigController, switchToHttp: () => ({ getRequest: () => ({ user: { sub:'test',companyId:'fake',role } }) }) } as never;
 if (role === 'ADMIN') await expect(guard.canActivate(context)).resolves.toBe(true); else await expect(guard.canActivate(context)).rejects.toMatchObject({status:403});
});
