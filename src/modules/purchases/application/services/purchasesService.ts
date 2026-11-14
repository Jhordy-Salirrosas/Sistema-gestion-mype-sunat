import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { PrismaService } from '../../../../database/prismaService';
import { MovingWeightedAverageEngine } from '../../../inventory/domain/rules/MovingWeightedAverageEngine';
import { CreatePurchaseDto } from '../dto/createPurchaseDto';
import { PayPurchaseDto } from '../dto/payPurchaseDto';
import { mapPurchaseRecord } from '../mappers/purchaseResponseMapper';
import { GenerateAccountingEntryUseCase } from '../../../accounting/application/use-cases/generateAccountingEntryUseCase';
import { TreasuryAccountsService } from '../../../accounting/application/services/treasuryAccountsService';

const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
const r4 = (n: number) => Math.round((n + Number.EPSILON) * 10000) / 10000;

/**
 * Servicio del Módulo Autónomo de Compras (Fase 1).
 *
 * Registra facturas y boletas de compra de proveedores nacionales:
 * 1. Genera los movimientos de entrada al Kardex con código de operación 02 (Tabla 12 SUNAT).
 * 2. Actualiza el stock y el costo promedio ponderado en `inventory_balances`.
 * 3. Registra el IGV crédito fiscal y la cuenta por pagar al proveedor en `national_purchases`.
 * 4. Genera automáticamente los asientos contables de naturaleza (60/40/42) y destino (20/61).
 * 5. Gestiona pagos totales y parciales con reflejo en tesorería y asiento contable 42/10.
 */
@Injectable()
export class PurchasesService {
  private readonly logger = new Logger(PurchasesService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Optional()
    private readonly accounting?: GenerateAccountingEntryUseCase,
    @Optional()
    private readonly tesoreria?: TreasuryAccountsService,
  ) {}

  async listPurchases(companyId: string) {
    return this.prisma.nationalPurchase.findMany({
      where: { company_id: companyId },
      include: {
        items: true,
      },
      orderBy: { issue_date: 'desc' },
      take: 200,
    });
  }

  async getPurchaseById(companyId: string, id: string) {
    const purchase = await this.prisma.nationalPurchase.findFirst({
      where: { id, company_id: companyId },
      include: {
        items: true,
        supplier: true,
      },
    });

    if (!purchase) {
      throw new NotFoundException(`Compra nacional con id ${id} no encontrada.`);
    }

    return purchase;
  }

  async createPurchase(companyId: string, dto: CreatePurchaseDto) {
    const supplierDoc = dto.supplierDocNumber.trim();
    const supplierName = dto.supplierName.trim();
    const docTypeCode = (dto.documentTypeCode ?? '01').trim();
    const docSerial = dto.documentSerial.trim().toUpperCase();
    const docNumber = dto.documentNumber.trim();
    const warehouseCode = (dto.warehouseCode ?? 'ALM-01').trim().toUpperCase();
    const issueDate = dto.issueDate ? new Date(dto.issueDate) : new Date();
    const currencyCode = (dto.currencyCode ?? 'PEN').trim().toUpperCase();

    const skus = dto.items.map((i) => i.sku.trim().toUpperCase());
    if (new Set(skus).size !== skus.length) {
      throw new BadRequestException('No se puede repetir el mismo producto/SKU en la factura de compra.');
    }

    if (this.accounting) {
      const reglasCompra = await this.prisma.accountingRule.findMany({
        where: { company_id: companyId, process_code: 'COMPRA', is_active: true },
        orderBy: { line_order: 'asc' },
      });
      const lineas = new Set(reglasCompra.map((r) => r.line_order));
      if (reglasCompra.length === 0 || ![1, 2, 3].every((n) => lineas.has(n))) {
        throw new BadRequestException('Las reglas COMPRA están incompletas: se requieren las líneas 1 a 3.');
      }
    }

    const result = await this.prisma.$transaction(async (tx: any) => {
      const warehouse = await tx.inventoryWarehouse.findFirst({
        where: { company_id: companyId, warehouse_code: warehouseCode },
      });
      if (!warehouse) {
        throw new NotFoundException(`Almacén ${warehouseCode} no encontrado en la empresa.`);
      }

      const existing = await tx.nationalPurchase.findFirst({
        where: {
          company_id: companyId,
          supplier_doc_number: supplierDoc,
          document_type_code: docTypeCode,
          document_serial: docSerial,
          document_number: docNumber,
        },
      });
      if (existing) {
        throw new ConflictException(
          `La factura/comprobante ${docSerial}-${docNumber} del proveedor ${supplierDoc} ya fue registrada.`,
        );
      }

      let supplierId = dto.supplierId;
      if (!supplierId) {
        const partner = await tx.businessPartner.findFirst({
          where: { company_id: companyId, doc_number: supplierDoc },
        });
        if (partner) supplierId = partner.id;
      }

      const purchaseNumber = `COM-${Date.now().toString().slice(-8)}`;
      let totalNet = 0;
      let totalIgv = 0;
      let totalAmount = 0;
      const preparedItems: any[] = [];

      for (const item of dto.items) {
        const sku = item.sku.trim().toUpperCase();
        const product = await tx.inventoryProduct.findFirst({
          where: { company_id: companyId, sku },
        });
        if (!product) throw new NotFoundException(`Producto con SKU ${sku} no encontrado.`);
        if (!product.is_inventory) {
          throw new BadRequestException(`El ítem ${sku} (${product.description}) es un servicio y no mueve inventario.`);
        }
        const quantity = Number(item.quantity);
        const unitCostNet = Number(item.unitCost);
        if (!(quantity > 0) || !Number.isFinite(unitCostNet) || unitCostNet < 0) {
          throw new BadRequestException(`Cantidad o costo inválido para ${sku}.`);
        }
        const subtotal = r2(quantity * unitCostNet);
        const itemIgv = r2(subtotal * 0.18);
        const itemTotal = r2(subtotal + itemIgv);
        totalNet += subtotal;
        totalIgv += itemIgv;
        totalAmount += itemTotal;
        preparedItems.push({
          product_id: product.id,
          sku,
          description: product.description,
          unit_code: product.sunat_unit_code ?? 'NIU',
          quantity,
          unit_cost: r4(unitCostNet),
          subtotal,
          igv_amount: itemIgv,
          total_amount: itemTotal,
          received_quantity: 0,
        });
      }

      const purchase = await tx.nationalPurchase.create({
        data: {
          company_id: companyId,
          purchase_number: purchaseNumber,
          supplier_id: supplierId,
          supplier_doc_type: '6',
          supplier_doc_number: supplierDoc,
          supplier_name: supplierName,
          document_type_code: docTypeCode,
          document_serial: docSerial,
          document_number: docNumber,
          issue_date: issueDate,
          accounting_date: issueDate,
          currency_code: currencyCode,
          warehouse_code: warehouseCode,
          net_amount: r2(totalNet),
          igv_amount: r2(totalIgv),
          total_amount: r2(totalAmount),
          status: 'REGISTRADA',
          reception_status: 'PENDIENTE',
          notes: dto.notes,
          responsible: dto.responsible,
          items: { create: preparedItems },
        },
        include: { items: true },
      });

      return purchase;
    });

    const mapped = mapPurchaseRecord(result, { includeExtended: true, includeItemsCount: true });
    await this.registrarAsientoCompra(companyId, mapped, issueDate);
    return mapped;
  }

  async receivePurchase(
    companyId: string,
    id: string,
    dto: { items?: { itemId: string; quantity: number }[]; receivedAt?: string },
  ) {
    const existente = await this.prisma.nationalPurchase.findFirst({
      where: { id, company_id: companyId },
      include: { items: true },
    });
    if (!existente) throw new NotFoundException('Compra no encontrada.');
    if (existente.status === 'ANULADA') throw new BadRequestException('La compra está anulada.');
    if (existente.reception_status === 'RECIBIDA') throw new BadRequestException('La compra ya fue recibida completamente.');

    const pendientes = existente.items
      .map((i) => ({
        item: i,
        pendiente: Number(i.quantity) - Number(i.received_quantity ?? 0),
      }))
      .filter((x) => x.pendiente > 0);
    if (pendientes.length === 0) throw new BadRequestException('La compra no tiene cantidades pendientes de recepción.');

    const solicitados = dto.items?.length
      ? dto.items
      : pendientes.map((x) => ({ itemId: x.item.id, quantity: x.pendiente }));
    const warehouse = await this.prisma.inventoryWarehouse.findFirst({
      where: { company_id: companyId, warehouse_code: existente.warehouse_code },
    });
    if (!warehouse) throw new NotFoundException(`Almacén ${existente.warehouse_code} no encontrado.`);
    const receivedAt = dto.receivedAt ? new Date(dto.receivedAt) : new Date();
    const recibidos: { item: any; quantity: number; unitCost: number }[] = [];

    const result = await this.prisma.$transaction(async (tx: any) => {
      for (const [index, solicitud] of solicitados.entries()) {
        const fila = pendientes.find((x) => x.item.id === solicitud.itemId);
        if (!fila) throw new BadRequestException('Ítem de compra inválido o ya recibido.');
        const cantidad = Number(solicitud.quantity);
        if (!(cantidad > 0) || cantidad > fila.pendiente + 0.00001) {
          throw new BadRequestException(`Cantidad inválida para ${fila.item.sku}. Pendiente: ${fila.pendiente}.`);
        }
        const product = await tx.inventoryProduct.findUnique({ where: { id: fila.item.product_id } });
        if (!product) throw new NotFoundException(`Producto ${fila.item.sku} no encontrado.`);
        const balance = await tx.inventoryBalance.findUnique({
          where: {
            company_id_warehouse_id_product_id: {
              company_id: companyId,
              warehouse_id: warehouse.id,
              product_id: product.id,
            },
          },
        });
        const prevStock = Number(balance?.current_stock ?? 0);
        const prevAvgCost = Number(balance?.average_unit_cost ?? 0);
        const prevTotalVal = Number(balance?.total_inventory_value ?? 0);
        const calc = MovingWeightedAverageEngine.calculate({
          previousStock: prevStock,
          previousAverageCost: prevAvgCost,
          previousTotalValue: prevTotalVal,
          movementDirection: 'ENTRADA',
          quantity: cantidad,
          unitCost: Number(fila.item.unit_cost),
        });
        await tx.inventoryBalance.upsert({
          where: {
            company_id_warehouse_id_product_id: {
              company_id: companyId,
              warehouse_id: warehouse.id,
              product_id: product.id,
            },
          },
          create: {
            company_id: companyId, warehouse_id: warehouse.id, product_id: product.id,
            current_stock: calc.resultingStock, average_unit_cost: r4(calc.resultingAverageCost),
            total_inventory_value: r2(calc.resultingTotalValue), last_movement_at: receivedAt,
          },
          update: {
            current_stock: calc.resultingStock, average_unit_cost: r4(calc.resultingAverageCost),
            total_inventory_value: r2(calc.resultingTotalValue), last_movement_at: receivedAt,
          },
        });
        await tx.inventoryCostLayer.create({
          data: {
            company_id: companyId, warehouse_id: warehouse.id, product_id: product.id,
            quantity_remaining: cantidad, unit_cost: r4(Number(fila.item.unit_cost)),
          },
        });
        await tx.inventoryMovement.create({
          data: {
            company_id: companyId, warehouse_id: warehouse.id, product_id: product.id,
            movement_number: `REC-${existente.purchase_number}-${fila.item.sku}-${Date.now()}-${index}`,
            movement_date: receivedAt, accounting_date: receivedAt, operation_type_code: '02',
            document_type_code: existente.document_type_code, document_serial: existente.document_serial,
            document_number: existente.document_number, direction: 'ENTRADA', quantity: calc.movementQuantity,
            unit_cost: r4(calc.movementUnitCost), total_cost: r2(calc.movementTotalCost),
            previous_stock: r4(prevStock), previous_unit_cost: r4(prevAvgCost), previous_total_value: r2(prevTotalVal),
            resulting_stock: calc.resultingStock, resulting_unit_cost: r4(calc.resultingAverageCost),
            resulting_total_value: r2(calc.resultingTotalValue),
            source_reference_id: `${existente.purchase_number}:RECEPCION:${receivedAt.getTime()}`, source_module: 'PURCHASES_RECEPTION',
            notes: `Recepción parcial/total de compra ${existente.purchase_number}`,
          },
        });
        await tx.nationalPurchaseItem.update({
          where: { id: fila.item.id },
          data: { received_quantity: { increment: cantidad } },
        });
        recibidos.push({ item: fila.item, quantity: cantidad, unitCost: Number(fila.item.unit_cost) });
      }

      const actualizada = await tx.nationalPurchase.findUnique({ where: { id }, include: { items: true } });
      const completo = actualizada.items.every((i: any) => Number(i.received_quantity) + 0.00001 >= Number(i.quantity));
      const algo = actualizada.items.some((i: any) => Number(i.received_quantity) > 0);
      return tx.nationalPurchase.update({
        where: { id },
        data: { reception_status: completo ? 'RECIBIDA' : algo ? 'PARCIAL' : 'PENDIENTE' },
        include: { items: true },
      });
    }).catch((error: unknown) => { this.logger.error(`Recepción falló: ${error instanceof Error ? error.stack : String(error)}`); throw error; });

    const totalRecepcion = recibidos.reduce((sum, r) => sum + r.quantity * r.unitCost, 0);
    const mapped = mapPurchaseRecord(result, { includeExtended: true, includeItemsCount: true });
    await this.registrarAsientoRecepcion(companyId, mapped, totalRecepcion, receivedAt);
    return mapped;
  }

  async listPayments(companyId: string, id: string) {
    const purchase = await this.prisma.nationalPurchase.findFirst({
      where: { id, company_id: companyId },
      select: { purchase_number: true },
    });
    if (!purchase) throw new NotFoundException('Compra no encontrada.');
    const pagos = await this.prisma.treasuryMovement.findMany({
      where: {
        company_id: companyId,
        source_module: 'PURCHASES',
        source_reference_id: purchase.purchase_number,
        direction: 'EGRESO',
      },
      orderBy: { movement_date: 'desc' },
    });
    return pagos.map((p) => ({
      id: p.id,
      date: p.movement_date,
      amount: Number(p.amount),
      paymentMethod: p.payment_method,
      bankName: p.bank_name,
      concept: p.concept,
    }));
  }

  async createManualPayable(companyId: string, dto: { supplierName: string; supplierDocNumber: string; description: string; amount: number; issueDate?: string; currencyCode?: string; exchangeRate?: number }) {
    const montoOriginal = Math.round(Number(dto.amount) * 100) / 100;
    if (!(montoOriginal > 0)) throw new BadRequestException('El monto debe ser mayor a cero.');
    const moneda = (dto.currencyCode ?? 'PEN').trim().toUpperCase();
    if (!['PEN', 'USD'].includes(moneda)) throw new BadRequestException('La moneda debe ser PEN o USD.');
    const tipoCambio = moneda === 'USD' ? Number(dto.exchangeRate) : 1;
    if (moneda === 'USD' && !(tipoCambio > 0)) throw new BadRequestException('Indique un tipo de cambio mayor a cero.');
    const monto = Math.round(montoOriginal * tipoCambio * 100) / 100;
    if (!dto.supplierName?.trim() || !dto.supplierDocNumber?.trim()) throw new BadRequestException('Proveedor y documento son obligatorios.');
    const reglas = await this.prisma.accountingRule.findMany({ where: { company_id: companyId, process_code: 'GASTO', is_active: true }, orderBy: { line_order: 'asc' } });
    const lineas = new Set(reglas.map((r) => r.line_order));
    if (reglas.length === 0 || ![1, 3].every((n) => lineas.has(n))) {
      throw new BadRequestException('Las reglas GASTO están incompletas: se requieren las líneas 1 y 3.');
    }
    const fecha = dto.issueDate ? new Date(dto.issueDate) : new Date();
    const numero = `CXP-${Date.now().toString().slice(-8)}`;
    const compra = await this.prisma.nationalPurchase.create({
      data: {
        company_id: companyId, purchase_number: numero, supplier_doc_type: '6', supplier_doc_number: dto.supplierDocNumber.trim(),
        supplier_name: dto.supplierName.trim(), document_type_code: '00', document_serial: 'MANUAL', document_number: numero,
        issue_date: fecha, accounting_date: fecha, currency_code: moneda, exchange_rate: moneda === 'USD' ? tipoCambio : null, net_amount: monto, igv_amount: 0, total_amount: monto,
        status: 'REGISTRADA', reception_status: 'RECIBIDA', paid_amount: 0, notes: `CxP manual: ${dto.description.trim()}${moneda === 'USD' ? ` (USD ${montoOriginal.toFixed(2)} @ ${tipoCambio})` : ''}`,
      },
    });
    if (this.accounting) {
      const porOrden = new Map(reglas.map((r) => [r.line_order, r.account_code]));
      const periodo = `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}`;
      await this.accounting.execute({
        companyId, period: periodo, entryDate: fecha.toISOString(), glosa: `CxP manual ${dto.supplierName.trim()} · ${dto.description.trim()}`,
        sourceModule: 'MANUAL_PAYABLE', journalCode: 'GAS', sourceReferenceId: compra.id, idempotencyKey: `manual-payable:${compra.id}`,
        lines: [
          { lineOrder: 1, accountCode: porOrden.get(1)!, accountName: 'Gasto', debitAmount: monto, creditAmount: 0 },
          { lineOrder: 2, accountCode: porOrden.get(3)!, accountName: 'Cuentas por pagar', debitAmount: 0, creditAmount: monto },
        ],
      });
    }
    return compra;
  }

  async supplierStatement(companyId: string, supplierDoc: string) {
    const compras = await this.prisma.nationalPurchase.findMany({
      where: { company_id: companyId, supplier_doc_number: supplierDoc.trim(), status: { not: 'ANULADA' } },
      orderBy: { issue_date: 'desc' },
      select: { id: true, purchase_number: true, document_serial: true, document_number: true, issue_date: true, total_amount: true, paid_amount: true, status: true },
    });
    const numeros = compras.map((c) => c.purchase_number);
    const pagos = numeros.length === 0 ? [] : await this.prisma.treasuryMovement.findMany({
      where: { company_id: companyId, source_module: 'PURCHASES', source_reference_id: { in: numeros }, direction: 'EGRESO' },
      orderBy: { movement_date: 'desc' },
    });
    const total = compras.reduce((s, c) => s + Number(c.total_amount), 0);
    const pagado = compras.reduce((s, c) => s + Number(c.paid_amount ?? 0), 0);
    return {
      supplierDoc: supplierDoc.trim(),
      purchases: compras.map((c) => ({ id: c.id, number: c.purchase_number, document: `${c.document_serial}-${c.document_number}`, date: c.issue_date, total: Number(c.total_amount), paid: Number(c.paid_amount ?? 0), balance: Math.round((Number(c.total_amount) - Number(c.paid_amount ?? 0)) * 100) / 100, status: c.status })),
      payments: pagos.map((p) => ({ id: p.id, date: p.movement_date, amount: Number(p.amount), method: p.payment_method, reference: p.source_reference_id, concept: p.concept })),
      totals: { total: Math.round(total * 100) / 100, paid: Math.round(pagado * 100) / 100, balance: Math.round((total - pagado) * 100) / 100 },
    };
  }

  async listPayables(companyId: string) {
    const compras = await this.prisma.nationalPurchase.findMany({
      where: { company_id: companyId, status: { not: 'ANULADA' } },
      select: { supplier_doc_number: true, supplier_name: true, total_amount: true, paid_amount: true, issue_date: true, created_at: true },
    });
    const mapa = new Map<
      string,
      { supplierDocNumber: string; supplierName: string; total: number; paid: number; balance: number; count: number; aging: { d0_30: number; d31_60: number; d61_90: number; d90_plus: number }; overdue: number; oldestDays: number; lastActivityAt: Date | null }
    >();
    for (const c of compras) {
      const actual = mapa.get(c.supplier_doc_number) ?? {
        supplierDocNumber: c.supplier_doc_number,
        supplierName: c.supplier_name,
        total: 0,
        paid: 0,
        balance: 0,
        count: 0,
        aging: { d0_30: 0, d31_60: 0, d61_90: 0, d90_plus: 0 },
        overdue: 0,
        oldestDays: 0,
        lastActivityAt: null,
      };
      const total = Number(c.total_amount);
      const paid = Number(c.paid_amount ?? 0);
      actual.total += total;
      actual.paid += paid;
      actual.balance += total - paid;
      actual.count += 1;
      if (c.created_at && (!actual.lastActivityAt || c.created_at > actual.lastActivityAt)) actual.lastActivityAt = c.created_at;
      const saldo = total - paid;
      const dias = c.issue_date ? Math.max(0, Math.floor((Date.now() - new Date(c.issue_date).getTime()) / 86400000)) : 0;
      if (saldo > 0.005) {
        if (dias <= 30) actual.aging.d0_30 += saldo;
        else if (dias <= 60) actual.aging.d31_60 += saldo;
        else if (dias <= 90) actual.aging.d61_90 += saldo;
        else actual.aging.d90_plus += saldo;
        if (dias > 30) actual.overdue += saldo;
        actual.oldestDays = Math.max(actual.oldestDays, dias);
      }
      mapa.set(c.supplier_doc_number, actual);
    }
    return [...mapa.values()].map((c) => ({
      ...c,
      total: Math.round(c.total * 100) / 100,
      paid: Math.round(c.paid * 100) / 100,
      balance: Math.round(c.balance * 100) / 100,
      overdue: Math.round(c.overdue * 100) / 100,
      aging: {
        d0_30: Math.round(c.aging.d0_30 * 100) / 100,
        d31_60: Math.round(c.aging.d31_60 * 100) / 100,
        d61_90: Math.round(c.aging.d61_90 * 100) / 100,
        d90_plus: Math.round(c.aging.d90_plus * 100) / 100,
      },
    }));
  }

  /** Registra un pago total o parcial y su asiento CxP contra caja/banco. */
  async payPurchase(companyId: string, id: string, dto: PayPurchaseDto) {
    const purchase = await this.prisma.nationalPurchase.findFirst({
      where: { id, company_id: companyId },
      include: { items: true },
    });
    if (!purchase) throw new NotFoundException('Compra no encontrada.');
    if (purchase.status === 'ANULADA') throw new BadRequestException('La compra está anulada.');
    if (purchase.status === 'PAGADA') throw new BadRequestException('La compra ya está pagada.');

    const total = Number(purchase.total_amount);
    const pagado = Number(purchase.paid_amount ?? 0);
    const saldo = Math.round((total - pagado) * 100) / 100;
    const monto = Math.round(Number(dto.amount ?? saldo) * 100) / 100;
    if (!(monto > 0) || monto > saldo) {
      throw new BadRequestException(`El monto debe estar entre 0.01 y ${saldo.toFixed(2)}.`);
    }
    const fecha = dto.paymentDate ? new Date(dto.paymentDate) : new Date();
    const metodo = dto.paymentMethod ?? 'TRANSFERENCIA';
    const reglasPago = this.accounting
      ? await this.prisma.accountingRule.findMany({ where: { company_id: companyId, process_code: 'PAGO', is_active: true }, orderBy: { line_order: 'asc' } })
      : [];
    if (this.accounting && reglasPago.length === 0) {
      throw new BadRequestException('No hay reglas contables para PAGO. Configúrelas antes de pagar.');
    }
    const nuevoPagado = Math.round((pagado + monto) * 100) / 100;
    const nuevoEstado = nuevoPagado >= total - 0.005 ? 'PAGADA' : 'PAGO_PARCIAL';

    const movimiento = await this.prisma.$transaction(async (tx: any) => {
      const creado = await tx.treasuryMovement.create({
        data: {
          company_id: companyId,
          movement_date: fecha,
          direction: 'EGRESO',
          document_reference: `${purchase.document_serial}-${purchase.document_number}`,
          counterpart_name: purchase.supplier_name,
          concept: `Pago ${nuevoEstado === 'PAGADA' ? 'total' : 'parcial'} compra ${purchase.purchase_number}`,
          amount: monto,
          source_module: 'PURCHASES',
          source_reference_id: purchase.purchase_number,
          payment_method: metodo,
          bank_name: dto.bankName ?? null,
        },
      });
      await tx.nationalPurchase.update({
        where: { id },
        data: { status: nuevoEstado, paid_amount: nuevoPagado },
      });
      return creado;
    });

    if (this.accounting) {
      const porOrdenPago = new Map<number, string>(reglasPago.map((r: any) => [Number(r.line_order), String(r.account_code)]));
      const cuentaCxp = porOrdenPago.get(1);
      const cuentaBanco = porOrdenPago.get(2);
      if (!cuentaCxp || (!cuentaBanco && metodo !== 'EFECTIVO')) {
        throw new BadRequestException('Las reglas PAGO están incompletas: faltan las líneas 1 y 2.');
      }
      const cxp = cuentaCxp;
      const respaldo = {
        code: metodo === 'EFECTIVO' ? '1011' : cuentaBanco!,
        name: metodo === 'EFECTIVO' ? 'Caja principal' : 'Cuenta corriente',
      };
      // La cuenta elegida en tesorería manda; si no llega, se conserva la regla.
      const cuentaCaja = this.tesoreria
        ? await this.tesoreria.cuentaParaAsiento(companyId, dto.treasuryAccountId, respaldo)
        : respaldo;
      const periodo = `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}`;
      await this.accounting.execute({
        companyId,
        period: periodo,
        entryDate: fecha.toISOString(),
        glosa: `Pago ${nuevoEstado === 'PAGADA' ? 'total' : 'parcial'} compra ${purchase.purchase_number} · ${purchase.supplier_name}`,
        sourceModule: 'PURCHASES',
        journalCode: 'CAJ',
        sourceReferenceId: `PAGO-${purchase.purchase_number}-${movimiento.id}`,
        idempotencyKey: `purchase-payment:${movimiento.id}`,
        lines: [
          {
            lineOrder: 1,
            accountCode: cxp,
            accountName: 'Cuentas por pagar comerciales',
            debitAmount: monto,
            creditAmount: 0,
          },
          {
            lineOrder: 2,
            accountCode: cuentaCaja.code,
            accountName: cuentaCaja.name,
            debitAmount: 0,
            creditAmount: monto,
          },
        ],
      });
    }

    return {
      id,
      status: nuevoEstado,
      amount: monto,
      paidAmount: nuevoPagado,
      balance: Math.round((total - nuevoPagado) * 100) / 100,
      paymentMethod: metodo,
    };
  }

  /** Asiento de compra PCGE: Naturaleza (60/40/42) y Destino al almacén (20/61). */
  private async registrarAsientoCompra(
    companyId: string,
    purchase: any,
    issueDate: Date,
  ): Promise<void> {
    if (!this.accounting) return;

    const existente = await this.prisma.accountingEntry.findFirst({
      where: {
        company_id: companyId,
        source_module: 'PURCHASES',
        source_reference_id: purchase.purchaseNumber,
      },
      select: { id: true },
    });
    if (existente) return;

    const reglas = await this.prisma.accountingRule.findMany({
      where: { company_id: companyId, process_code: 'COMPRA', is_active: true },
      orderBy: { line_order: 'asc' },
    });
    const porOrden = new Map<number, string>(reglas.map((r) => [r.line_order, r.account_code]));
    if (![1, 2, 3].every((n) => porOrden.has(n))) {
      this.logger.error(`Compra ${purchase.purchaseNumber} sin reglas COMPRA completas; no se genera asiento.`);
      return;
    }
    const accGastoCompra = porOrden.get(1)!;
    const accIgvCredito = porOrden.get(2)!;
    const accCxp = porOrden.get(3)!;

    const periodo = `${issueDate.getFullYear()}-${String(issueDate.getMonth() + 1).padStart(2, '0')}`;
    try {
      await this.accounting.execute({
        companyId,
        period: periodo,
        entryDate: issueDate.toISOString(),
        glosa: `Compra ${purchase.documentSerial}-${purchase.documentNumber} · ${purchase.supplierName}`,
        sourceModule: 'PURCHASES',
        journalCode: 'COM',
        sourceReferenceId: purchase.purchaseNumber,
        lines: [
          // 1. Naturaleza: Compra de mercaderías
          {
            lineOrder: 1,
            accountCode: accGastoCompra,
            accountName: 'Mercaderías manufacturadas (Gasto Compra)',
            debitAmount: purchase.netAmount,
            creditAmount: 0,
          },
          // 2. Naturaleza: IGV Crédito fiscal
          {
            lineOrder: 2,
            accountCode: accIgvCredito,
            accountName: 'IGV - Cuenta propia / Crédito fiscal',
            debitAmount: purchase.igvAmount,
            creditAmount: 0,
          },
          // 3. Naturaleza: Cuentas por pagar comerciales a proveedores
          {
            lineOrder: 3,
            accountCode: accCxp,
            accountName: 'Facturas por pagar emitidas',
            debitAmount: 0,
            creditAmount: purchase.totalAmount,
          },
        ],
      });
    } catch (error) {
      this.logger.error(
        `Compra ${purchase.purchaseNumber} registrada sin asiento: ${(error as Error).message}`,
      );
    }


  }

  /** Asiento de recepción: entrada al almacén (20) contra variación de existencias (61). */
  private async registrarAsientoRecepcion(
    companyId: string,
    purchase: any,
    importe: number,
    receivedAt: Date,
  ): Promise<void> {
    if (!this.accounting || !(importe > 0)) return;
    const reglas = await this.prisma.accountingRule.findMany({
      where: { company_id: companyId, process_code: 'RECEPCION', is_active: true },
      orderBy: { line_order: 'asc' },
    });
    const porOrden = new Map<number, string>(reglas.map((r) => [r.line_order, r.account_code]));
    if (![1, 2].every((n) => porOrden.has(n))) {
      this.logger.error(`Recepción ${purchase.purchaseNumber} sin reglas RECEPCION completas; no se genera asiento.`);
      return;
    }
    const periodo = `${receivedAt.getFullYear()}-${String(receivedAt.getMonth() + 1).padStart(2, '0')}`;
    try {
      await this.accounting.execute({
        companyId,
        period: periodo,
        entryDate: receivedAt.toISOString(),
        glosa: `Recepción de compra ${purchase.documentSerial}-${purchase.documentNumber} · ${purchase.supplierName}`,
        sourceModule: 'PURCHASES_RECEPTION',
        journalCode: 'COM',
        sourceReferenceId: `${purchase.purchaseNumber}:RECEPCION:${receivedAt.getTime()}`,
        lines: [
          { lineOrder: 1, accountCode: porOrden.get(1)!, accountName: 'Mercaderías en almacén', debitAmount: importe, creditAmount: 0 },
          { lineOrder: 2, accountCode: porOrden.get(2)!, accountName: 'Variación de existencias', debitAmount: 0, creditAmount: importe },
        ],
      });
    } catch (error) {
      this.logger.error(`Recepción ${purchase.purchaseNumber} sin asiento: ${(error as Error).message}`);
    }
  }
}
