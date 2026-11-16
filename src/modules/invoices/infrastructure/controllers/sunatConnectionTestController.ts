import { Controller, HttpCode, Post, UseGuards } from '@nestjs/common';
import { CurrentCompany, Roles } from '../../../../common/decorators';
import { AuthGuard } from '../../../auth/infrastructure/guards/authGuard';
import { RolesGuard } from '../../../auth/infrastructure/guards/rolesGuard';
import { SunatConnectionTestService } from '../../application/services/sunatConnectionTestService';
@Controller('api/v1/invoices/connection-test')
@UseGuards(AuthGuard, RolesGuard)
@Roles('ADMIN')
export class SunatConnectionTestController {
  constructor(private readonly diagnostic: SunatConnectionTestService) {}
  @Post() @HttpCode(200)
  test(@CurrentCompany() companyId: string) { return this.diagnostic.test(companyId); }
}
