import { mkdtempSync,copyFileSync,readdirSync,readFileSync,rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
it('valida el candidato texto/FK sin cambiar el esquema enum activo ni conectar DB',()=>{
 const active=readFileSync('prisma/schema/auth.prisma','utf8');const candidate=readFileSync('prisma/cutover/auth.prisma','utf8');
 expect(active).toContain('enum Role');expect(candidate).not.toContain('enum Role');expect(candidate.match(/role_catalog CompanyRole/g)).toHaveLength(3);expect(candidate.match(/references: \[company_id, code\], onDelete: Restrict, onUpdate: Restrict/g)).toHaveLength(4);
 const dir=mkdtempSync(join(tmpdir(),'roles-cutover-'));try{
 for(const file of readdirSync('prisma/schema'))if(file.endsWith('.prisma'))copyFileSync(file==='auth.prisma'?'prisma/cutover/auth.prisma':'prisma/schema/'+file,join(dir,file));
 const out=execFileSync(process.execPath,['node_modules/prisma/build/index.js','validate','--schema',dir],{env:{...process.env,DATABASE_URL:'postgresql://unused:unused@127.0.0.1:1/roles_unused',DIRECT_URL:'postgresql://unused:unused@127.0.0.1:1/roles_unused'},encoding:'utf8'});expect(out).toContain('valid');
 }finally{rmSync(dir,{recursive:true,force:true});}
 expect(readFileSync('prisma/schema/auth.prisma','utf8')).toBe(active);
},30_000);
