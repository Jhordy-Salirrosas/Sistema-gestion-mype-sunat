import { CustomsAccountingService } from '../../../src/modules/customs/application/services/customsAccountingService';

describe('CustomsAccountingService (PCGE 2019 & NIC 2)', () => {
  let service: CustomsAccountingService;
  let mockPrisma: any;
  let mockAccounting: any;

  beforeEach(() => {
    mockPrisma = {
      accountingRule: {
        findMany: jest.fn().mockResolvedValue([]),
        upsert: jest.fn().mockResolvedValue({}),
      },
      customsShipment: {
        findFirst: jest.fn(),
      },
      accountingEntry: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    };

    mockAccounting = {
      execute: jest.fn().mockResolvedValue({ id: 'entry-123' }),
    };

    service = new CustomsAccountingService(mockPrisma, mockAccounting);
  });

  it('debe retornar las reglas de mapeo por defecto cuando no hay personalizaciones', async () => {
    const rules = await service.getMappingRules('company-1');
    expect(rules.length).toBeGreaterThan(10);
    const fobRule = rules.find((r) => r.roleCode === 'FOB_EXTERIOR');
    expect(fobRule?.accountCode).toBe('6011');
    const almacenRule = rules.find((r) => r.roleCode === 'ALMACEN_FINAL');
    expect(almacenRule?.accountCode).toBe('20111');
  });

  it('debe generar y cuadrar matemáticamente los 6 asientos contables oficiales de una importación', async () => {
    mockPrisma.customsShipment.findFirst.mockResolvedValue({
      id: 'ship-1',
      shipment_number: 'EXP-2026-0001',
      supplier: { business_name: 'SHENZHEN TECH CO.' },
      declarations: [
        {
          dua_number: '118-2026-10-001234',
          exchange_rate: 3.75,
          fob_value_usd: 20000,
          freight_value_usd: 1000,
          insurance_value_usd: 500,
          cif_value_pen: 80625,
          ad_valorem_amount_pen: 4837.5,
          igv_ipm_amount_pen: 15383.25,
          perception_amount_pen: 3529.6,
          settlements: [{ cda_number: 'CDA-118261001234' }],
        },
      ],
      local_expenses: [
        { net_amount_pen: 500, expense_concept: 'AGENCIA' },
      ],
      landed_cost_sheet: {
        total_inventory_cost_pen: 85962.5,
      },
    });

    const summary = await service.getAccountingSummary('company-1', 'ship-1');

    expect(summary.shipmentNumber).toBe('EXP-2026-0001');
    expect(summary.entriesCount).toBe(6);
    expect(summary.isAuditBalanced).toBe(true);
    expect(summary.auditDifferencePen).toBe(0);

    // Verificar cuadre de cada uno de los 6 asientos
    for (const entry of summary.entries) {
      expect(entry.isBalanced).toBe(true);
      expect(entry.totalDebit).toBe(entry.totalCredit);
      expect(entry.lines.length).toBeGreaterThanOrEqual(2);
    }

    // Asiento 1: Compra FOB
    expect(summary.entries[0].entryCode).toBe('ASIENTO-01');
    expect(summary.entries[0].lines[0].accountCode).toBe('6011');

    // Asiento 6: Ingreso a Almacén
    expect(summary.entries[5].entryCode).toBe('ASIENTO-06');
    expect(summary.entries[5].lines[0].accountCode).toBe('20111');
    expect(summary.entries[5].lines[1].accountCode).toBe('2811');
  });

  it('debe sincronizar los asientos en el Libro Diario general de la empresa', async () => {
    mockPrisma.customsShipment.findFirst.mockResolvedValue({
      id: 'ship-1',
      shipment_number: 'EXP-2026-0001',
      supplier: { business_name: 'TEST SUPPLIER' },
      declarations: [],
      local_expenses: [],
    });

    const result = await service.syncToGeneralLedger('company-1', 'ship-1');
    expect(result.createdCount).toBe(6);
    expect(mockAccounting.execute).toHaveBeenCalledTimes(6);
  });
});
