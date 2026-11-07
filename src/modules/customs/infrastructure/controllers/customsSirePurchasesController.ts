import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Query,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { CurrentCompany } from '../../../../common/decorators';
import { AuthGuard } from '../../../auth/infrastructure/guards/authGuard';
import { PrismaService } from '../../../../database/prismaService';
import {
  CUSTOMS_REPOSITORY_PORT,
  type ICustomsRepositoryPort,
} from '../../domain/ports/customsRepositoryPort';
import {
  SireRceAnnex8_4Item,
  SireRceFlatFileWriterAdapter,
} from '../adapters/sireRceFlatFileWriterAdapter';

@Controller('api/v1/customs/sire-purchases')
@UseGuards(AuthGuard)
export class CustomsSirePurchasesController {
  constructor(
    @Inject(CUSTOMS_REPOSITORY_PORT)
    private readonly customsRepository: ICustomsRepositoryPort,
    private readonly prisma: PrismaService,
  ) {}

  @Get('export')
  @HttpCode(HttpStatus.OK)
  async exportSirePurchases(
    @CurrentCompany() companyId: string | undefined,
    @Query('year') year: string = new Date().getFullYear().toString(),
    @Query('month') month: string = (new Date().getMonth() + 1).toString().padStart(2, '0'),
  ) {
    if (!companyId) {
      throw new UnauthorizedException('Identificador de empresa (company_id) requerido.');
    }

    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: { ruc: true, legal_name: true },
    });
    const ruc = company?.ruc ?? '20000000001';

    const declarations = await this.customsRepository.findDeclarationsByCompany(companyId);
    const targetPeriod = `${year}${month.padStart(2, '0')}`;

    const annexItems: SireRceAnnex8_4Item[] = declarations.map((d: any, idx: number) => {
      const duaParts = (d.duaNumber ?? '').split('-');
      const customsCode = duaParts[0] || '118';
      const numYear = Number.parseInt(duaParts[1] || year, 10);
      const correlativeDua = duaParts[3] || '000001';

      return {
        period: targetPeriod,
        cuo: `CUO-${d.id?.substring(0, 8) || (idx + 1).toString().padStart(6, '0')}`,
        correlativeNumber: `M${(idx + 1).toString().padStart(5, '0')}`,
        documentIssueDate: d.numerationDate
          ? new Date(d.numerationDate).toISOString().split('T')[0]
          : `${year}-${month}-01`,
        customsCode,
        numerationYear: numYear,
        correlativeDua,
        supplierName: 'PROVEEDOR DEL EXTERIOR',
        taxableBasePen: Number(d.cifValuePen || 0),
        igvIpmPen: Number(d.totalCustomsTaxesPen || 0),
        perceptionPen: 0.0,
        totalImportCostPen: Number(d.cifValuePen || 0) + Number(d.totalCustomsTaxesPen || 0),
        statusCode: '1',
      };
    });

    const file = SireRceFlatFileWriterAdapter.generateFlatFile(ruc, year, month, annexItems);

    return {
      fileName: file.fileName,
      content: file.content,
      recordsCount: annexItems.length,
      period: targetPeriod,
      ruc,
    };
  }

  @Get('records')
  @HttpCode(HttpStatus.OK)
  async getSirePurchasesRecords(
    @CurrentCompany() companyId: string | undefined,
    @Query('period') period?: string,
  ) {
    if (!companyId) {
      throw new UnauthorizedException('Identificador de empresa (company_id) requerido.');
    }

    const declarations = await this.customsRepository.findDeclarationsByCompany(companyId);
    const targetPeriod =
      period ||
      `${new Date().getFullYear()}${(new Date().getMonth() + 1).toString().padStart(2, '0')}`;

    return declarations.map((d: any, idx: number) => {
      const duaParts = (d.duaNumber ?? '').split('-');
      const customsCode = duaParts[0] || '118';
      const numYear = Number.parseInt(duaParts[1] || '2026', 10);
      const correlativeDua = duaParts[3] || '000001';

      return {
        period: targetPeriod,
        cuo: `CUO-${d.id?.substring(0, 8) || (idx + 1).toString().padStart(6, '0')}`,
        correlative_number: `M${(idx + 1).toString().padStart(5, '0')}`,
        document_issue_date: d.numerationDate
          ? new Date(d.numerationDate).toISOString().split('T')[0]
          : '2026-10-15',
        customs_code: customsCode,
        numeration_year: numYear,
        correlative_dua: correlativeDua,
        supplier_name: 'PROVEEDOR DEL EXTERIOR',
        taxable_base_pen: Number(d.cifValuePen || 0),
        igv_ipm_pen: Number(d.totalCustomsTaxesPen || 0),
        perception_pen: 0.0,
        total_import_cost_pen:
          Number(d.cifValuePen || 0) + Number(d.totalCustomsTaxesPen || 0),
        status_code: '1',
      };
    });
  }

  // ==========================================
  // GET: Reporte de Conciliación SIRE RCE contra Kardex (Fase 4)
  // Cruce de propuestas RCE contra compras locales (Op. 02) e importaciones (Op. 18)
  // ==========================================
  @Get('reconciliation')
  @HttpCode(HttpStatus.OK)
  async getSireRceKardexReconciliation(
    @CurrentCompany() companyId: string | undefined,
    @Query('period') period?: string,
  ) {
    if (!companyId) {
      throw new UnauthorizedException('Identificador de empresa (company_id) requerido.');
    }

    const targetPeriod =
      period ||
      `${new Date().getFullYear()}${(new Date().getMonth() + 1).toString().padStart(2, '0')}`;

    // 1. Propuestas SIRE RCE del periodo
    const sireProposals = await this.prisma.sireProposal.findMany({
      where: {
        company_id: companyId,
        period: targetPeriod,
        book_type: 'RCE_COMPRAS',
      },
    });

    // 2. Compras nacionales registradas
    const nationalPurchases = await this.prisma.nationalPurchase.findMany({
      where: { company_id: companyId },
      include: { items: true },
    });

    // 3. Declaraciones aduaneras de importación
    const declarations = await this.customsRepository.findDeclarationsByCompany(companyId);

    // 4. Movimientos de almacén / Kardex de compra e importación
    const kardexMovements = await this.prisma.inventoryMovement.findMany({
      where: {
        company_id: companyId,
        operation_type_code: { in: ['02', '18'] },
      },
    });

    const items: Array<{
      id: string;
      origin: 'NACIONAL' | 'IMPORTACION';
      documentTypeCode: string;
      documentSerial: string;
      documentNumber: string;
      supplierDocNumber: string;
      supplierName: string;
      issueDate: string;
      taxableBaseKardex: number;
      taxableBaseSire: number;
      totalKardex: number;
      totalSire: number;
      amountDifference: number;
      status: 'CONCILIADO' | 'SOLO_EN_KARDEX' | 'SOLO_EN_SIRE' | 'DISCREPANCIA_MONTO';
      kardexMovementsCount: number;
    }> = [];

    const matchedSireIds = new Set<string>();

    // Cruzar compras nacionales
    for (const np of nationalPurchases) {
      const relatedMovs = kardexMovements.filter(
        (m) => m.document_serial === np.document_serial && m.document_number === np.document_number,
      );

      const matchingSire = sireProposals.find(
        (sp) =>
          sp.document_type === np.document_type_code &&
          sp.series.trim().toUpperCase() === np.document_serial.trim().toUpperCase() &&
          sp.correlative.trim().replace(/^0+/, '') === np.document_number.trim().replace(/^0+/, ''),
      );

      const totalKardex = Number(np.total_amount);
      const totalSire = matchingSire ? Number(matchingSire.total_amount) : 0;
      const baseKardex = Number(np.net_amount);
      const baseSire = matchingSire ? Number(matchingSire.taxable_base) : 0;
      const diff = matchingSire ? Math.round(Math.abs(totalKardex - totalSire) * 100) / 100 : totalKardex;

      let status: 'CONCILIADO' | 'SOLO_EN_KARDEX' | 'SOLO_EN_SIRE' | 'DISCREPANCIA_MONTO' = 'SOLO_EN_KARDEX';
      if (matchingSire) {
        matchedSireIds.add(matchingSire.id);
        status = diff <= 0.05 ? 'CONCILIADO' : 'DISCREPANCIA_MONTO';
      }

      items.push({
        id: np.id,
        origin: 'NACIONAL',
        documentTypeCode: np.document_type_code,
        documentSerial: np.document_serial,
        documentNumber: np.document_number,
        supplierDocNumber: np.supplier_doc_number,
        supplierName: np.supplier_name,
        issueDate: np.issue_date.toISOString().split('T')[0],
        taxableBaseKardex: baseKardex,
        taxableBaseSire: baseSire,
        totalKardex,
        totalSire,
        amountDifference: diff,
        status,
        kardexMovementsCount: relatedMovs.length,
      });
    }

    // Cruzar declaraciones de importación (DAM / DUA)
    for (const dec of declarations) {
      const duaParts = (dec.duaNumber ?? '').split('-');
      const customsCode = duaParts[0] || '118';
      const correlativeDua = duaParts[3] || '000001';

      const relatedMovs = kardexMovements.filter(
        (m) => m.document_number?.includes(correlativeDua) || m.source_reference_id?.includes(dec.id),
      );

      const matchingSire = sireProposals.find(
        (sp) =>
          (sp.document_type === '50' || sp.document_type === '52') &&
          sp.correlative.trim().replace(/^0+/, '') === correlativeDua.trim().replace(/^0+/, ''),
      );

      const totalKardex = Number(dec.cifValuePen || 0) + Number(dec.totalCustomsTaxesPen || 0);
      const totalSire = matchingSire ? Number(matchingSire.total_amount) : 0;
      const baseKardex = Number(dec.cifValuePen || 0);
      const baseSire = matchingSire ? Number(matchingSire.taxable_base) : 0;
      const diff = matchingSire ? Math.round(Math.abs(totalKardex - totalSire) * 100) / 100 : totalKardex;

      let status: 'CONCILIADO' | 'SOLO_EN_KARDEX' | 'SOLO_EN_SIRE' | 'DISCREPANCIA_MONTO' = 'SOLO_EN_KARDEX';
      if (matchingSire) {
        matchedSireIds.add(matchingSire.id);
        status = diff <= 0.05 ? 'CONCILIADO' : 'DISCREPANCIA_MONTO';
      }

      items.push({
        id: dec.id,
        origin: 'IMPORTACION',
        documentTypeCode: '50',
        documentSerial: customsCode,
        documentNumber: correlativeDua,
        supplierDocNumber: 'EXTRANJERO',
        supplierName: 'PROVEEDOR DEL EXTERIOR',
        issueDate: dec.numerationDate ? new Date(dec.numerationDate).toISOString().split('T')[0] : '2026-10-15',
        taxableBaseKardex: baseKardex,
        taxableBaseSire: baseSire,
        totalKardex,
        totalSire,
        amountDifference: diff,
        status,
        kardexMovementsCount: relatedMovs.length,
      });
    }

    // Identificar propuestas SIRE que no están en Kardex (pendientes de almacén)
    for (const sp of sireProposals) {
      if (!matchedSireIds.has(sp.id)) {
        items.push({
          id: sp.id,
          origin: sp.document_type === '50' || sp.document_type === '52' ? 'IMPORTACION' : 'NACIONAL',
          documentTypeCode: sp.document_type,
          documentSerial: sp.series,
          documentNumber: sp.correlative,
          supplierDocNumber: sp.emitter_ruc,
          supplierName: sp.emitter_legal_name || 'EMISOR SIRE',
          issueDate: sp.issue_date.toISOString().split('T')[0],
          taxableBaseKardex: 0,
          taxableBaseSire: Number(sp.taxable_base),
          totalKardex: 0,
          totalSire: Number(sp.total_amount),
          amountDifference: Number(sp.total_amount),
          status: 'SOLO_EN_SIRE',
          kardexMovementsCount: 0,
        });
      }
    }

    // Calcular KPIs de conciliación
    const matchedCount = items.filter((i) => i.status === 'CONCILIADO').length;
    const pendingKardexCount = items.filter((i) => i.status === 'SOLO_EN_SIRE').length;
    const pendingSireCount = items.filter((i) => i.status === 'SOLO_EN_KARDEX').length;
    const discrepancyCount = items.filter((i) => i.status === 'DISCREPANCIA_MONTO').length;
    const totalRecords = items.length;
    const matchRate = totalRecords > 0 ? Math.round((matchedCount / totalRecords) * 100) : 100;

    const totalAmountKardex = Math.round(items.reduce((acc, i) => acc + i.totalKardex, 0) * 100) / 100;
    const totalAmountSire = Math.round(items.reduce((acc, i) => acc + i.totalSire, 0) * 100) / 100;

    return {
      period: targetPeriod,
      summary: {
        totalRecords,
        matchedCount,
        pendingKardexCount,
        pendingSireCount,
        discrepancyCount,
        matchRate,
        totalAmountKardex,
        totalAmountSire,
      },
      items,
    };
  }
}

