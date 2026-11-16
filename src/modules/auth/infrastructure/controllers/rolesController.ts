import { Put } from '@nestjs/common';
import { MenuPermissionsService } from '../../application/services/menuPermissionsService';
import { ModulePermissionsService } from '../../application/services/modulePermissionsService';
import { ActionPermissionsService } from '../../application/services/actionPermissionsService';
import { requireCompanyRole, roleDto } from '../../application/services/roleCatalogService';
import { PrismaService } from '../../../../database/prismaService';
import { Body, Controller, ForbiddenException, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { RoleCatalogService } from '../../application/services/roleCatalogService';
import { CAPABILITIES, SYSTEM_ROLES } from '../../domain/securityCatalog';
import { MENU_CATALOG } from '../../domain/menuCatalog';
import { CreateRoleDto, RenameRoleDto } from '../../application/dto/roleCatalogDto';
import { AuthGuard } from '../guards/authGuard';
import { CurrentUser } from '../decorators/currentUserDecorator';
import type { TokenPayload } from '../../domain/ports/tokenServicePort';

@Controller('api/v1/auth')
@UseGuards(AuthGuard)
export class RolesController {
  constructor(private readonly roles: RoleCatalogService, private readonly menus:MenuPermissionsService, private readonly modules:ModulePermissionsService, private readonly actions:ActionPermissionsService, private readonly prisma:PrismaService) {}
  private admin(user: TokenPayload) { if(user.role!=='ADMIN')throw new ForbiddenException('Solo ADMIN puede administrar roles.'); }
  @Get('roles') list(@CurrentUser() user:TokenPayload) { this.admin(user);return this.roles.list(user.companyId); }
  @Get('roles/config') config() { return this.roles.config(); }
  @Get('permission-catalog') catalog() { return { actions:CAPABILITIES.map(({code,name,reservedAdmin,accessGate})=>({code,name,reservedAdmin,accessGate})), menus:MENU_CATALOG.map(({code,moduleCode,path,parentCode,reservedAdmin})=>({code,moduleCode,path,parentCode,reservedAdmin})) }; }
  @Get('menu-permissions') menuList(@CurrentUser() user:TokenPayload){this.admin(user);return this.menus.list(user.companyId);}
  @Put('menu-permissions') menuSave(@CurrentUser() user:TokenPayload,@Body() rows:unknown){this.admin(user);return this.menus.replace(user.companyId,rows,user.sub);}
  @Get('permissions/me') async mine(@CurrentUser() user:TokenPayload){
    const role=await requireCompanyRole(this.prisma,user.companyId,user.role);
    const [modules,actions,config]=await Promise.all([this.modules.forRole(user.companyId,user.role),this.actions.forRole(user.companyId,user.role),this.roles.config()]);
    const menus=await this.menus.forRole(user.companyId,user.role,modules);
    // Preferencia de inicio de los roles existentes, sin conceder acceso por ella.
    const preferred=user.role==='CONTADOR'?'/accounting':user.role==='OPERADOR_ADUANAS'?'/customs':'/invoices/dashboard';
    const homePath=menus.find(m=>m.path===preferred&&m.canView)?.path??menus.find(m=>m.canView&&!m.path.includes(':'))?.path??null;
    const system=(SYSTEM_ROLES as readonly string[]).includes(user.role);
    // Compatibilidad de los accesos de creación de la UI anterior. Son ayudas
    // de presentación, no nuevos permisos HTTP: M2/M4 siguen su enforcement de módulo.
    const ui={showDuaCreation:modules.some(m=>m.moduleCode==='M2'&&m.canWrite)&&(system?['ADMIN','OPERADOR_ADUANAS'].includes(user.role):config.customRolesEnabled),showAccountingCreation:modules.some(m=>m.moduleCode==='M4'&&m.canWrite)&&(system?['ADMIN','CONTADOR'].includes(user.role):config.customRolesEnabled)};
    return {role:roleDto(role),modules,actions,menus,homePath,ui,...config};
  }
  @Patch('roles/:code') rename(@CurrentUser() user:TokenPayload,@Param('code') code:string,@Body() dto:RenameRoleDto) { this.admin(user);return this.roles.rename(user.companyId,code,dto.name,user.sub); }
  @Post('roles') create(@CurrentUser() user:TokenPayload,@Body() dto:CreateRoleDto) { this.admin(user);return this.roles.create(user.companyId,dto.code,dto.name,user.sub); }
}
