import { Reflector } from '@nestjs/core';
import { RolesGuard } from '../../../src/modules/auth/infrastructure/guards/rolesGuard';
import { InvoiceQueryController } from '../../../src/modules/invoices/infrastructure/controllers/invoiceQueryController';
it.each(['enviarResumen','enviarBaja'] as const)('RBAC de %s permite ADMIN y operador, rechaza auditor/contador',method=>{
 const guard=new RolesGuard(new Reflector());
 for(const role of ['ADMIN','OPERADOR_FACTURACION','AUDITOR','CONTADOR']){
  const ctx={getHandler:()=>InvoiceQueryController.prototype[method],getClass:()=>InvoiceQueryController,switchToHttp:()=>({getRequest:()=>({user:{role}})})} as never;
  if(['ADMIN','OPERADOR_FACTURACION'].includes(role))expect(guard.canActivate(ctx)).toBe(true);else expect(()=>guard.canActivate(ctx)).toThrow('Acceso denegado');
 }
});
