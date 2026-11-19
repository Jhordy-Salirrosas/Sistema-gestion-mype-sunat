import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../../../auth/infrastructure/guards/authGuard';
import { ListAccountingAccountsUseCase } from '../../application/use-cases/listAccountingAccountsUseCase';

/**
 * Catálogo PCGE para los selectores de cuentas contables.
 *
 * El plan de cuentas es global y oficial; este endpoint es de solo lectura y
 * expone la tabla `accounting_accounts` sin duplicarla en otros módulos.
 * Se publica tanto en la ruta en español como en el prefijo histórico en
 * inglés para no romper a los consumidores existentes.
 */
@Controller(['api/v1/contabilidad', 'api/v1/accounting'])
@UseGuards(AuthGuard)
export class AccountingPlanCuentasController {
  constructor(
    private readonly listAccountsUseCase: ListAccountingAccountsUseCase,
  ) {}

  @Get('plan-cuentas')
  listar(@Query('includeInactive') includeInactive?: string) {
    return this.listAccountsUseCase.execute(includeInactive === 'true');
  }
}
