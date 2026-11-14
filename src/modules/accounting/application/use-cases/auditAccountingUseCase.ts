import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../database/prismaService';
import {
  checkAccountCode,
  checkEntryLines,
  checkRules,
  cuentasConHijos,
  type CatalogAccount,
  type IntegrityIssue,
} from '../../domain/rules/catalogIntegrityRule';

/**
 * Auditoría contable de solo lectura.
 *
 * No corrige nada: describe el estado del módulo para que el contador decida.
 * Existe porque los problemas del módulo son de dos clases muy distintas —
 * configuración (reglas/cuentas) y datos históricos (comprobantes sin asiento,
 * asientos descuadrados) — y hasta ahora no había forma de verlos juntos sin
 * mirar la base a mano.
 *
 * Todo se acota a `company_id`: la auditoría nunca debe mezclar empresas.
 */

/** Comprobante con un problema contable. */
export interface AuditInvoiceIssue {
  id: string;
  numero: string;
  tipoComprobante: string;
  fechaEmision: string;
  total: number;
  detalle: string;
}

/** Asiento descuadrado o incompleto. */
export interface AuditEntryIssue {
  id: string;
  entryNumber: number;
  period: string;
  sourceModule: string;
  sourceReferenceId: string | null;
  debe: number;
  haber: number;
  diferencia: number;
  detalle: string;
}

/** Referencia con más de un asiento activo (duplicado por reintento). */
export interface AuditDuplicateIssue {
  sourceModule: string;
  sourceReferenceId: string;
  asientos: number;
  detalle: string;
}

/** Compra nacional registrada sin asiento contable. */
export interface AuditPurchaseIssue {
  id: string;
  numero: string;
  documento: string;
  proveedor: string;
  fecha: string;
  total: number;
  detalle: string;
}

/** Cobro registrado sobre un comprobante que ya está anulado. */
export interface AuditCollectionIssue {
  id: string;
  comprobante: string;
  cliente: string;
  fecha: string;
  monto: number;
  detalle: string;
}

/** Gasto registrado sin asiento contable. */
export interface AuditExpenseIssue {
  id: string;
  descripcion: string;
  proveedor: string;
  documento: string;
  fecha: string;
  total: number;
  detalle: string;
}

export interface AccountingAuditReport {
  companyId: string;
  period: string | null;
  generatedAt: string;
  ok: boolean;
  catalogo: { total: number; activas: number };
  reglas: {
    procesos: string[];
    total: number;
    issues: IntegrityIssue[];
  };
  mapeos: {
    total: number;
    issues: IntegrityIssue[];
  };
  asientos: {
    revisados: number;
    truncado: boolean;
    descuadrados: AuditEntryIssue[];
    sinLineas: AuditEntryIssue[];
    duplicados: AuditDuplicateIssue[];
    conCuentaInvalida: Array<{ id: string; entryNumber: number; issues: IntegrityIssue[] }>;
  };
  comprobantes: {
    revisados: number;
    truncado: boolean;
    sinAsiento: AuditInvoiceIssue[];
    sinCosto: AuditInvoiceIssue[];
  };
  compras: {
    revisadas: number;
    truncado: boolean;
    sinAsiento: AuditPurchaseIssue[];
  };
  gastos: {
    revisados: number;
    truncado: boolean;
    sinAsiento: AuditExpenseIssue[];
  };
  cobros: {
    deComprobantesAnulados: AuditCollectionIssue[];
  };
  resumen: { errors: number; warnings: number };
}

/** Tope de filas por consulta: la auditoría informa el truncado, no pagina sola. */
const MAX_ASIENTOS = 5000;
const MAX_COMPROBANTES = 2000;
const MAX_COMPRAS = 2000;
const MAX_GASTOS = 2000;
const MAX_COBROS = 2000;

const numeroDe = (serie: string, correlativo: number): string =>
  `${serie}-${String(correlativo).padStart(8, '0')}`;

const r2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;

@Injectable()
export class AuditAccountingUseCase {
  constructor(private readonly prisma: PrismaService) {}

  async execute(companyId: string, period?: string): Promise<AccountingAuditReport> {
    // Un período mal escrito devolvería "todo limpio" porque no encuentra nada:
    // es preferible rechazarlo que dar un falso positivo de auditoría.
    if (period !== undefined && !/^\d{4}-(0[1-9]|1[0-2])$/.test(period)) {
      throw new BadRequestException('El período debe tener formato YYYY-MM');
    }
    const [cuentas, reglas, mapeos] = await Promise.all([
      this.prisma.accountingAccount.findMany({
        select: { code: true, name: true, parent_code: true, is_active: true },
      }),
      this.prisma.accountingRule.findMany({
        where: { company_id: companyId, is_active: true },
        orderBy: [{ process_code: 'asc' }, { line_order: 'asc' }],
      }),
      this.prisma.accountingMapping?.findMany?.({
        where: { company_id: companyId },
        select: { process_code: true, role_code: true, account_code: true, is_active: true },
      }) ?? Promise.resolve([]),
    ]);

    const catalogo: CatalogAccount[] = cuentas.map((c) => ({
      code: c.code,
      name: c.name,
      parentCode: c.parent_code,
      isActive: c.is_active,
    }));

    const issuesReglas = checkRules(
      catalogo,
      reglas.map((r) => ({
        process_code: r.process_code,
        document_type: r.document_type,
        line_order: r.line_order,
        account_code: r.account_code,
        side: r.side,
        is_active: r.is_active,
      })),
    );

    // Los mapeos (proceso/rol → cuenta) también pueden apuntar a cuentas
    // inexistentes o agregadas: el puente de ventas los usa como respaldo del
    // costo, y un mapeo inválido se ignora en silencio.
    const agregadas = cuentasConHijos(catalogo);
    const issuesMapeos: IntegrityIssue[] = [];
    for (const mapeo of mapeos) {
      if (mapeo.is_active === false) continue;
      const issue = checkAccountCode(
        catalogo,
        mapeo.account_code,
        { process: `${mapeo.process_code}/${mapeo.role_code}` },
        agregadas,
      );
      if (issue) issuesMapeos.push(issue);
    }

    const asientos = await this.prisma.accountingEntry.findMany({
      where: { company_id: companyId, ...(period ? { period } : {}) },
      select: {
        id: true,
        entry_number: true,
        period: true,
        source_module: true,
        source_reference_id: true,
        total_debit: true,
        total_credit: true,
        status: true,
        lines: { select: { account_code: true, debit_amount: true, credit_amount: true } },
      },
      orderBy: [{ entry_date: 'desc' }, { entry_number: 'desc' }],
      take: MAX_ASIENTOS,
    });

    const descuadrados: AuditEntryIssue[] = [];
    const sinLineas: AuditEntryIssue[] = [];
    const conCuentaInvalida: Array<{ id: string; entryNumber: number; issues: IntegrityIssue[] }> = [];
    const referencias = new Map<string, number>();

    for (const asiento of asientos) {
      const debe = r2(asiento.lines.reduce((s, l) => s + Number(l.debit_amount), 0));
      const haber = r2(asiento.lines.reduce((s, l) => s + Number(l.credit_amount), 0));
      const base = {
        id: asiento.id,
        entryNumber: asiento.entry_number,
        period: asiento.period,
        sourceModule: asiento.source_module,
        sourceReferenceId: asiento.source_reference_id ?? null,
        debe,
        haber,
      };

      if (asiento.lines.length < 2) {
        sinLineas.push({ ...base, diferencia: r2(debe - haber), detalle: `el asiento tiene ${asiento.lines.length} línea(s)` });
      } else if (Math.abs(debe - haber) > 0.01) {
        descuadrados.push({
          ...base,
          diferencia: r2(debe - haber),
          detalle: `debe ${debe.toFixed(2)} contra haber ${haber.toFixed(2)}`,
        });
      } else if (
        Math.abs(Number(asiento.total_debit) - debe) > 0.01 ||
        Math.abs(Number(asiento.total_credit) - haber) > 0.01
      ) {
        descuadrados.push({
          ...base,
          diferencia: r2(debe - haber),
          detalle:
            `los totales guardados (${Number(asiento.total_debit).toFixed(2)}/${Number(asiento.total_credit).toFixed(2)}) ` +
            `no coinciden con sus líneas (${debe.toFixed(2)}/${haber.toFixed(2)})`,
        });
      }

      const invalidas = checkEntryLines(
        catalogo,
        asiento.lines.map((l) => ({ accountCode: l.account_code })),
      );
      if (invalidas.length > 0) {
        conCuentaInvalida.push({ id: asiento.id, entryNumber: asiento.entry_number, issues: invalidas });
      }

      if (asiento.status !== 'ANULADO' && asiento.source_reference_id) {
        const clave = `${asiento.source_module}|${asiento.source_reference_id}`;
        referencias.set(clave, (referencias.get(clave) ?? 0) + 1);
      }
    }

    const duplicados: AuditDuplicateIssue[] = [...referencias.entries()]
      .filter(([, cantidad]) => cantidad > 1)
      .map(([clave, cantidad]) => {
        const [sourceModule, sourceReferenceId] = clave.split('|');
        return {
          sourceModule,
          sourceReferenceId,
          asientos: cantidad,
          detalle: `${cantidad} asientos activos para ${sourceModule} ${sourceReferenceId}`,
        };
      });

    const rango = this.rangoDe(period);
    const comprobantes = await this.prisma.invoice.findMany({
      where: {
        company_id: companyId,
        // El puente contable procesa ACEPTADO y OBSERVADO: un comprobante
        // observado también debe tener asiento, y si falta es un pendiente real.
        estado: { in: ['ACEPTADO', 'OBSERVADO'] },
        tipo_comprobante: { in: ['01', '03', '07'] },
        ...(rango ? { fecha_emision: rango } : {}),
      },
      select: {
        id: true,
        serie: true,
        correlativo: true,
        tipo_comprobante: true,
        fecha_emision: true,
        monto_total: true,
      },
      orderBy: [{ fecha_emision: 'desc' }, { correlativo: 'desc' }],
      take: MAX_COMPROBANTES,
    });

    const numeros = comprobantes.map((c) => numeroDe(c.serie, c.correlativo));
    const referenciasBuscadas = [
      ...comprobantes.map((c) => c.id),
      ...comprobantes.map((c) => `${c.id}:COSTO`),
      ...numeros,
    ];

    const asientosDeComprobantes = referenciasBuscadas.length
      ? await this.prisma.accountingEntry.findMany({
          where: { company_id: companyId, source_reference_id: { in: referenciasBuscadas } },
          select: { source_reference_id: true, idempotency_key: true },
        })
      : [];

    const referenciasExistentes = new Set(
      asientosDeComprobantes.map((a) => a.source_reference_id).filter((v): v is string => Boolean(v)),
    );
    const clavesExistentes = new Set(
      asientosDeComprobantes.map((a) => a.idempotency_key).filter((v): v is string => Boolean(v)),
    );

    const movimientos = numeros.length
      ? await this.prisma.inventoryMovement.findMany({
          where: {
            company_id: companyId,
            operation_type_code: '01',
            source_reference_id: { in: numeros },
          },
          select: { source_reference_id: true, total_cost: true },
        })
      : [];

    const costoPorNumero = new Map<string, number>();
    for (const movimiento of movimientos) {
      const clave = movimiento.source_reference_id;
      if (!clave) continue;
      costoPorNumero.set(clave, r2((costoPorNumero.get(clave) ?? 0) + Number(movimiento.total_cost)));
    }

    const sinAsiento: AuditInvoiceIssue[] = [];
    const sinCosto: AuditInvoiceIssue[] = [];

    for (const c of comprobantes) {
      const numero = numeroDe(c.serie, c.correlativo);
      const tieneAsiento =
        referenciasExistentes.has(c.id) ||
        referenciasExistentes.has(numero) ||
        clavesExistentes.has(`m1:invoice:${c.id}`);
      const base = {
        id: c.id,
        numero,
        tipoComprobante: c.tipo_comprobante,
        fechaEmision: new Date(c.fecha_emision).toISOString().slice(0, 10),
        total: Number(c.monto_total),
      };

      if (!tieneAsiento) {
        sinAsiento.push({
          ...base,
          detalle: `comprobante aceptado sin asiento (período ${base.fechaEmision.slice(0, 7)})`,
        });
      }

      const costo = costoPorNumero.get(numero) ?? 0;
      if (
        (c.tipo_comprobante === '01' || c.tipo_comprobante === '03') &&
        costo > 0 &&
        !referenciasExistentes.has(`${c.id}:COSTO`)
      ) {
        sinCosto.push({
          ...base,
          detalle: `salió inventario por ${costo.toFixed(2)} sin asiento de costo`,
        });
      }
    }

    // Compras nacionales sin asiento. Hasta ahora la auditoría solo miraba los
    // comprobantes de venta: una compra registrada sin asiento (reglas COMPRA
    // incompletas) quedaba invisible y no había forma de reintentarla.
    const compras = await this.prisma.nationalPurchase.findMany({
      where: {
        company_id: companyId,
        status: { not: 'ANULADA' },
        ...(rango ? { issue_date: rango } : {}),
      },
      select: {
        id: true,
        purchase_number: true,
        document_serial: true,
        document_number: true,
        supplier_name: true,
        total_amount: true,
        issue_date: true,
      },
      orderBy: [{ issue_date: 'desc' }, { purchase_number: 'desc' }],
      take: MAX_COMPRAS,
    });

    const numerosCompra = compras.map((c) => c.purchase_number);
    const asientosDeCompras = numerosCompra.length
      ? await this.prisma.accountingEntry.findMany({
          where: {
            company_id: companyId,
            source_module: 'PURCHASES',
            source_reference_id: { in: numerosCompra },
          },
          select: { source_reference_id: true },
        })
      : [];
    const comprasConAsiento = new Set(
      asientosDeCompras.map((a) => a.source_reference_id).filter((v): v is string => Boolean(v)),
    );

    const comprasSinAsiento: AuditPurchaseIssue[] = compras
      .filter((c) => !comprasConAsiento.has(c.purchase_number))
      .map((c) => ({
        id: c.id,
        numero: c.purchase_number,
        documento: `${c.document_serial}-${c.document_number}`,
        proveedor: c.supplier_name,
        fecha: new Date(c.issue_date).toISOString().slice(0, 10),
        total: Number(c.total_amount),
        detalle: 'compra registrada sin asiento contable',
      }));

    // Cobros vivos sobre comprobantes ya anulados: si la venta se dio de baja
    // y el dinero sigue registrado como cobrado, la cartera y la tesorería
    // mienten. No se revierte nada automáticamente; se informa para que el
    // usuario decida (anular el cobro o emitir la devolución).
    const anuladas = await this.prisma.invoice.findMany({
      where: { company_id: companyId, estado: 'ANULADO' },
      select: { id: true, serie: true, correlativo: true },
      orderBy: [{ fecha_emision: 'desc' }],
      take: MAX_COMPROBANTES,
    });
    const idsAnuladas = anuladas.map((c) => c.id);
    const cobrosDeAnuladas = idsAnuladas.length
      ? await this.prisma.collection.findMany({
          where: {
            company_id: companyId,
            invoice_id: { in: idsAnuladas },
            status: { not: 'ANULADO' },
          },
          select: {
            id: true,
            invoice_id: true,
            invoice_number: true,
            customer_name: true,
            amount: true,
            collection_date: true,
          },
          orderBy: [{ collection_date: 'desc' }],
          take: MAX_COBROS,
        })
      : [];

    const numeroPorComprobante = new Map(
      anuladas.map((c) => [c.id, `${c.serie}-${String(c.correlativo).padStart(8, '0')}`]),
    );
    const cobrosHuerfanos: AuditCollectionIssue[] = cobrosDeAnuladas.map((c) => ({
      id: c.id,
      comprobante: numeroPorComprobante.get(c.invoice_id ?? '') ?? c.invoice_number ?? '',
      cliente: c.customer_name,
      fecha: new Date(c.collection_date).toISOString().slice(0, 10),
      monto: Number(c.amount),
      detalle: 'cobro registrado sobre un comprobante anulado',
    }));

    // Gastos registrados sin asiento: mismo caso que compras, y ya existe
    // `POST /expenses/:id/post` para reintentarlo.
    const gastos = await this.prisma.expense.findMany({
      where: {
        company_id: companyId,
        status: { not: 'ANULADO' },
        ...(rango ? { expense_date: rango } : {}),
      },
      select: {
        id: true,
        description: true,
        supplier_name: true,
        total_amount: true,
        expense_date: true,
        document_number: true,
      },
      orderBy: [{ expense_date: 'desc' }],
      take: MAX_GASTOS,
    });

    const asientosDeGastos = gastos.length
      ? await this.prisma.accountingEntry.findMany({
          where: {
            company_id: companyId,
            source_module: 'EXPENSES',
            source_reference_id: { in: gastos.map((g) => g.id) },
          },
          select: { source_reference_id: true },
        })
      : [];
    const gastosConAsiento = new Set(
      asientosDeGastos.map((a) => a.source_reference_id).filter((v): v is string => Boolean(v)),
    );
    const gastosSinAsiento: AuditExpenseIssue[] = gastos
      .filter((g) => !gastosConAsiento.has(g.id))
      .map((g) => ({
        id: g.id,
        descripcion: g.description,
        proveedor: g.supplier_name,
        documento: g.document_number ?? '',
        fecha: new Date(g.expense_date).toISOString().slice(0, 10),
        total: Number(g.total_amount),
        detalle: 'gasto registrado sin asiento contable',
      }));

    const erroresConfiguracion =
      issuesReglas.filter((i) => i.severity === 'ERROR').length +
      issuesMapeos.filter((i) => i.severity === 'ERROR').length;
    const avisosConfiguracion =
      issuesReglas.filter((i) => i.severity === 'WARN').length +
      issuesMapeos.filter((i) => i.severity === 'WARN').length;
    const erroresDatos =
      descuadrados.length + sinLineas.length + duplicados.length + conCuentaInvalida.length;
    const avisosDatos =
      sinAsiento.length +
      sinCosto.length +
      comprasSinAsiento.length +
      gastosSinAsiento.length +
      cobrosHuerfanos.length;
    const resumen = {
      errors: erroresConfiguracion + erroresDatos,
      warnings: avisosConfiguracion + avisosDatos,
    };

    return {
      companyId,
      period: period ?? null,
      generatedAt: new Date().toISOString(),
      ok: resumen.errors === 0,
      catalogo: {
        total: catalogo.length,
        activas: catalogo.filter((c) => c.isActive !== false).length,
      },
      reglas: {
        procesos: [...new Set(reglas.map((r) => r.process_code))].sort(),
        total: reglas.length,
        issues: issuesReglas,
      },
      mapeos: {
        total: mapeos.length,
        issues: issuesMapeos,
      },
      asientos: {
        revisados: asientos.length,
        truncado: asientos.length === MAX_ASIENTOS,
        descuadrados,
        sinLineas,
        duplicados,
        conCuentaInvalida,
      },
      comprobantes: {
        revisados: comprobantes.length,
        truncado: comprobantes.length === MAX_COMPROBANTES,
        sinAsiento,
        sinCosto,
      },
      compras: {
        revisadas: compras.length,
        truncado: compras.length === MAX_COMPRAS,
        sinAsiento: comprasSinAsiento,
      },
      gastos: {
        revisados: gastos.length,
        truncado: gastos.length === MAX_GASTOS,
        sinAsiento: gastosSinAsiento,
      },
      cobros: {
        deComprobantesAnulados: cobrosHuerfanos,
      },
      resumen,
    };
  }

  /** Rango `[inicio, fin)` del período `YYYY-MM` en hora de Lima. */
  private rangoDe(period?: string): { gte: Date; lt: Date } | null {
    if (!period || !/^\d{4}-(0[1-9]|1[0-2])$/.test(period)) return null;
    const year = Number(period.slice(0, 4));
    const month = Number(period.slice(5, 7)) - 1;
    return {
      gte: new Date(Date.UTC(year, month, 1, 5, 0, 0)),
      lt: new Date(Date.UTC(year, month + 1, 1, 5, 0, 0)),
    };
  }
}
