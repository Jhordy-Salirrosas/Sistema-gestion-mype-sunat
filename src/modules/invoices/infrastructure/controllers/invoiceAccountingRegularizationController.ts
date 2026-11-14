import { Body, Controller, HttpCode, Post, UseGuards } from '@nestjs/common';
import { CurrentCompany, Roles } from '../../../../common/decorators';
import { AuthGuard } from '../../../auth/infrastructure/guards/authGuard';
import { RolesGuard } from '../../../auth/infrastructure/guards/rolesGuard';
import { AccountingRegularizationService } from '../../application/services/accountingRegularizationService';

/**
 * Regularización contable en lote.
 *
 * Endpoint aparte del reintento individual (`:id/reprocesar-puente`) para no
 * cambiar el contrato ni el grafo de dependencias de ese controlador.
 */
@Controller('api/v1/invoices')
@UseGuards(AuthGuard, RolesGuard)
@Roles('ADMIN')
export class InvoiceAccountingRegularizationController {
  constructor(private readonly regularizacion: AccountingRegularizationService) {}

  /**
   * Regulariza en lote los comprobantes aceptados sin asiento.
   *
   * `dryRun` viene activo por defecto: la primera llamada solo informa qué
   * comprobantes quedarían regularizados. Para ejecutar hay que enviar
   * `{ "dryRun": false }` de forma explícita.
   */
  @Post('accounting/reprocess')
  @HttpCode(200)
  regularizar(
    @CurrentCompany() companyId: string,
    @Body() body: { dryRun?: boolean; limit?: number; ids?: string[] },
  ) {
    return this.regularizacion.execute(companyId, body ?? {});
  }
}
