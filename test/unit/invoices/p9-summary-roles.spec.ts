import { defaultActionPermissionsProvider } from '../../fixtures/defaultActionPermissions';
import { Reflector } from '@nestjs/core';
import { CapabilityGuard } from '../../../src/modules/auth/infrastructure/guards/capabilityGuard';
import { InvoiceQueryController } from '../../../src/modules/invoices/infrastructure/controllers/invoiceQueryController';
it.each(['enviarResumen','enviarBaja'] as const)('RBAC de %s permite ADMIN y operador, rechaza auditor/contador',async method=>{
 const guard=new CapabilityGuard(new Reflector(), defaultActionPermissionsProvider.useFactory());
 for(const role of ['ADMIN','OPERADOR_FACTURACION','AUDITOR','CONTADOR']){
  const ctx={getHandler:()=>InvoiceQueryController.prototype[method],getClass:()=>InvoiceQueryController,switchToHttp:()=>({getRequest:()=>({user:{sub:'test',companyId:'fake',role}})})} as never;
  if(['ADMIN','OPERADOR_FACTURACION'].includes(role))await expect(guard.canActivate(ctx)).resolves.toBe(true);else await expect(guard.canActivate(ctx)).rejects.toMatchObject({status:403});
 }
});
