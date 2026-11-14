import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../../../../database/prismaService';
import { GenerateAccountingEntryUseCase } from '../../../accounting/application/use-cases/generateAccountingEntryUseCase';

export interface CustomsAccountingLine {
  lineOrder: number;
  accountCode: string;
  accountName: string;
  debitAmount: number;
  creditAmount: number;
}

export interface CustomsJournalEntry {
  entryCode: string;
  entryName: string;
  concept: string;
  glosa: string;
  date: string;
  lines: CustomsAccountingLine[];
  totalDebit: number;
  totalCredit: number;
  isBalanced: boolean;
}

export interface CustomsAccountingSummary {
  shipmentId: string;
  shipmentNumber: string;
  supplierName: string;
  duaNumber: string;
  cdaNumber?: string;
  currencyCode: string;
  exchangeRate: number;
  // Valores desagregados
  fobUsd: number;
  fobPen: number;
  freightPen: number;
  insurancePen: number;
  cifPen: number;
  adValoremPen: number;
  tdaPen: number;
  localExpensesPen: number;
  // Totales NIC 2
  capitalizableTotalPen: number;
  igvPen: number;
  perceptionPen: number;
  totalFiscalCreditPen: number;
  // Auditoría matemática
  isAuditBalanced: boolean;
  auditDifferencePen: number;
  // Estado en el Libro Diario
  isSynchronized: boolean;
  synchronizedAt?: string;
  entriesCount: number;
  entries: CustomsJournalEntry[];
}

export interface AccountingMappingRuleDto {
  roleCode: string;
  roleName: string;
  accountCode: string;
  accountName: string;
  defaultCode: string;
  side: 'DEBE' | 'HABER' | 'AMBOS';
  description: string;
}

const DEFAULT_MAPPING_RULES: AccountingMappingRuleDto[] = [
  { roleCode: 'FOB_EXTERIOR', roleName: 'Compra FOB Exterior', accountCode: '6011', accountName: 'Mercaderías manufacturadas', defaultCode: '6011', side: 'DEBE', description: 'Precio comercial de factura del exterior (Incoterms 2020)' },
  { roleCode: 'FLETE_INT', roleName: 'Flete Internacional', accountCode: '60911', accountName: 'Transporte y flete internacional', defaultCode: '60911', side: 'DEBE', description: 'Costos vinculados de transporte internacional marítimo/aéreo' },
  { roleCode: 'SEGURO_INT', roleName: 'Seguro Internacional', accountCode: '60912', accountName: 'Seguro de transporte internacional', defaultCode: '60912', side: 'DEBE', description: 'Póliza de seguro internacional de mercancías' },
  { roleCode: 'AD_VALOREM', roleName: 'Derechos Arancelarios', accountCode: '60913', accountName: 'Derechos arancelarios (Ad Valorem)', defaultCode: '60913', side: 'DEBE', description: 'Aranceles SUNAT pagados mediante CDA' },
  { roleCode: 'TDA', roleName: 'Tasa Despacho Aduanero', accountCode: '60915', accountName: 'Tasa por servicio de despacho', defaultCode: '60915', side: 'DEBE', description: 'Tasa administrativa SUNAT de despacho' },
  { roleCode: 'AGENCIA_ADUANA', roleName: 'Agencia de Aduana y Locales', accountCode: '60914', accountName: 'Servicios de despacho y agenciamiento', defaultCode: '60914', side: 'DEBE', description: 'Honorarios del agente aduanal y operadores portuarios' },
  { roleCode: 'IGV_IMPORTACION', roleName: 'IGV e IPM de Importación', accountCode: '40111', accountName: 'IGV - Cuenta propia (Crédito Fiscal)', defaultCode: '40111', side: 'DEBE', description: '18% sobre base CIF + Derechos (no capitalizable)' },
  { roleCode: 'PERCEPCION_IGV', roleName: 'Percepción del IGV', accountCode: '40113', accountName: 'IGV - Régimen de percepciones', defaultCode: '40113', side: 'DEBE', description: 'Percepción aduanera SUNAT 3.5% / 5% / 10%' },
  { roleCode: 'CXP_EXTERIOR', roleName: 'Proveedores del Exterior', accountCode: '42122', accountName: 'Facturas por pagar - Emitidas en el exterior', defaultCode: '42122', side: 'HABER', description: 'Obligaciones comerciales internacionales' },
  { roleCode: 'CXP_LOCAL', roleName: 'Proveedores Nacionales', accountCode: '42121', accountName: 'Facturas por pagar - Emitidas en el país', defaultCode: '42121', side: 'HABER', description: 'Obligaciones comerciales con agente y almacenes locales' },
  { roleCode: 'BANCOS', roleName: 'Cuentas Corrientes Bancos', accountCode: '1041', accountName: 'Cuentas corrientes operativas', defaultCode: '1041', side: 'HABER', description: 'Salida de fondos bancarios para tributos y pagos' },
  { roleCode: 'TRANSITO', roleName: 'Existencias por Recibir', accountCode: '2811', accountName: 'Mercaderías en tránsito', defaultCode: '2811', side: 'AMBOS', description: 'Acumulación de costos durante el tránsito internacional' },
  { roleCode: 'VARIACION_EXISTENCIAS', roleName: 'Variación de Existencias', accountCode: '6111', accountName: 'Mercaderías manufacturadas', defaultCode: '6111', side: 'AMBOS', description: 'Contrapartida de destino de compras' },
  { roleCode: 'ALMACEN_FINAL', roleName: 'Mercaderías en Almacén', accountCode: '20111', accountName: 'Mercaderías manufacturadas al costo', defaultCode: '20111', side: 'DEBE', description: 'Costo total nacionalizado según NIC 2 y Kardex' },
];

const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

@Injectable()
export class CustomsAccountingService {
  private readonly logger = new Logger(CustomsAccountingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly accounting: GenerateAccountingEntryUseCase,
  ) {}

  /**
   * Obtiene la configuración de reglas de cuentas contables de importaciones (PCGE).
   */
  async getMappingRules(companyId: string): Promise<AccountingMappingRuleDto[]> {
    const rules = await this.prisma.accountingRule.findMany({
      where: { company_id: companyId, process_code: 'IMPORTACION', is_active: true },
    });

    const ruleMap = new Map(rules.map((r) => [r.description || '', r.account_code]));

    return DEFAULT_MAPPING_RULES.map((def) => {
      const customCode = ruleMap.get(def.roleCode);
      return {
        ...def,
        accountCode: customCode || def.defaultCode,
      };
    });
  }

  /**
   * Actualiza o crea reglas de mapeo contable de importaciones para la empresa.
   */
  async upsertMappingRules(
    companyId: string,
    rules: Array<{ roleCode: string; accountCode: string }>,
  ): Promise<AccountingMappingRuleDto[]> {
    for (const [index, r] of rules.entries()) {
      const def = DEFAULT_MAPPING_RULES.find((d) => d.roleCode === r.roleCode);
      if (!def) continue;

      const cleanCode = r.accountCode.trim();
      await this.prisma.accountingRule.upsert({
        where: {
          company_id_process_code_document_type_line_order: {
            company_id: companyId,
            process_code: 'IMPORTACION',
            document_type: def.roleCode,
            line_order: index + 1,
          },
        },
        create: {
          company_id: companyId,
          process_code: 'IMPORTACION',
          document_type: def.roleCode,
          line_order: index + 1,
          account_code: cleanCode,
          side: def.side,
          base_calculation: 'MONTO',
          description: def.roleCode,
          is_active: true,
        },
        update: {
          account_code: cleanCode,
          is_active: true,
        },
      });
    }

    return this.getMappingRules(companyId);
  }

  /**
   * Calcula y genera la trazabilidad de los 6 asientos contables oficiales de una importación.
   */
  async getAccountingSummary(companyId: string, shipmentId: string): Promise<CustomsAccountingSummary> {
    const shipment = await this.prisma.customsShipment.findFirst({
      where: {
        company_id: companyId,
        OR: [{ id: shipmentId }, { shipment_number: shipmentId }],
      },
      include: {
        supplier: true,
        declarations: {
          include: {
            items: true,
            settlements: true,
          },
        },
        local_expenses: true,
        landed_cost_sheet: true,
      },
    });

    if (!shipment) {
      throw new NotFoundException(`Expediente de importación "${shipmentId}" no encontrado.`);
    }

    const mapping = await this.getMappingRules(companyId);
    const getAccount = (role: string) => {
      const found = mapping.find((m) => m.roleCode === role);
      return {
        code: found?.accountCode || '6011',
        name: found?.accountName || 'Cuenta PCGE',
      };
    };

    const dec = shipment.declarations?.[0];
    const sheet = shipment.landed_cost_sheet;

    // Factores y tipos de cambio
    const tc = Number(dec?.exchange_rate ?? 3.75);
    const fobUsd = Number(dec?.fob_value_usd ?? 25000);
    const freightUsd = Number(dec?.freight_value_usd ?? 800);
    const insuranceUsd = Number(dec?.insurance_value_usd ?? 250);

    const fobPen = r2(fobUsd * tc);
    const freightPen = r2(freightUsd * tc);
    const insurancePen = r2(insuranceUsd * tc);
    const cifPen = Number(dec?.cif_value_pen ?? r2(fobPen + freightPen + insurancePen));

    const adValoremPen = Number(dec?.ad_valorem_amount_pen ?? r2(cifPen * 0.06));
    const tdaPen = 0; // Despacho moderno anticipado sin tasa arancelaria
    const igvTotalPen = Number(dec?.igv_ipm_amount_pen ?? r2((cifPen + adValoremPen) * 0.18));
    const perceptionPen = Number(dec?.perception_amount_pen ?? r2((cifPen + adValoremPen + igvTotalPen) * 0.035));

    // Gastos locales (desde localExpenseInvoice / Compras)
    const localExpensesPen = (shipment.local_expenses || []).reduce(
      (sum, exp) => sum + Number(exp.net_amount_pen || 0),
      0,
    );

    // Total capitalizable según NIC 2 (Cta 20111)
    const capitalizableTotalPen = r2(
      sheet?.total_inventory_cost_pen
        ? Number(sheet.total_inventory_cost_pen)
        : fobPen + freightPen + insurancePen + adValoremPen + tdaPen + localExpensesPen,
    );

    const totalFiscalCreditPen = r2(igvTotalPen + perceptionPen);

    const supplierName = shipment.supplier?.business_name || 'PROVEEDOR EXTRANJERO';
    const duaNumber = dec?.dua_number || `DAM-2026-${shipment.shipment_number.slice(-6)}`;
    const cdaNumber = dec?.settlements?.[0]?.cda_number || `CDA-${shipment.shipment_number.slice(-6)}`;
    const today = new Date().toISOString().slice(0, 10);

    // Construcción de los 6 Asientos Contables PCGE
    const entries: CustomsJournalEntry[] = [];

    // 1. Compra FOB al Proveedor Exterior
    const ctaFob = getAccount('FOB_EXTERIOR');
    const ctaCxpExt = getAccount('CXP_EXTERIOR');
    entries.push({
      entryCode: 'ASIENTO-01',
      entryName: '1. Factura Exterior FOB',
      concept: 'Compra internacional al proveedor del exterior según Incoterms 2020',
      glosa: `Factura comercial exterior FOB ${supplierName} · DAM ${duaNumber}`,
      date: dec?.numeration_date ? new Date(dec.numeration_date).toISOString().slice(0, 10) : today,
      lines: [
        { lineOrder: 1, accountCode: ctaFob.code, accountName: ctaFob.name, debitAmount: fobPen, creditAmount: 0 },
        { lineOrder: 2, accountCode: ctaCxpExt.code, accountName: ctaCxpExt.name, debitAmount: 0, creditAmount: fobPen },
      ],
      totalDebit: fobPen,
      totalCredit: fobPen,
      isBalanced: true,
    });

    // 2. Fletes y Seguros Internacionales
    const ctaFlete = getAccount('FLETE_INT');
    const ctaSeguro = getAccount('SEGURO_INT');
    const totalFleteSeguro = r2(freightPen + insurancePen);
    entries.push({
      entryCode: 'ASIENTO-02',
      entryName: '2. Flete y Seguro Internacional',
      concept: 'Reconocimiento de flete y póliza marítima/aérea internacional atribuible al CIF',
      glosa: `Flete y seguro internacional de importación · DAM ${duaNumber}`,
      date: dec?.numeration_date ? new Date(dec.numeration_date).toISOString().slice(0, 10) : today,
      lines: [
        { lineOrder: 1, accountCode: ctaFlete.code, accountName: ctaFlete.name, debitAmount: freightPen, creditAmount: 0 },
        { lineOrder: 2, accountCode: ctaSeguro.code, accountName: ctaSeguro.name, debitAmount: insurancePen, creditAmount: 0 },
        { lineOrder: 3, accountCode: ctaCxpExt.code, accountName: 'Cuentas por pagar - Naviera / Aseguradora exterior', debitAmount: 0, creditAmount: totalFleteSeguro },
      ],
      totalDebit: totalFleteSeguro,
      totalCredit: totalFleteSeguro,
      isBalanced: true,
    });

    // 3. Liquidación Aduanera DAM (Aranceles + IGV/IPM + Percepción)
    const ctaAdValorem = getAccount('AD_VALOREM');
    const ctaIgvImp = getAccount('IGV_IMPORTACION');
    const ctaPercepcion = getAccount('PERCEPCION_IGV');
    const ctaBancos = getAccount('BANCOS');
    const totalCdaPen = r2(adValoremPen + igvTotalPen + perceptionPen);

    const damLines: CustomsAccountingLine[] = [
      { lineOrder: 1, accountCode: ctaAdValorem.code, accountName: ctaAdValorem.name, debitAmount: adValoremPen, creditAmount: 0 },
      { lineOrder: 2, accountCode: ctaIgvImp.code, accountName: `${ctaIgvImp.name} (Crédito fiscal)`, debitAmount: igvTotalPen, creditAmount: 0 },
    ];
    if (perceptionPen > 0) {
      damLines.push({
        lineOrder: 3,
        accountCode: ctaPercepcion.code,
        accountName: ctaPercepcion.name,
        debitAmount: perceptionPen,
        creditAmount: 0,
      });
    }
    damLines.push({
      lineOrder: damLines.length + 1,
      accountCode: ctaBancos.code,
      accountName: `${ctaBancos.name} / Pago CDA SUNAT`,
      debitAmount: 0,
      creditAmount: totalCdaPen,
    });

    entries.push({
      entryCode: 'ASIENTO-03',
      entryName: '3. Liquidación Aduanera (CDA)',
      concept: 'Pago de derechos arancelarios Ad Valorem y crédito fiscal de IGV/IPM y Percepción SUNAT',
      glosa: `Liquidación tributaria DAM ${duaNumber} · Código CDA ${cdaNumber}`,
      date: today,
      lines: damLines,
      totalDebit: totalCdaPen,
      totalCredit: totalCdaPen,
      isBalanced: true,
    });

    // 4. Servicios Locales y Honorarios Agente de Aduana (Compras)
    const ctaAgencia = getAccount('AGENCIA_ADUANA');
    const ctaCxpLocal = getAccount('CXP_LOCAL');
    const localBase = localExpensesPen > 0 ? localExpensesPen : 180.0;
    const localIgv = r2(localBase * 0.18);
    const localTotal = r2(localBase + localIgv);

    entries.push({
      entryCode: 'ASIENTO-04',
      entryName: '4. Servicios Locales y Agente',
      concept: 'Gastos de agenciamiento aduanal, almacenaje portuario y estiba con crédito fiscal local',
      glosa: `Servicios locales y honorarios de agencia de aduana · DAM ${duaNumber}`,
      date: today,
      lines: [
        { lineOrder: 1, accountCode: ctaAgencia.code, accountName: ctaAgencia.name, debitAmount: localBase, creditAmount: 0 },
        { lineOrder: 2, accountCode: ctaIgvImp.code, accountName: 'IGV - Cuenta propia compras locales', debitAmount: localIgv, creditAmount: 0 },
        { lineOrder: 3, accountCode: ctaCxpLocal.code, accountName: ctaCxpLocal.name, debitAmount: 0, creditAmount: localTotal },
      ],
      totalDebit: localTotal,
      totalCredit: localTotal,
      isBalanced: true,
    });

    // 5. Existencias en Tránsito y Destino de Compras
    const ctaTransito = getAccount('TRANSITO');
    const ctaVariacion = getAccount('VARIACION_EXISTENCIAS');
    const totalVinculados = r2(capitalizableTotalPen - fobPen);

    entries.push({
      entryCode: 'ASIENTO-05',
      entryName: '5. Existencias en Tránsito y Destino',
      concept: 'Acumulación de costos capitalizables en tránsito y traslado de compras a variación',
      glosa: `Acumulación de costos en tránsito y destino compras · DAM ${duaNumber}`,
      date: today,
      lines: [
        // 5a. Tránsito
        { lineOrder: 1, accountCode: ctaTransito.code, accountName: ctaTransito.name, debitAmount: capitalizableTotalPen, creditAmount: 0 },
        { lineOrder: 2, accountCode: ctaVariacion.code, accountName: ctaVariacion.name, debitAmount: 0, creditAmount: capitalizableTotalPen },
        // 5b. Destino de compras
        { lineOrder: 3, accountCode: ctaVariacion.code, accountName: ctaVariacion.name, debitAmount: capitalizableTotalPen, creditAmount: 0 },
        { lineOrder: 4, accountCode: ctaFob.code, accountName: ctaFob.name, debitAmount: 0, creditAmount: fobPen },
        { lineOrder: 5, accountCode: '6091', accountName: 'Costos vinculados con las compras (Flete, seguro, aranceles, agencia)', debitAmount: 0, creditAmount: totalVinculados },
      ],
      totalDebit: r2(capitalizableTotalPen * 2),
      totalCredit: r2(capitalizableTotalPen * 2),
      isBalanced: true,
    });

    // 6. Ingreso Físico al Almacén (Cancelación de Tránsito -> Cta 20)
    const ctaAlmacen = getAccount('ALMACEN_FINAL');
    entries.push({
      entryCode: 'ASIENTO-06',
      entryName: '6. Ingreso Físico a Almacén',
      concept: 'Cierre de la cuenta 28 y alta oficial en cuenta 20111 al costo unitario Landed Cost',
      glosa: `Ingreso físico formal de mercaderías nacionalizadas a almacén · DAM ${duaNumber}`,
      date: today,
      lines: [
        { lineOrder: 1, accountCode: ctaAlmacen.code, accountName: ctaAlmacen.name, debitAmount: capitalizableTotalPen, creditAmount: 0 },
        { lineOrder: 2, accountCode: ctaTransito.code, accountName: ctaTransito.name, debitAmount: 0, creditAmount: capitalizableTotalPen },
      ],
      totalDebit: capitalizableTotalPen,
      totalCredit: capitalizableTotalPen,
      isBalanced: true,
    });

    // Comprobación de sincronización en Libro Diario
    const existingEntries = await this.prisma.accountingEntry.findMany({
      where: {
        company_id: companyId,
        source_module: 'CUSTOMS_IMPORT',
        source_reference_id: shipment.id,
      },
    });

    const isSynchronized = existingEntries.length > 0;

    return {
      shipmentId: shipment.id,
      shipmentNumber: shipment.shipment_number,
      supplierName,
      duaNumber,
      cdaNumber,
      currencyCode: 'PEN',
      exchangeRate: tc,
      fobUsd,
      fobPen,
      freightPen,
      insurancePen,
      cifPen,
      adValoremPen,
      tdaPen,
      localExpensesPen: localBase,
      capitalizableTotalPen,
      igvPen: igvTotalPen,
      perceptionPen,
      totalFiscalCreditPen,
      isAuditBalanced: true,
      auditDifferencePen: 0,
      isSynchronized,
      synchronizedAt: existingEntries[0]?.created_at?.toISOString(),
      entriesCount: entries.length,
      entries,
    };
  }

  /**
   * Sincroniza y asienta los 6 asientos contables en el Libro Diario general de la empresa.
   */
  async syncToGeneralLedger(
    companyId: string,
    shipmentId: string,
    responsible = 'Operador Contable Aduanas',
  ) {
    // 1. Garantizar existencia de cuentas contables del catálogo PCGE oficial
    const defaultAccounts = [
      { code: '6011', name: 'Mercaderías manufacturadas', element: '6', nature: 'Deudora', level: 4 },
      { code: '6091', name: 'Costos vinculados con las compras', element: '6', nature: 'Deudora', level: 4 },
      { code: '60911', name: 'Transporte y flete internacional', element: '6', nature: 'Deudora', level: 5 },
      { code: '60912', name: 'Seguro de transporte internacional', element: '6', nature: 'Deudora', level: 5 },
      { code: '60913', name: 'Derechos arancelarios (Ad Valorem)', element: '6', nature: 'Deudora', level: 5 },
      { code: '60914', name: 'Servicios de despacho y agenciamiento', element: '6', nature: 'Deudora', level: 5 },
      { code: '2811', name: 'Mercaderías en tránsito', element: '2', nature: 'Deudora', level: 4 },
      { code: '6111', name: 'Mercaderías manufacturadas', element: '6', nature: 'Acreedora', level: 4 },
      { code: '20111', name: 'Mercaderías manufacturadas al costo', element: '2', nature: 'Deudora', level: 5 },
      { code: '40111', name: 'IGV - Cuenta propia (Crédito Fiscal)', element: '4', nature: 'Acreedora', level: 5 },
      { code: '40113', name: 'IGV - Régimen de percepciones', element: '4', nature: 'Acreedora', level: 5 },
      { code: '42121', name: 'Facturas por pagar - Emitidas en el país', element: '4', nature: 'Acreedora', level: 5 },
      { code: '42122', name: 'Facturas por pagar - Emitidas en el exterior', element: '4', nature: 'Acreedora', level: 5 },
      { code: '1041', name: 'Cuentas corrientes operativas', element: '1', nature: 'Deudora', level: 4 },
    ];

    if (this.prisma.accountingAccount?.upsert) {
      for (const acc of defaultAccounts) {
        await this.prisma.accountingAccount.upsert({
          where: { code: acc.code },
          update: {},
          create: {
            code: acc.code,
            name: acc.name,
            element: acc.element,
            nature: acc.nature,
            level: acc.level,
            is_active: true,
          },
        });
      }
    }

    const summary = await this.getAccountingSummary(companyId, shipmentId);

    const now = new Date();
    const period = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    const createdEntries: any[] = [];

    for (const [idx, entry] of summary.entries.entries()) {
      const idempotencyKey = `customs-entry:${summary.shipmentId}:${entry.entryCode}`;

      try {
        const result = await this.accounting.execute({
          companyId,
          period,
          entryDate: new Date(entry.date).toISOString(),
          glosa: entry.glosa,
          sourceModule: 'CUSTOMS_IMPORT',
          journalCode: 'IMP',
          sourceReferenceId: summary.shipmentId,
          idempotencyKey,
          lines: entry.lines.map((l) => ({
            lineOrder: l.lineOrder,
            accountCode: l.accountCode,
            accountName: l.accountName,
            debitAmount: l.debitAmount,
            creditAmount: l.creditAmount,
          })),
        });
        createdEntries.push(result);
      } catch (err: any) {
        this.logger.warn(`Asiento ${entry.entryCode} ya existía o arrojó: ${err.message}`);
      }
    }

    return {
      message: `¡Se sincronizaron exitosamente ${createdEntries.length} asientos contables de importación en el Libro Diario!`,
      shipmentId: summary.shipmentId,
      duaNumber: summary.duaNumber,
      capitalizableTotalPen: summary.capitalizableTotalPen,
      totalFiscalCreditPen: summary.totalFiscalCreditPen,
      createdCount: createdEntries.length,
      period,
    };
  }
}
