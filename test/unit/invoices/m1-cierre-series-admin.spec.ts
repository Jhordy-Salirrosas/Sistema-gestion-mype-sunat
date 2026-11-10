import 'reflect-metadata';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from '../../../src/modules/auth/infrastructure/guards/rolesGuard';
import { InvoiceConfigController } from '../../../src/modules/invoices/infrastructure/controllers/invoiceConfigController';
it.each(['ADMIN','OPERADOR_FACTURACION','CONTADOR'])('6F POST series exige ADMIN incluso para %s autenticado', role => {
 const guard = new RolesGuard(new Reflector());
 const context = { getHandler: () => InvoiceConfigController.prototype.crearSerie, getClass: () => InvoiceConfigController, switchToHttp: () => ({ getRequest: () => ({ user: { role } }) }) } as never;
 if (role === 'ADMIN') expect(guard.canActivate(context)).toBe(true); else expect(() => guard.canActivate(context)).toThrow('Acceso denegado');
});
