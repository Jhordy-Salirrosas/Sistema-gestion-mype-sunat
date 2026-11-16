import { Reflector } from '@nestjs/core';
import { UnauthorizedException } from '@nestjs/common';
import { ActionPermissionsGuard } from '../../../src/modules/auth/infrastructure/guards/actionPermissionsGuard';
const user={companyId:'empresa',role:'OPERADOR_FACTURACION'};
function setup(requirement:any={actionCode:'INVOICE_EDIT_ISSUE_DATE',differentIssueDateOnly:true}) {
 const permissions={assertAllowed:jest.fn(async()=>undefined)};
 const reflector={getAllAndOverride:()=>requirement};
 const guard=new ActionPermissionsGuard(reflector as Reflector,permissions as never);
 const run=(body:any,actor:any=user)=>guard.canActivate({getHandler:()=>{},getClass:()=>{},switchToHttp:()=>({getRequest:()=>({user:actor,body})})} as never);
 return {permissions,run};
}
afterEach(()=>jest.restoreAllMocks());
it.each([{}, {fecha_emision:undefined}, {fecha_emision:null}, {fecha_emision:'2026-11-15'}, {fecha_emision:'2026-11-15T00:00:00Z'}])('fecha omitida o igual a hoy en Lima no exige permiso: %j',async body=>{
 jest.spyOn(Date,'now').mockReturnValue(Date.parse('2026-11-16T04:59:59Z'));
 const h=setup();await expect(h.run(body)).resolves.toBe(true);expect(h.permissions.assertAllowed).not.toHaveBeenCalled();
});
it.each(['2026-11-14','2026-11-16'])('fecha distinta %s exige la acción, usando el límite de Lima',async fecha=>{
 jest.spyOn(Date,'now').mockReturnValue(Date.parse('2026-11-16T04:59:59Z'));
 const h=setup();await h.run({fecha_emision:fecha});expect(h.permissions.assertAllowed).toHaveBeenCalledWith('empresa','OPERADOR_FACTURACION','INVOICE_EDIT_ISSUE_DATE');
});
it('al llegar medianoche de Lima cambia el día exigido',async()=>{
 jest.spyOn(Date,'now').mockReturnValue(Date.parse('2026-11-16T05:00:00Z'));
 const h=setup();await h.run({fecha_emision:'2026-11-15'});expect(h.permissions.assertAllowed).toHaveBeenCalled();
});
it('no permite saltar la acción en endpoints de operación y rechaza usuario ausente',async()=>{
 const h=setup({actionCode:'INVOICE_FORCE_RESEND',differentIssueDateOnly:false});await h.run({});expect(h.permissions.assertAllowed).toHaveBeenCalled();
 await expect(h.run({},null)).rejects.toBeInstanceOf(UnauthorizedException);
});
it('un endpoint sin requisito de acción conserva su comportamiento',async()=>{const h=setup(null);await expect(h.run({},null)).resolves.toBe(true);});
