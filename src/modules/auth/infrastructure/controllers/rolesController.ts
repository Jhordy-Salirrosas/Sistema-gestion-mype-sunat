import { Body, Controller, ForbiddenException, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { RoleCatalogService } from '../../application/services/roleCatalogService';
import { CAPABILITIES } from '../../domain/securityCatalog';
import { MENU_CATALOG } from '../../domain/menuCatalog';
import { CreateRoleDto, RenameRoleDto } from '../../application/dto/roleCatalogDto';
import { AuthGuard } from '../guards/authGuard';
import { CurrentUser } from '../decorators/currentUserDecorator';
import type { TokenPayload } from '../../domain/ports/tokenServicePort';

@Controller('api/v1/auth')
@UseGuards(AuthGuard)
export class RolesController {
  constructor(private readonly roles: RoleCatalogService) {}
  private admin(user: TokenPayload) { if(user.role!=='ADMIN')throw new ForbiddenException('Solo ADMIN puede administrar roles.'); }
  @Get('roles') list(@CurrentUser() user:TokenPayload) { this.admin(user);return this.roles.list(user.companyId); }
  @Get('roles/config') config() { return this.roles.config(); }
  @Get('permission-catalog') catalog() { return { actions:CAPABILITIES.map(({code,name,reservedAdmin})=>({code,name,reservedAdmin})), menus:MENU_CATALOG.map(({code,moduleCode,path,parentCode,reservedAdmin})=>({code,moduleCode,path,parentCode,reservedAdmin})) }; }
  @Patch('roles/:code') rename(@CurrentUser() user:TokenPayload,@Param('code') code:string,@Body() dto:RenameRoleDto) { this.admin(user);return this.roles.rename(user.companyId,code,dto.name,user.sub); }
  @Post('roles') create(@CurrentUser() user:TokenPayload,@Body() dto:CreateRoleDto) { this.admin(user);return this.roles.create(user.companyId,dto.code,dto.name,user.sub); }
}
