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
}

