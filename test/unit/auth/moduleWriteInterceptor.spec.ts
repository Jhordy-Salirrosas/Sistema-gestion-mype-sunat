import { ModuleWriteInterceptor } from '../../../src/modules/auth/infrastructure/interceptors/moduleWriteInterceptor';

function context(over: Record<string, any> = {}) {
  const request = { user: { role: 'CONTADOR', companyId: 'c1' }, method: 'POST', originalUrl: '/api/v1/purchases', ...over };
  return { switchToHttp: () => ({ getRequest: () => request }) } as any;
}
const next = { handle: () => ({ subscribe: () => undefined }) } as any;

describe('ModuleWriteInterceptor', () => {
  it('valida escritura del módulo correspondiente', async () => {
    const permisos = { assertWrite: jest.fn().mockResolvedValue(undefined) } as any;
    await new ModuleWriteInterceptor(permisos).intercept(context(), next);
    expect(permisos.assertWrite).toHaveBeenCalledWith('c1', 'CONTADOR', 'M8');
  });

  it('conserva excepción de escritura ADMIN y rutas compartidas', async () => {
    const permisos = { assertWrite: jest.fn() } as any;
    const interceptor = new ModuleWriteInterceptor(permisos);
    await interceptor.intercept(context({ user: { role: 'ADMIN', companyId: 'c1' } }), next);
    await interceptor.intercept(context({ originalUrl: '/api/v1/auth/login' }), next);
    expect(permisos.assertWrite).not.toHaveBeenCalled();
  });
});

it('GET y HEAD comprueban view, sin sustituirlo por write',async()=>{
 const permissions={assertWrite:jest.fn(),assertView:jest.fn(async()=>undefined)};
 for(const method of ['GET','HEAD'])await new ModuleWriteInterceptor(permissions as never).intercept(context({method}),next);
 expect(permissions.assertView).toHaveBeenCalledTimes(2);expect(permissions.assertView).toHaveBeenCalledWith('c1','CONTADOR','M8');expect(permissions.assertWrite).not.toHaveBeenCalled();
});
it.each(['/api/v1/auth/action-permissions/me','/api/v1/master-data/partners','/api/v1/health','/api/v1/resilience/jobs','/api/v1/invoices-extra'])('no amplía el mapa a %s',async originalUrl=>{
 const permissions={assertWrite:jest.fn(),assertView:jest.fn()};
 await new ModuleWriteInterceptor(permissions as never).intercept(context({method:'GET',originalUrl}),next);
 expect(permissions.assertView).not.toHaveBeenCalled();
});
it('el prefijo más específico distingue compras de inventario y omite query string',async()=>{
 const permissions={assertWrite:jest.fn(),assertView:jest.fn(async()=>undefined)};
 await new ModuleWriteInterceptor(permissions as never).intercept(context({method:'GET',originalUrl:'/api/v1/inventory/purchases?limit=10'}),next);
 expect(permissions.assertView).toHaveBeenCalledWith('c1','CONTADOR','M8');
});
