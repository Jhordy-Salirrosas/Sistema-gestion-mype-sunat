import { ExecutionContext } from '@nestjs/common';
import { CurrentCompany, CurrentUser } from '../../../src/common/decorators';

describe('Common Decorators', () => {
  function getParamDecoratorFactory(decorator: any) {
    // In NestJS, createParamDecorator returns a function with ROUTE_ARGS_METADATA
    // We can evaluate the parameter decorator handler directly
    class TestClass {
      testMethod(@decorator() _param: any) {}
    }
    const metadata = Reflect.getMetadata('__routeArguments__', TestClass, 'testMethod');
    const key = Object.keys(metadata)[0];
    return metadata[key].factory;
  }

  function createMockExecutionContext(req: any): ExecutionContext {
    return {
      switchToHttp: () => ({
        getRequest: () => req,
        getResponse: () => ({}),
        getNext: () => ({}),
      }),
    } as unknown as ExecutionContext;
  }

  describe('@CurrentCompany()', () => {
    const factory = getParamDecoratorFactory(CurrentCompany);

    it('debería extraer companyId de request.user si existe', () => {
      const mockReq = {
        user: { companyId: 'comp-uuid-123', email: 'test@mype.pe' },
      };
      const ctx = createMockExecutionContext(mockReq);
      const result = factory(null, ctx);
      expect(result).toBe('comp-uuid-123');
    });

    it('debería extraer companyId de request si request.user no existe', () => {
      const mockReq = { companyId: 'comp-direct-456' };
      const ctx = createMockExecutionContext(mockReq);
      const result = factory(null, ctx);
      expect(result).toBe('comp-direct-456');
    });

    it('debería retornar undefined si no hay información de empresa', () => {
      const mockReq = {};
      const ctx = createMockExecutionContext(mockReq);
      const result = factory(null, ctx);
      expect(result).toBeUndefined();
    });
  });

  describe('@CurrentUser()', () => {
    const factory = getParamDecoratorFactory(CurrentUser);

    it('debería extraer request.user del contexto', () => {
      const userPayload = {
        sub: 'user-1',
        email: 'user@mype.pe',
        companyId: 'comp-1',
        role: 'ADMIN',
      };
      const mockReq = { user: userPayload };
      const ctx = createMockExecutionContext(mockReq);
      const result = factory(null, ctx);
      expect(result).toEqual(userPayload);
    });
  });
});
