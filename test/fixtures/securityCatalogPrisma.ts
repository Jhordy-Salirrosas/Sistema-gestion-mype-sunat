/** Catálogo de empresa para tests de otros flujos, sin sustituir los servicios de permisos. */
const codes=['ADMIN','CONTADOR','OPERADOR_FACTURACION','OPERADOR_ADUANAS','AUDITOR'];
export function withSecurityCatalog<T extends Record<string,any>>(db:T):T {
 const prisma=db as any;
 prisma.companyRole??={
  findMany:jest.fn(async({where})=>codes.map(code=>({company_id:where.company_id,code,name:code,is_system:true}))),
  findUnique:jest.fn(async({where:{company_id_code:key}})=>codes.includes(key.code)?{company_id:key.company_id,code:key.code,name:key.code,is_system:true}:null),
  createMany:jest.fn(),
 };
 prisma.auditLog??={create:jest.fn()};prisma.$queryRaw??=jest.fn(async()=>[]);
 prisma.$transaction??=jest.fn(async cb=>cb(prisma));return db;
}
