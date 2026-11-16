import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../../../../database/prismaService';
import type { TokenPayload } from '../../domain/ports/tokenServicePort';
import { requireAssignableRole } from './roleCatalogService';
@Injectable()
export class SessionMembershipService {
 constructor(private readonly prisma:PrismaService){}
 async resolve(payload:TokenPayload):Promise<TokenPayload>{
  if(typeof payload?.sub!=='string'||!payload.sub.trim()||typeof payload.companyId!=='string'||!payload.companyId.trim())throw new UnauthorizedException('La sesión no identifica al usuario y a la empresa.');
  const row=await this.prisma.user.findFirst({where:{id:payload.sub,company_id:payload.companyId},select:{id:true,email:true,company_id:true,role:true,is_active:true,company:{select:{is_active:true}}}});
  if(!row?.is_active||!row.company.is_active)throw new UnauthorizedException('Usuario o empresa inactivos o ajenos a la sesión.');
  try{await requireAssignableRole(this.prisma,row.company_id,row.role);}catch{throw new UnauthorizedException('El rol vigente no pertenece a la empresa o no está habilitado.');}
  // La firma identifica al usuario; su rol vigente se resuelve en cada petición.
  return {sub:row.id,email:row.email,companyId:row.company_id,role:row.role};
 }
}
