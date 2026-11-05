import { BadRequestException, ConflictException } from '@nestjs/common';
import { ImportOrderService } from '../../../src/modules/customs/application/services/importOrderService';

describe('ImportOrderService (Fase 3 - Órdenes de Importación, Documentos y Flujo Aduanero)', () => {
  let service: ImportOrderService;
  let mockPrisma: any;

  const companyId = 'company-test-100';

  beforeEach(() => {
    mockPrisma = {
      importOrder: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        count: jest.fn(),
      },
      importOrderStageHistory: {
        create: jest.fn(),
      },
      importOrderDocument: {
        create: jest.fn(),
        findMany: jest.fn(),
      },
      customsShipment: {
        create: jest.fn(),
        count: jest.fn(),
      },
      customsDocument: {
        create: jest.fn(),
      },
      customsEvent: {
        create: jest.fn(),
      },
    };

    service = new ImportOrderService(mockPrisma);
  });

  it('debe crear una orden de importación calculando valor FOB, CIF estimado y etapas iniciales', async () => {
    mockPrisma.importOrder.count.mockResolvedValue(0);
    mockPrisma.importOrder.findFirst.mockResolvedValue(null);

    mockPrisma.importOrder.create.mockImplementation((args: any) => ({
      id: 'ord-uuid-1',
      ...args.data,
      total_fob: args.data.total_fob,
      estimated_freight: args.data.estimated_freight,
      estimated_insurance: args.data.estimated_insurance,
      total_cif: args.data.total_cif,
      items: args.data.items.create.map((it: any, idx: number) => ({ id: `item-${idx}`, ...it })),
      stages: args.data.stages.create.map((st: any, idx: number) => ({ id: `stage-${idx}`, ...st })),
      documents: [],
    }));

    const result = await service.createOrder(companyId, {
      supplierName: 'Shenzhen Tech Electronics Co.',
      supplierCountry: 'CN',
      incoterm: 'FOB',
      currencyCode: 'USD',
      estimatedFreight: 2000.0,
      estimatedInsurance: 500.0,
      items: [
        { description: 'Smartphones Android 5G', quantity: 100, unitPriceFob: 150.0 }, // 15000 FOB
        { description: 'Cargadores USB-C 65W', quantity: 200, unitPriceFob: 10.0 },    // 2000 FOB
      ],
    });

    expect(result.orderNumber).toBe('OC-2026-0001');
    expect(result.totalFob).toBe(17000.0);
    expect(result.estimatedFreight).toBe(2000.0);
    expect(result.estimatedInsurance).toBe(500.0);
    expect(result.totalCif).toBe(19500.0);
    expect(result.status).toBe('APROBADA');
    expect(result.currentStage).toBe('Aprobación / OC');
    expect(result.currentStageIndex).toBe(1);
    expect(result.stages.length).toBe(2); // Solicitud y Aprobación / OC
  });

  it('debe rechazar la creación si el número de orden ya existe', async () => {
    mockPrisma.importOrder.findFirst.mockResolvedValue({ id: 'existing-ord', order_number: 'OC-2026-0089' });

    await expect(
      service.createOrder(companyId, {
        orderNumber: 'OC-2026-0089',
        supplierName: 'Shenzhen Tech',
        items: [{ description: 'Test', quantity: 10, unitPriceFob: 5 }],
      }),
    ).rejects.toThrow(ConflictException);
  });

  it('debe registrar un documento de checklist con hash SHA-256 para una orden', async () => {
    mockPrisma.importOrder.findFirst.mockResolvedValue({
      id: 'ord-uuid-1',
      company_id: companyId,
      order_number: 'OC-2026-0001',
      supplier_name: 'Shenzhen Tech',
    });

    mockPrisma.importOrderDocument.create.mockImplementation((args: any) => ({
      id: 'doc-uuid-1',
      ...args.data,
      created_at: new Date(),
    }));

    const result = await service.addDocument(companyId, 'ord-uuid-1', {
      stageIndex: 3,
      stageName: 'Embarque',
      documentType: 'BL_GUIA_AEREA',
      documentNumber: 'BL-MSK-998822',
      fileName: 'bill_of_lading_msk.pdf',
      storageUrl: 'https://storage.supabase.co/customs/bill_of_lading_msk.pdf',
    });

    expect(result.id).toBe('doc-uuid-1');
    expect(result.documentType).toBe('BL_GUIA_AEREA');
    expect(result.fileHash).toBeDefined();
    expect(result.fileHash?.length).toBe(64); // SHA-256 64 hex chars
    expect(result.isVerified).toBe(true);
  });

  it('debe generar el checklist de 14 etapas indicando documentos adjuntos y pendientes', async () => {
    mockPrisma.importOrder.findFirst.mockResolvedValue({
      id: 'ord-uuid-1',
      company_id: companyId,
      current_stage_index: 3,
      documents: [
        {
          id: 'doc-1',
          stage_index: 1,
          document_type: 'ORDEN_COMPRA',
          document_number: 'OC-2026-0001',
          file_name: 'oc_signed.pdf',
          storage_url: 'https://...',
          file_hash: 'hash123',
          is_verified: true,
          created_at: new Date(),
        },
      ],
    });

    const checklist = await service.getChecklist(companyId, 'ord-uuid-1');

    expect(checklist.length).toBe(14);
    expect(checklist[1].isCompleted).toBe(true);
    expect(checklist[1].mandatoryDocType).toBe('ORDEN_COMPRA');
    expect(checklist[3].isCurrent).toBe(true);
    expect(checklist[3].isCompleted).toBe(false);
  });

  it('debe avanzar la orden de etapa, vincular expediente aduanero y registrar el historial auditable', async () => {
    mockPrisma.importOrder.findFirst.mockResolvedValue({
      id: 'ord-uuid-1',
      company_id: companyId,
      order_number: 'OC-2026-0001',
      supplier_name: 'Shenzhen Tech',
      current_stage_index: 1,
      current_stage: 'Aprobación / OC',
      status: 'APROBADA',
      shipment_id: null,
      documents: [],
    });

    mockPrisma.customsShipment.count.mockResolvedValue(0);
    mockPrisma.customsShipment.create.mockResolvedValue({
      id: 'shipment-uuid-99',
      shipment_number: 'EXP-2026-0001',
    });

    mockPrisma.importOrder.update.mockImplementation((args: any) => ({
      id: 'ord-uuid-1',
      order_number: 'OC-2026-0001',
      supplier_name: 'Shenzhen Tech',
      current_stage_index: args.data.current_stage_index,
      current_stage: args.data.current_stage,
      status: args.data.status,
      shipment_id: args.data.shipment_id,
      items: [],
      stages: [
        { stage_index: 3, stage_name: 'Embarque', status: 'COMPLETADO', user_name: 'carlos.ahumada' },
      ],
      documents: [],
    }));

    const result = await service.advanceStage(companyId, 'ord-uuid-1', {
      nextStageIndex: 3, // Embarque
      stageName: 'Embarque',
      userName: 'carlos.ahumada',
      evidenceNotes: 'Bill of Lading emitido por naviera.',
      documentUrl: 'https://storage/bl.pdf',
      documentType: 'BL_GUIA_AEREA',
      documentNumber: 'BL-9921',
      fileName: 'bl.pdf',
    });

    expect(mockPrisma.importOrderStageHistory.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        order_id: 'ord-uuid-1',
        stage_index: 3,
        stage_name: 'Embarque',
        user_name: 'carlos.ahumada',
      }),
    });

    expect(result.currentStage).toBe('Embarque');
    expect(result.status).toBe('EN_TRANSITO');
    expect(mockPrisma.customsShipment.create).toHaveBeenCalled();
  });

  it('debe rechazar etapas con índice inválido fuera del rango 0..13', async () => {
    mockPrisma.importOrder.findFirst.mockResolvedValue({ id: 'ord-1' });

    await expect(
      service.advanceStage(companyId, 'ord-1', {
        nextStageIndex: 99,
        stageName: 'Inexistente',
        userName: 'operador',
      }),
    ).rejects.toThrow(BadRequestException);
  });
});
