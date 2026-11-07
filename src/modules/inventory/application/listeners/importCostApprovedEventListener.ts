import { Injectable, Logger, OnModuleInit, Optional, Inject } from '@nestjs/common';
import {
  CUSTOMS_EVENT_PUBLISHER_PORT,
  type ICustomsEventPublisherPort,
} from '../../../customs/domain/ports/customsEventPublisherPort';
import { ProcessImportCostOrderUseCase } from '../use-cases/processImportCostOrderUseCase';
import { ImportCostApprovedEvent } from '../../../customs/domain/events/ImportCostApprovedEvent';
import { PrismaService } from '../../../../database/prismaService';
import { GenerateAccountingEntryUseCase } from '../../../accounting/application/use-cases/generateAccountingEntryUseCase';

@Injectable()
export class ImportCostApprovedEventListener implements OnModuleInit {
  private readonly logger = new Logger(ImportCostApprovedEventListener.name);

  constructor(
    private readonly processImportCostOrderUseCase: ProcessImportCostOrderUseCase,
    @Optional()
    @Inject(CUSTOMS_EVENT_PUBLISHER_PORT)
    private readonly customsEventPublisher?: ICustomsEventPublisherPort,
    @Optional()
    private readonly prisma?: PrismaService,
    @Optional()
    private readonly accounting?: GenerateAccountingEntryUseCase,
  ) {}

  onModuleInit() {
    if (
      this.customsEventPublisher &&
      typeof (this.customsEventPublisher as any).on === 'function'
    ) {
      (this.customsEventPublisher as any).on(
        'customs.import_cost.approved',
        async (event: ImportCostApprovedEvent) => {
          this.logger.log(
            `[EVENT_LISTENER] Consumiendo ImportCostApprovedEvent para shipment ${event.payload.shipmentId}`,
          );
          try {
            await this.processImportCostOrderUseCase.execute({
              companyId: event.payload.companyId,
              shipmentId: event.payload.shipmentId,
              damNumber: event.payload.declarationId || 'DAM-IMPORT',
              items: event.payload.costItems.map((i) => ({
                sku: i.productCode,
                description: i.commercialDescription,
                receivedQuantity: i.quantity,
                unitLandedCostPen: i.unitLandedCostPen,
                destinationType: i.destinationType,
              })),
            });
            await this.registrarAsientoImportacion(event);
          } catch (err: any) {
            this.logger.error(
              `Error al procesar ImportCostApprovedEvent: ${err.message}`,
              err.stack,
            );
          }
        },
      );
    }
  }

  /** Asiento de importación usando el mapeador de cuentas y la DAM. */
  private async registrarAsientoImportacion(event: ImportCostApprovedEvent): Promise<void> {
    if (!this.accounting || !this.prisma) return;

    const { companyId, shipmentId, declarationId, approvedAt, totalCifPen, totalDutiesPen, totalLocalExpensesPen, totalInventoryCostPen } = event.payload;
    const existente = await this.prisma.accountingEntry.findFirst({
      where: { company_id: companyId, source_module: 'PURCHASES_IMPORT', source_reference_id: shipmentId },
      select: { id: true },
    });
    if (existente) return;

    const prisma = this.prisma as any;
    const mappings = (await prisma.accountingMapping?.findMany({
      where: { company_id: companyId, process_code: 'IMPORTACION', is_active: true },
    })) ?? [];
    const map = new Map<string, string>(mappings.map((m: any) => [m.role_code, m.account_code]));
    const cuenta = (role: string, fallback: string) => map.get(role) || fallback;

    const dam = declarationId
      ? await prisma.customsDeclaration?.findFirst({
          where: { id: declarationId, company_id: companyId },
          select: { cif_value_pen: true, ad_valorem_amount_pen: true, igv_ipm_amount_pen: true, perception_amount_pen: true },
        })
      : null;

    const cif = Number(dam?.cif_value_pen ?? totalCifPen ?? 0);
    const adval = Number(dam?.ad_valorem_amount_pen ?? totalDutiesPen ?? 0);
    const igvIpm = Number(dam?.igv_ipm_amount_pen ?? 0);
    const percepcion = Number(dam?.perception_amount_pen ?? 0);
    const local = Number(totalLocalExpensesPen ?? 0);
    const total = Number(totalInventoryCostPen ?? 0);

    const lineas: Array<{ lineOrder: number; accountCode: string; accountName: string; debitAmount: number; creditAmount: number }> = [
      { lineOrder: 1, accountCode: cuenta('INGRESO_ALMACEN', '20111'), accountName: 'Mercaderías en almacén', debitAmount: total, creditAmount: 0 },
    ];
    const creditos = [
      { role: 'CXP_EXTERIOR', fallback: '42122', name: 'Proveedores del exterior', amount: cif },
      { role: 'AD_VALOREM', fallback: '40151', name: 'Derechos arancelarios', amount: adval },
      { role: 'IGV_IMPORTACION', fallback: '40115', name: 'IGV importación', amount: igvIpm },
      { role: 'PERCEPCION_IGV', fallback: '40113', name: 'Percepción IGV', amount: percepcion },
      { role: 'CXP_EXTERIOR', fallback: '42122', name: 'Gastos locales', amount: local },
    ].filter((c) => c.amount > 0);

    let acumulado = 0;
    for (const c of creditos) {
      acumulado += c.amount;
      lineas.push({ lineOrder: lineas.length + 1, accountCode: cuenta(c.role, c.fallback), accountName: c.name, debitAmount: 0, creditAmount: c.amount });
    }
    const diferencia = Math.round((total - acumulado) * 100) / 100;
    if (diferencia !== 0) {
      const cuentaAjuste = diferencia > 0 ? cuenta('TRANSITO', '28111') : cuenta('CXP_EXTERIOR', '42122');
      lineas.push({ lineOrder: lineas.length + 1, accountCode: cuentaAjuste, accountName: diferencia > 0 ? 'Existencias por recibir' : 'Ajuste proveedor exterior', debitAmount: Math.max(-diferencia, 0), creditAmount: Math.max(diferencia, 0) });
    }

    const fecha = approvedAt instanceof Date ? approvedAt : new Date(approvedAt);
    const period = `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}`;
    await this.accounting.execute({
      companyId, period, entryDate: fecha.toISOString(),
      glosa: `Importación ${shipmentId} · asiento de nacionalización DAM`,
      sourceModule: 'PURCHASES_IMPORT', sourceReferenceId: shipmentId,
      lines: lineas,
    });
  }
}
