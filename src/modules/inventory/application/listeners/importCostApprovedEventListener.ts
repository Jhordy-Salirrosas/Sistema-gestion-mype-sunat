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
              damNumber: event.payload.duaNumber || event.payload.declarationId || 'DAM-IMPORT',
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

    const {
      companyId,
      shipmentId,
      declarationId,
      approvedAt,
      totalCifPen,
      totalDutiesPen,
      totalLocalExpensesPen,
      totalInventoryCostPen,
    } = event.payload;

    const existente = await this.prisma.accountingEntry.findFirst({
      where: {
        company_id: companyId,
        source_module: 'PURCHASES_IMPORT',
        source_reference_id: shipmentId,
      },
      select: { id: true },
    });
    if (existente) return;

    const prisma = this.prisma as any;
    const mappings =
      (await prisma.accountingMapping?.findMany({
        where: { company_id: companyId, process_code: 'IMPORTACION', is_active: true },
      })) ?? [];
    const map = new Map<string, string>(mappings.map((m: any) => [m.role_code, m.account_code]));
    const cuenta = (role: string, fallback: string) => map.get(role) || fallback;

    const dam = declarationId
      ? await prisma.customsDeclaration?.findFirst({
          where: {
            company_id: companyId,
            OR: [{ id: declarationId }, { dua_number: declarationId }],
          },
          select: {
            cif_value_pen: true,
            ad_valorem_amount_pen: true,
          },
        })
      : null;

    const cif = Number(dam?.cif_value_pen ?? totalCifPen ?? 0);
    const adval = Number(dam?.ad_valorem_amount_pen ?? totalDutiesPen ?? 0);
    const local = Number(totalLocalExpensesPen ?? 0);
    const totalMercaderia = Number(
      (totalInventoryCostPen || (cif + adval + local)).toFixed(2),
    );

    const lineas: Array<{
      lineOrder: number;
      accountCode: string;
      accountName: string;
      debitAmount: number;
      creditAmount: number;
    }> = [];

    // 1. DEBE: Existencias en almacén (NIC 2 costo total de adquisición nacionalizado)
    lineas.push({
      lineOrder: 1,
      accountCode: cuenta('INGRESO_ALMACEN', '20111'),
      accountName: 'Mercaderías en almacén',
      debitAmount: totalMercaderia,
      creditAmount: 0,
    });

    // 2. HABER: Proveedores del exterior (Valor CIF / Factura comercial internacional)
    if (cif > 0) {
      lineas.push({
        lineOrder: lineas.length + 1,
        accountCode: cuenta('CXP_EXTERIOR', '42122'),
        accountName: 'Proveedores del exterior',
        debitAmount: 0,
        creditAmount: Number(cif.toFixed(2)),
      });
    }

    // 3. HABER: Derechos arancelarios Ad Valorem (SUNAT)
    if (adval > 0) {
      lineas.push({
        lineOrder: lineas.length + 1,
        accountCode: cuenta('AD_VALOREM', '40151'),
        accountName: 'Derechos arancelarios',
        debitAmount: 0,
        creditAmount: Number(adval.toFixed(2)),
      });
    }

    // 4. HABER: Facturas de gastos locales de desaduanaje
    if (local > 0) {
      lineas.push({
        lineOrder: lineas.length + 1,
        accountCode: cuenta('CXP_LOCAL', '42121'),
        accountName: 'Facturas de gastos locales por pagar',
        debitAmount: 0,
        creditAmount: Number(local.toFixed(2)),
      });
    }

    // 5. Cuadre estricto de partida doble (si no hubo desglose CIF/Arancel, acreditar a existencias por recibir 28111)
    const totalDebe = Number(lineas.reduce((s, l) => s + l.debitAmount, 0).toFixed(2));
    const totalHaber = Number(lineas.reduce((s, l) => s + l.creditAmount, 0).toFixed(2));
    const ajuste = Number((totalDebe - totalHaber).toFixed(2));

    if (ajuste !== 0) {
      if (ajuste > 0) {
        lineas.push({
          lineOrder: lineas.length + 1,
          accountCode: cuenta('TRANSITO', '28111'),
          accountName: 'Existencias por recibir',
          debitAmount: 0,
          creditAmount: ajuste,
        });
      } else {
        lineas.push({
          lineOrder: lineas.length + 1,
          accountCode: cuenta('TRANSITO', '28111'),
          accountName: 'Existencias por recibir',
          debitAmount: Math.abs(ajuste),
          creditAmount: 0,
        });
      }
    }

    const fecha = approvedAt instanceof Date ? approvedAt : new Date(approvedAt);
    const period = `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}`;
    await this.accounting.execute({
      companyId,
      period,
      entryDate: fecha.toISOString(),
      glosa: `Importación ${shipmentId} · asiento de nacionalización DAM`,
      sourceModule: 'PURCHASES_IMPORT',
      journalCode: 'COM',
      sourceReferenceId: shipmentId,
      lines: lineas,
    });
  }
}
