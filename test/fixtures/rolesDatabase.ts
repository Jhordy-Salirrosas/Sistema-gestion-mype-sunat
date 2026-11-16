import { PrismaService } from '../../src/database/prismaService';

/** Solo la base efímera de este paquete; nunca usa DATABASE_URL implícita. */
export async function rolesDatabase() {
  const value=process.env.ROLES_TEST_DATABASE_URL;
  if(!value)throw new Error('Defina ROLES_TEST_DATABASE_URL para la integración local.');
  const url=new URL(value);
  if(!['127.0.0.1','localhost'].includes(url.hostname)||!url.pathname.startsWith('/roles_'))throw new Error('Solo se permite PostgreSQL local aislado roles_*.');
  const previous=process.env.DATABASE_URL;let db:PrismaService;
  try{process.env.DATABASE_URL=value;db=new PrismaService();}
  finally{if(previous===undefined)delete process.env.DATABASE_URL;else process.env.DATABASE_URL=previous;}
  await db.$connect();return db;
}
