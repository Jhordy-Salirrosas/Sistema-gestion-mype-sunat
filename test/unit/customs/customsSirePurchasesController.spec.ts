import { CustomsSirePurchasesController } from '../../../src/modules/customs/infrastructure/controllers/customsSirePurchasesController';
import { UnauthorizedException } from '@nestjs/common';

describe('CustomsSirePurchasesController (Controller Unit Test)', () => {
  let controller: CustomsSirePurchasesController;
  let mockCustomsRepo: any;
  let mockPrisma: any;

  beforeEach(() => {
    mockCustomsRepo = {
      findDeclarationsByCompany: jest.fn().mockResolvedValue([
        {
          id: 'decl-01',
          duaNumber: '118-2026-10-004200',
          numerationDate: new Date('2026-10-18'),
          cifValuePen: 197016.5,
          totalCustomsTaxesPen: 35462.97,
        },
      ]),
    };
    mockPrisma = {
      company: {
        findUnique: jest.fn().mockResolvedValue({
          ruc: '20601234567',
          legal_name: 'EMPRESA MYPE SAC',
        }),
      },
    };
    controller = new CustomsSirePurchasesController(mockCustomsRepo, mockPrisma);
  });

  it('debe exportar archivo plano Anexo 8.4 para el periodo solicitado', async () => {
    const result = await controller.exportSirePurchases('comp-1', '2026', '10');

    expect(result.fileName).toBe('LE2060123456720261000080400001111.txt');
    expect(result.recordsCount).toBe(1);
    expect(result.content).toContain('|50|118|2026|004200|');
  });

  it('debe arrojar UnauthorizedException si companyId no está presente', async () => {
    await expect(controller.exportSirePurchases(undefined)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('debe generar el reporte de conciliación SIRE RCE vs Kardex cruzando compras e importaciones', async () => {
    mockPrisma.sireProposal = {
      findMany: jest.fn().mockResolvedValue([
        {
          id: 'sp-1',
          document_type: '01',
          series: 'F001',
          correlative: '00000001',
          emitter_ruc: '20100000001',
          emitter_legal_name: 'PROVEEDOR SAC',
          taxable_base: 1000,
          igv_amount: 180,
          total_amount: 1180,
          issue_date: new Date('2026-10-10'),
        },
      ]),
    };
    mockPrisma.nationalPurchase = {
      findMany: jest.fn().mockResolvedValue([
        {
          id: 'np-1',
          document_type_code: '01',
          document_serial: 'F001',
          document_number: '00000001',
          supplier_doc_number: '20100000001',
          supplier_name: 'PROVEEDOR SAC',
          net_amount: 1000,
          igv_amount: 180,
          total_amount: 1180,
          issue_date: new Date('2026-10-10'),
        },
      ]),
    };
    mockPrisma.inventoryMovement = {
      findMany: jest.fn().mockResolvedValue([
        {
          document_serial: 'F001',
          document_number: '00000001',
          operation_type_code: '02',
        },
      ]),
    };

    const report = await controller.getSireRceKardexReconciliation('comp-1', '202610');

    expect(report.summary.totalRecords).toBeGreaterThan(0);
    expect(report.summary.matchedCount).toBe(1);
    expect(report.items[0].status).toBe('CONCILIADO');
    expect(report.items[0].origin).toBe('NACIONAL');
  });
});

