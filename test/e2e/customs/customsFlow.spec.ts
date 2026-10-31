import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../../../src/appModule';
import { PrismaService } from '../../../src/database/prismaService';
import { QueueService } from '../../../src/modules/resilience/infrastructure/queue/queue.service';
import {
  CUSTOMS_SHIPMENT_REPOSITORY_PORT,
  type ICustomsShipmentRepositoryPort,
} from '../../../src/modules/customs/domain/ports/customsShipmentRepositoryPort';
import {
  TOKEN_SERVICE_PORT,
  type TokenServicePort,
} from '../../../src/modules/auth/domain/ports/tokenServicePort';
import {
  CUSTOMS_SETTLEMENT_REPOSITORY_PORT,
  type ICustomsSettlementRepositoryPort,
} from '../../../src/modules/customs/domain/ports/customsSettlementRepositoryPort';
import {
  LANDED_COST_REPOSITORY_PORT,
  type ILandedCostRepositoryPort,
} from '../../../src/modules/customs/domain/ports/landedCostRepositoryPort';
import {
  CUSTOMS_REPOSITORY_PORT,
  type ICustomsRepositoryPort,
  type KardexMovementRecord,
} from '../../../src/modules/customs/domain/ports/customsRepositoryPort';
import { ShipmentStatus } from '../../../src/modules/customs/domain/enums/shipmentStatus.enum';
import { SettlementStatus } from '../../../src/modules/customs/domain/enums/settlementStatus.enum';
import { LandedCostStatus } from '../../../src/modules/customs/domain/enums/landedCostStatus.enum';
import { CustomsDeclarationEntity } from '../../../src/modules/customs/domain/entities/customsDeclarationEntity';

describe('Customs & Landed Cost Suite (E2E) - Caso 100 Laptops de Juan', () => {
  let app: INestApplication<App>;
  let accessToken: string;
  const companyId = 'company-juan-peru-2026';

  // Base de datos en memoria para aislar la prueba E2E
  const shipments = new Map<string, any>();
  const declarations = new Map<string, any>();
  const settlements = new Map<string, any>();
  const events = new Map<string, any[]>();
  const documents = new Map<string, any[]>();
  const localExpenses = new Map<string, any[]>();
  const landedCostSheets = new Map<string, any>();
  const kardexMovements = new Map<string, KardexMovementRecord[]>();

  const inMemoryShipmentRepo: ICustomsShipmentRepositoryPort = {
    async createShipment(data) {
      const id = `ship-${Date.now()}`;
      const record = {
        id,
        company_id: data.companyId,
        shipment_number: data.shipmentNumber,
        incoterm: data.incoterm ?? 'FOB',
        currency_code: data.currencyCode ?? 'USD',
        transport_mode: data.transportMode ?? 'MARITIMO',
        origin_country_code: data.originCountryCode ?? 'CN',
        destination_customs: data.destinationCustoms ?? '118',
        status: ShipmentStatus.BORRADOR,
        created_at: new Date(),
        updated_at: new Date(),
      };
      shipments.set(id, record);
      events.set(id, []);
      documents.set(id, []);
      localExpenses.set(id, []);
      return record;
    },

    async updateShipmentStatus(id, targetCompanyId, status) {
      const record = shipments.get(id);
      if (record) {
        record.status = status;
        record.updated_at = new Date();
      }
      return record;
    },

    async findShipmentById(id, targetCompanyId) {
      const record = shipments.get(id);
      if (!record || record.company_id !== targetCompanyId) return null;

      const decls = Array.from(declarations.values()).filter((d) => d.shipment_id === id);
      return {
        ...record,
        declarations: decls,
        events: events.get(id) || [],
        documents: documents.get(id) || [],
        local_expenses: localExpenses.get(id) || [],
        landed_cost_sheet: landedCostSheets.get(id) || null,
      };
    },

    async findShipmentByNumber(shipmentNumber, targetCompanyId) {
      for (const record of shipments.values()) {
        if (record.shipment_number === shipmentNumber && record.company_id === targetCompanyId) {
          return record;
        }
      }
      return null;
    },

    async listShipments(options) {
      let list = Array.from(shipments.values()).filter(
        (s) => s.company_id === options.companyId,
      );
      if (options.status) {
        list = list.filter((s) => s.status === options.status);
      }
      return { data: list, total: list.length };
    },

    async addDocument(data) {
      const doc = {
        id: `doc-${Date.now()}-${Math.random().toString(36).substring(7)}`,
        shipment_id: data.shipmentId,
        document_type: data.documentType,
        document_number: data.documentNumber,
        issue_date: data.issueDate,
        issuer_name: data.issuerName,
        storage_url: data.storageUrl,
        vuce_dr_number: data.vuceDrNumber,
        ...data,
        created_at: new Date(),
      };
      const list = documents.get(data.shipmentId) || [];
      list.push(doc);
      documents.set(data.shipmentId, list);
      return doc;
    },

    async addEvent(data) {
      const evt = {
        id: `evt-${Date.now()}-${Math.random().toString(36).substring(7)}`,
        shipment_id: data.shipmentId,
        event_type: data.eventType,
        event_timestamp: data.eventTimestamp,
        event_value: data.eventValue,
        reference_code: data.referenceCode,
        registered_by: data.registeredBy,
        ...data,
        created_at: new Date(),
      };
      const list = events.get(data.shipmentId) || [];
      list.push(evt);
      events.set(data.shipmentId, list);
      return evt;
    },

    async getShipmentEvents(shipmentId) {
      return events.get(shipmentId) || [];
    },

    async getShipmentDocuments(shipmentId) {
      return documents.get(shipmentId) || [];
    },
  };

  const inMemoryCustomsRepo: ICustomsRepositoryPort = {
    async saveDeclarationWithItemsAndKardex(declaration, items, _kardex) {
      const id = `decl-${Date.now()}`;
      const savedItems = items.map((it, idx) => ({
        id: `item-${Date.now()}-${idx}`,
        declaration_id: id,
        item_order: it.itemOrder,
        product_code: it.productCode,
        hs_code: it.hsCode,
        commercial_description: it.commercialDescription,
        quantity: it.quantity,
        unit_code: it.unitCode,
        fob_unit_usd: it.fobUnitUsd,
        fob_total_usd: it.fobTotalUsd,
        allocated_cif_pen: it.allocatedCifPen,
        allocated_duties_pen: it.allocatedDutiesPen,
        allocated_local_cost_pen: 0,
        landed_cost_unit_pen: it.landedCostUnitPen,
        final_landed_cost_unit_pen: it.finalLandedCostUnitPen,
      }));

      const record = {
        id,
        company_id: declaration.companyId,
        shipment_id: declaration.shipmentId,
        dua_number: declaration.duaNumber,
        customs_agency_code: declaration.customsAgencyCode,
        regime_code: declaration.regimeCode,
        numeration_date: declaration.numerationDate,
        fob_value_usd: declaration.fobValueUsd,
        freight_value_usd: declaration.freightValueUsd,
        insurance_value_usd: declaration.insuranceValueUsd,
        cif_value_usd: declaration.cifValueUsd,
        exchange_rate: declaration.exchangeRate,
        cif_value_pen: declaration.cifValuePen,
        ad_valorem_rate: declaration.adValoremRate,
        ad_valorem_amount_pen: declaration.adValoremAmountPen,
        igv_rate: declaration.igvRate,
        ipm_rate: declaration.ipmRate,
        igv_ipm_amount_pen: declaration.igvIpmAmountPen,
        perception_rate: declaration.perceptionRate,
        perception_amount_pen: declaration.perceptionAmountPen,
        total_customs_taxes_pen: declaration.totalCustomsTaxesPen,
        status: declaration.status,
        channel: declaration.channel,
        items: savedItems,
        created_at: new Date(),
        updated_at: new Date(),
      };

      declarations.set(id, record);

      return new CustomsDeclarationEntity({
        ...declaration.toPrimitives(),
        id,
        items: savedItems as any,
      });
    },

    async findDeclarationById(id, targetCompanyId) {
      const d = declarations.get(id);
      if (!d || d.company_id !== targetCompanyId) return null;
      return new CustomsDeclarationEntity({ ...d });
    },

    async findDeclarationsByCompany(targetCompanyId) {
      return Array.from(declarations.values())
        .filter((d) => d.company_id === targetCompanyId)
        .map((d) => ({
          id: d.id,
          duaNumber: d.dua_number,
          customsAgencyCode: d.customs_agency_code,
          numerationDate: d.numeration_date,
          cifValueUsd: d.cif_value_usd,
          cifValuePen: d.cif_value_pen,
          totalCustomsTaxesPen: d.total_customs_taxes_pen,
          status: d.status,
          itemsCount: d.items?.length || 0,
          createdAt: d.created_at,
        }));
    },

    async findKardexMovementsByCompany(targetCompanyId) {
      const all: KardexMovementRecord[] = [];
      for (const list of kardexMovements.values()) {
        for (const mov of list) {
          if (mov.companyId === targetCompanyId) all.push(mov);
        }
      }
      return all;
    },

    async findLatestKardexMovementByItem(targetCompanyId, itemCode) {
      const list = kardexMovements.get(`${targetCompanyId}-${itemCode}`) || [];
      return list.length > 0 ? list[list.length - 1] : null;
    },

    async registerKardexMovements(movements, declarationId) {
      for (const mov of movements) {
        const key = `${mov.companyId}-${mov.itemCode}`;
        const list = kardexMovements.get(key) || [];
        list.push(mov);
        kardexMovements.set(key, list);
      }
      if (declarationId) {
        const d = declarations.get(declarationId);
        if (d) d.status = 'APLICADO_KARDEX';
      }
    },
  };

  const inMemorySettlementRepo: ICustomsSettlementRepositoryPort = {
    async createSettlements(dataList) {
      const created: any[] = [];
      for (const s of dataList) {
        const id = `sett-${Date.now()}-${Math.random().toString(36).substring(7)}`;
        const decl = declarations.get(s.declarationId);
        const record = {
          id,
          declaration_id: s.declarationId,
          settlement_type: s.settlementType,
          settlement_number: s.settlementNumber,
          tax_code: s.taxCode,
          amount_usd: s.amountUsd ?? 0.0,
          amount_pen: s.amountPen,
          cda_number: s.cdaNumber,
          due_date: s.dueDate,
          status: SettlementStatus.GENERADA,
          declaration: decl,
        };
        settlements.set(id, record);
        created.push(record);
      }
      return created;
    },

    async findSettlementById(id) {
      return settlements.get(id) || null;
    },

    async findSettlementsByDeclarationId(declarationId) {
      return Array.from(settlements.values()).filter((s) => s.declaration_id === declarationId);
    },

    async findPendingSettlementsByCompany(targetCompanyId) {
      return Array.from(settlements.values()).filter(
        (s) => s.declaration?.company_id === targetCompanyId && s.status === SettlementStatus.GENERADA,
      );
    },

    async registerSettlementPayment(data) {
      const record = settlements.get(data.settlementId);
      if (record) {
        record.status = SettlementStatus.PAGADA;
        record.bank_code = data.bankCode;
        record.bank_operation_number = data.bankOperationNumber;
        record.paid_at = data.paidAt;
        record.voucher_storage_url = data.voucherStorageUrl;
      }
      return record;
    },
  };

  const inMemoryLandedCostRepo: ILandedCostRepositoryPort = {
    async addLocalExpense(data) {
      const id = `exp-${Date.now()}-${Math.random().toString(36).substring(7)}`;
      const record = {
        id,
        shipment_id: data.shipmentId,
        supplier_ruc: data.supplierRuc,
        supplier_name: data.supplierName,
        expense_concept: data.expenseConcept,
        invoice_serial_number: data.invoiceSerialNumber,
        issue_date: data.issueDate,
        net_amount_pen: data.netAmountPen,
        igv_amount_pen: data.igvAmountPen,
        total_amount_pen: data.totalAmountPen,
        spot_detraction_rate: data.spotDetractionRate ?? 0.0,
        is_capitalizable: data.isCapitalizable ?? true,
        proration_method: data.prorationMethod ?? 'VALOR_FOB',
        ...data,
      };
      const list = localExpenses.get(data.shipmentId) || [];
      list.push(record);
      localExpenses.set(data.shipmentId, list);
      return record;
    },

    async findLocalExpensesByShipmentId(shipmentId) {
      return localExpenses.get(shipmentId) || [];
    },

    async deleteLocalExpense(expenseId) {
      for (const [shipmentId, list] of localExpenses.entries()) {
        const filtered = list.filter((e) => e.id !== expenseId);
        localExpenses.set(shipmentId, filtered);
      }
    },

    async saveLandedCostSheet(data) {
      const id = `sheet-${Date.now()}`;
      const record = { id, ...data, status: data.status ?? LandedCostStatus.DEFINITIVO };
      landedCostSheets.set(data.shipmentId, record);

      // Actualizar los ítems de las declaraciones del embarque
      const decls = Array.from(declarations.values()).filter((d) => d.shipment_id === data.shipmentId);
      for (const decl of decls) {
        for (const item of decl.items) {
          const proration = data.itemsProration.find((p) => p.itemId === item.id);
          if (proration) {
            item.allocated_local_cost_pen = proration.allocatedLocalCostPen;
            item.final_landed_cost_unit_pen = proration.finalLandedCostUnitPen;
          }
        }
      }

      // Actualizar estado del expediente a COSTEADO
      const ship = shipments.get(data.shipmentId);
      if (ship) ship.status = ShipmentStatus.COSTEADO;

      return record;
    },

    async findLandedCostSheetByShipmentId(shipmentId) {
      return landedCostSheets.get(shipmentId) || null;
    },
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue({
        $connect: jest.fn(),
        $disconnect: jest.fn(),
        $transaction: jest.fn(),
      })
      .overrideProvider(QueueService)
      .useValue({
        enqueueInvoiceInTx: jest.fn(),
      })
      .overrideProvider(CUSTOMS_SHIPMENT_REPOSITORY_PORT)
      .useValue(inMemoryShipmentRepo)
      .overrideProvider(CUSTOMS_REPOSITORY_PORT)
      .useValue(inMemoryCustomsRepo)
      .overrideProvider(CUSTOMS_SETTLEMENT_REPOSITORY_PORT)
      .useValue(inMemorySettlementRepo)
      .overrideProvider(LANDED_COST_REPOSITORY_PORT)
      .useValue(inMemoryLandedCostRepo)
      .compile();

    const tokenService = moduleFixture.get<TokenServicePort>(TOKEN_SERVICE_PORT);

    accessToken = tokenService.signToken({
      sub: 'user-juan-admin',
      email: 'juan@perugamer.pe',
      companyId,
      role: 'ADMIN',
    });

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('Flujo Integral E2E: Ciclo de Vida Aduanero, Liquidación SUNAT con CDA, Prorrateo NIC 2 y Kardex', async () => {
    // -------------------------------------------------------------------------
    // PASO 1: Apertura de Expediente Comercial Internacional
    // -------------------------------------------------------------------------
    const createShipmentRes = await request(app.getHttpServer())
      .post('/api/v1/customs/shipments')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        shipment_number: 'EXP-2026-00042',
        incoterm: 'FOB',
        currency_code: 'USD',
        transport_mode: 'MARITIMO',
        origin_country_code: 'CN',
        destination_customs: '118',
      })
      .expect(201);

    expect(createShipmentRes.body.shipment_number).toBe('EXP-2026-00042');
    expect(createShipmentRes.body.status).toBe(ShipmentStatus.BORRADOR);
    const shipmentId = createShipmentRes.body.id;

    // -------------------------------------------------------------------------
    // PASO 2: Registro de DAM con Asistente (Cálculo CIF, TPPS supletorio y Liquidaciones CDA)
    // -------------------------------------------------------------------------
    const registerDuaRes = await request(app.getHttpServer())
      .post('/api/v1/customs/declarations/wizard')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        shipment_id: shipmentId,
        dua_number: '118-2026-10-004200',
        customs_agency_code: '118',
        regime_code: '10',
        dispatch_mode: '10',
        channel: 'VERDE',
        numeration_date: '2026-03-20T10:00:00.000Z',
        fob_value_usd: 50000.0,
        freight_value_usd: 3000.0,
        insurance_value_usd: 0, // Seguro supletorio TPPS
        exchange_rate: 3.82,
        ad_valorem_rate: 0.0, // Laptops: 0% Ad-Valorem
        perception_rate: 3.5, // Importador activo y habido
        items: [
          {
            item_order: 1,
            hs_code: '8471300000',
            commercial_description: 'LAPTOPS GAMER ASUS ROG STRIX 16',
            quantity: 100,
            unit_code: 'NIU',
            net_weight_kg: 260.0,
            gross_weight_kg: 290.0,
            fob_unit_usd: 500.0,
          },
        ],
      })
      .expect(201);

    const { taxBreakdown, settlements: generatedSettlements } = registerDuaRes.body;
    expect(taxBreakdown.isInsuranceTppsApplied).toBe(true);
    expect(taxBreakdown.tppsInsuranceRateUsed).toBe(0.75); // Tasa TPPS para capítulo 84
    expect(taxBreakdown.cifUsd).toBe(53375.0); // 50,000 + 3,000 + (50,000 * 0.75% = 375)
    expect(taxBreakdown.cifPen).toBe(203892.5); // 53,375 * 3.82

    // Verificación de liquidaciones con CDA emitidas
    expect(generatedSettlements).toHaveLength(2);
    const cuota0010 = generatedSettlements.find((s: any) => s.tax_code === '0010');
    const cuota0026 = generatedSettlements.find((s: any) => s.tax_code === '0026');
    expect(cuota0010).toBeDefined();
    expect(cuota0010.cda_number).toHaveLength(14);
    expect(cuota0026).toBeDefined();
    expect(cuota0026.cda_number).toHaveLength(14);

    // -------------------------------------------------------------------------
    // PASO 3: Pago Bancario vía Teledespacho y Autorización de Levante (Canal Verde)
    // -------------------------------------------------------------------------
    await request(app.getHttpServer())
      .post(`/api/v1/customs/settlements/${cuota0010.id}/pay`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        bank_code: '002', // BCP
        bank_operation_number: 'OP-BCP-991122',
        paid_at: '2026-03-21T09:30:00.000Z',
      })
      .expect(200);

    const payCuota26Res = await request(app.getHttpServer())
      .post(`/api/v1/customs/settlements/${cuota0026.id}/pay`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        bank_code: '002',
        bank_operation_number: 'OP-BCP-991123',
        paid_at: '2026-03-21T09:35:00.000Z',
      })
      .expect(200);

    expect(payCuota26Res.body.status).toBe(SettlementStatus.PAGADA);

    // -------------------------------------------------------------------------
    // PASO 4: Registro de Facturas de Gastos Locales de Desaduanaje (NIC 2)
    // -------------------------------------------------------------------------
    // Gasto 1: Almacén Portuario (APM Terminals)
    await request(app.getHttpServer())
      .post('/api/v1/customs/landed-cost/expenses')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        shipment_id: shipmentId,
        supplier_ruc: '20100047218',
        supplier_name: 'APM TERMINALS CALLAO S.A.',
        expense_concept: 'ALMACENAJE_PORTUARIO',
        invoice_serial_number: 'F001-00045612',
        issue_date: '2026-03-22T00:00:00.000Z',
        net_amount_pen: 2500.0,
        igv_amount_pen: 450.0,
        total_amount_pen: 2950.0,
        is_capitalizable: true,
        proration_method: 'VALOR_FOB',
      })
      .expect(201);

    // Gasto 2: Agente de Aduanas
    await request(app.getHttpServer())
      .post('/api/v1/customs/landed-cost/expenses')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        shipment_id: shipmentId,
        supplier_ruc: '20509988112',
        supplier_name: 'AGENCIA DE ADUANA LOGISTICA GLOBAL S.A.C.',
        expense_concept: 'AGENTE_ADUANAS',
        invoice_serial_number: 'E001-00018899',
        issue_date: '2026-03-22T00:00:00.000Z',
        net_amount_pen: 1500.0,
        igv_amount_pen: 270.0,
        total_amount_pen: 1770.0,
        is_capitalizable: true,
        proration_method: 'VALOR_FOB',
      })
      .expect(201);

    // -------------------------------------------------------------------------
    // PASO 5: Cálculo y Prorrateo de Landed Cost (Aislamiento de Créditos Fiscales)
    // -------------------------------------------------------------------------
    const calculateLandedRes = await request(app.getHttpServer())
      .post('/api/v1/customs/landed-cost/calculate')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        shipment_id: shipmentId,
        approved_by_accountant: true,
      })
      .expect(200);

    const { proration } = calculateLandedRes.body;
    // Solo gastos netos: 2500 + 1500 = 4000 (el IGV de S/ 720 queda aislado)
    expect(proration.totalLocalExpensesPen).toBe(4000.0);
    // Total inventario: CIF (203,892.50) + Gastos Locales (4,000.00) = 207,892.50
    expect(proration.totalInventoryCostPen).toBe(207892.5);
    // Costo Unitario Nacionalizado exacto: 207,892.50 / 100 = S/ 2,078.925
    expect(proration.items[0].unitLandedCostPen).toBe(2078.925);

    // -------------------------------------------------------------------------
    // PASO 6: Verificación y Auditoría de Hoja de Liquidación de Costo (NIC 2)
    // -------------------------------------------------------------------------
    const getSheetRes = await request(app.getHttpServer())
      .get(`/api/v1/customs/landed-cost/sheet/${shipmentId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(getSheetRes.body).toBeDefined();
    expect(getSheetRes.body.shipmentId).toBe(shipmentId);
    expect(getSheetRes.body.totalInventoryCostPen).toBe(207892.5);
    expect(getSheetRes.body.itemsProration).toHaveLength(1);
    expect(getSheetRes.body.itemsProration[0].finalLandedCostUnitPen).toBe(2078.925);

    // -------------------------------------------------------------------------
    // PASO 7: Consulta y Auditoría del Expediente Consolidado 360°
    // -------------------------------------------------------------------------
    const getShipmentRes = await request(app.getHttpServer())
      .get(`/api/v1/customs/shipments/${shipmentId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(getShipmentRes.body.status).toBe(ShipmentStatus.COSTEADO);
    expect(getShipmentRes.body.declarations).toHaveLength(1);
    expect(getShipmentRes.body.local_expenses).toHaveLength(2);
    expect(getShipmentRes.body.landed_cost_sheet).toBeDefined();

    // Validar bitácora cronológica completa
    const eventTypes = getShipmentRes.body.events.map((e: any) => e.event_type ?? e.eventType);
    expect(eventTypes).toContain('CREACION_EXPEDIENTE');
    expect(eventTypes).toContain('NUMERACION');
    expect(eventTypes).toContain('PAGO_TRIBUTOS');
    expect(eventTypes).toContain('GASTO_LOCAL');
    expect(eventTypes).toContain('COSTEO_LANDED_COST');
  });
});
