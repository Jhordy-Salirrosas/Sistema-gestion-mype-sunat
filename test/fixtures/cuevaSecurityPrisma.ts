import { AuthModule } from '../../src/modules/auth/authModule';
import { ConfigModule } from '@nestjs/config';
export const cuevaAuthTestImports = [ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true }), AuthModule];
/** Identidad/catalogo sintéticos para pruebas HTTP de Cueva. Se importa
 * AuthModule real para resolver sus dependencias tanto en 646fa51a como en
 * roles administrables. No sustituye AuthGuard, RolesGuard ni los servicios
 * de pertenencia/permisos. Con db real, las operaciones de negocio siguen
 * usando PostgreSQL; únicamente identidad y permisos son fixtures de prueba.
 */
export function cuevaSecurityPrisma(actor: () => { sub: string; companyId: string; role: string }, db: object = {}) {
  const codes = ['ADMIN','CONTADOR','OPERADOR_FACTURACION','OPERADOR_ADUANAS','AUDITOR'];
  return new Proxy(db, { get(target, key) {
    if (key === 'onModuleInit' || key === 'onModuleDestroy') return undefined;
    if (key === 'user') return { findFirst: async ({where}: any) => {
      const a = actor();
      return where.id === a.sub && where.company_id === a.companyId ? { id:a.sub,company_id:a.companyId,email:'actor@example.invalid',role:a.role,is_active:true,company:{is_active:true} } : null;
    } };
    if (key === 'companyRole') return {
      findUnique: async ({where:{company_id_code:k}}: any) => k.company_id === actor().companyId && codes.includes(k.code) ? {company_id:k.company_id,code:k.code,name:k.code,is_system:true} : null,
      findMany: async ({where}: any) => codes.map(code => ({company_id:where.company_id,code,name:code,is_system:true})),
    };
    if (key === 'roleModulePermission' || key === 'roleActionPermission') return {findMany:async()=>[]};
    const value = Reflect.get(target,key);
    return typeof value === 'function' ? value.bind(target) : value;
  } });
}
