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

  it('no valida ADMIN, lecturas ni auth', async () => {
    const permisos = { assertWrite: jest.fn() } as any;
    const interceptor = new ModuleWriteInterceptor(permisos);
    await interceptor.intercept(context({ user: { role: 'ADMIN', companyId: 'c1' } }), next);
    await interceptor.intercept(context({ method: 'GET' }), next);
    await interceptor.intercept(context({ originalUrl: '/api/v1/auth/login' }), next);
    expect(permisos.assertWrite).not.toHaveBeenCalled();
  });
});
