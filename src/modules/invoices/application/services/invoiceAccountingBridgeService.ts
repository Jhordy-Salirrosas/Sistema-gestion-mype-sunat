/**
 * Puente facturación → Kardex + Contabilidad (TA-68, HU-12).
 *
 * Cuando una factura queda ACEPTADA por SUNAT hay que mover dos cosas fuera del
 * módulo de facturación: el stock (Kardex, tabla 12 del PLE) y el asiento
 * contable (registro de ventas, formato 14.1). Antes de este servicio nada del
 * módulo de facturación tocaba `InventoryMovement` ni `AccountingEntry`: el
 * documento existía y la contabilidad no se enteraba.
 *
 * Decisiones que importan:
 *
 *  1. **No reimplementa nada.** Inyecta `RegisterManualMovementUseCase` y
 *     `GenerateAccountingEntryUseCase`, que ya aplican el promedio ponderado y
 *     la partida doble. Duplicar esa lógica crearía dos verdades sobre el stock.
 *  2. **Es idempotente por diseño.** El movimiento de inventario tiene
 *     `@@unique([company_id, source_reference_id, operation_type_code, product_id])`,
 *     así que el servicio consulta la referencia antes de insertar y se salta
 *     las líneas ya registradas. Reprocesar una factura no duplica el Kardex.
 *  3. **No tumba la factura.** La factura ya está aceptada por SUNAT: si el
 *     asiento falla, el documento fiscal es válido y el fallo es contable. Se
 *     devuelve el detalle del error en el resultado para que se reintente, en
 *     lugar de lanzar una excepción que haría creer que la emisión falló.
 */
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../../database/prismaService';
import { RegisterManualMovementUseCase } from '../../../inventory/application/use-cases/registerManualMovementUseCase';
import { GenerateAccountingEntryUseCase } from '../../../accounting/application/use-cases/generateAccountingEntryUseCase';
import { CUENTAS_VENTA, balanceAsiento, lineasAsientoNotaCredito, lineasAsientoVenta, periodoDe } from './accountingBridge';
import { movimientosDeFactura, type LineaParaKardex } from './kardexBridge';

/** Módulo que se escribe en `source_module` del asiento. */
export const MODULO_ORIGEN = 'M1_INVOICES';
export const claveAsientoM1 = (invoiceId: string) => `m1:invoice:${invoiceId}`;

/** Resultado del puente; nunca lanza, siempre informa. */
export interface ResultadoPuente {
  /** Movimientos de Kardex registrados en esta pasada. */
  movimientosRegistrados: number;
  /** Líneas que ya tenían su movimiento (reproceso). */
  movimientosOmitidos: number;
  /** Identificador del asiento contable, si se pudo crear. */
  asientoId?: string;
  /** ¿El asiento ya existía y no se duplicó? */
  asientoOmitido: boolean;
  /** Asiento de costo de ventas, si se pudo determinar el costo. */
  asientoCostoId?: string;
  /** Costo total contabilizado. */
  costoVenta?: number;
  /** Errores no bloqueantes, con la fase en la que ocurrieron. */
  errores: readonly string[];
  /** ¿Se completaron las dos partes? */
  completo: boolean;
}

/** Factura mínima que necesita el puente. */
export interface FacturaParaPuente {
  id: string;
  companyId: string;
  tipoComprobante: string;
  serie: string;
  correlativo: number;
  fechaEmision: string;
  /** Número del comprobante tal como se emitió (serie-correlativo). */
  numeroCompleto?: string;
  moneda?: string;
  cliente?: { razonSocial?: string };
  items: readonly LineaParaKardex[];
  /**
   * Importes ya liquidados. Los calcula quien llama con `UblGeneratorService`,
   * para que el asiento use exactamente las mismas cifras que el XML enviado a
   * SUNAT y no una segunda liquidación que podría diferir.
   */
  importes: {
    gravado: number;
    igv: number;
    exonerado: number;
    inafecto: number;
    icbper: number;
    detraccion: number;
    retencion: number;
    total: number;
    descuentoNoAfecto?: number;
  };
  /** Motivo para no generar asiento automático; el Kardex sigue su curso. */
  motivoBloqueoAsiento?: string | null;
  /** Código de almacén de origen del stock; por defecto usa el del sistema. */
  almacen?: string;
  /** Motivo Catálogo 09 SUNAT si es Nota de Crédito. */
  motivoNota?: string;
}

@Injectable()
export class InvoiceAccountingBridgeService {
  private readonly logger = new Logger(InvoiceAccountingBridgeService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly registroMovimientos: RegisterManualMovementUseCase,
    private readonly generadorAsientos: GenerateAccountingEntryUseCase,
  ) {}

  /**
   * Registra el Kardex y el asiento de una factura.
   *
   * @param factura comprobante con sus líneas e importes ya liquidados.
   */
  public async registrar(factura: FacturaParaPuente): Promise<ResultadoPuente> {
    const errores: string[] = [];
    const numero =
      factura.numeroCompleto ??
      `${factura.serie}-${String(factura.correlativo).padStart(8, '0')}`;

    const kardex = await this.registrarKardex(factura, numero, errores);
    const contabilidad = factura.motivoBloqueoAsiento
      ? (errores.push(factura.motivoBloqueoAsiento), { asientoOmitido: true })
      : await this.registrarAsiento(factura, numero, errores);

    const costo = factura.motivoBloqueoAsiento || !['01', '03'].includes(factura.tipoComprobante)
      ? {}
      : await this.registrarCostoVenta(factura, numero, errores);

    const completo = errores.length === 0;

    if (!completo) {
      // Se registra en el log del worker para que el reintento tenga contexto.
      this.logger.warn(
        `Puente contable incompleto para ${numero}: ${errores.join(' | ')}`,
      );
    }

    return {
      ...kardex,
      ...contabilidad,
      ...costo,
      errores,
      completo,
    };
  }

  /** Escribe los movimientos de salida de almacén que falten. */
  private async registrarKardex(
    factura: FacturaParaPuente,
    numero: string,
    errores: string[],
  ): Promise<{ movimientosRegistrados: number; movimientosOmitidos: number }> {
    const pendientes = movimientosDeFactura(factura.items, {
      tipoComprobante: factura.tipoComprobante,
      serie: factura.serie,
      correlativo: factura.correlativo,
      fechaEmision: factura.fechaEmision,
      almacen: factura.almacen,
      motivoNota: factura.motivoNota,
    });

    let registrados = 0;
    let omitidos = 0;

    for (const movimiento of pendientes) {
      const sku = movimiento.sku;

      // Idempotencia: el modelo tiene un índice único por (company, referencia,
      // operación, producto). Se comprueba antes para no depender de capturar un
      // error de constraint.
      const yaRegistrado = await this.existeMovimiento(
        factura.companyId,
        numero,
        sku,
      );

      if (yaRegistrado === null) {
        // El SKU no existe en el inventario de la empresa: la línea no se puede
        // mover y hay que decirlo. Silenciarlo dejaría el Kardex incompleto sin
        // que nadie lo sepa; tratarlo como error fatal tumbaría un asiento que
        // sí es correcto.
        errores.push(
          `Kardex ${sku}: el producto no existe en el inventario de la empresa, ` +
            'así que la línea no genera movimiento de almacén.',
        );
        continue;
      }

      if (yaRegistrado) {
        omitidos += 1;
        continue;
      }

      try {
        await this.registroMovimientos.execute(movimiento, factura.companyId);
        registrados += 1;
      } catch (error) {
        // Un SKU que no existe en el inventario no invalida la factura: es un
        // producto que no se controla por almacén. Se informa y se sigue.
        errores.push(
          `Kardex ${sku}: ${(error as Error).message}`,
        );
      }
    }

    return { movimientosRegistrados: registrados, movimientosOmitidos: omitidos };
  }

  /** Crea el asiento contable si esa factura no tiene uno ya. */
  private async registrarAsiento(
    factura: FacturaParaPuente,
    numero: string,
    errores: string[],
  ): Promise<{ asientoId?: string; asientoOmitido: boolean }> {
    const existente = await this.prisma.accountingEntry.findFirst({
      where: {
        company_id: factura.companyId,
        OR: [
          { idempotency_key: claveAsientoM1(factura.id) },
          { source_module: MODULO_ORIGEN, source_reference_id: numero },
          { source_module: MODULO_ORIGEN, source_reference_id: factura.id },
          { source_module: 'INVOICES', source_reference_id: factura.id },
        ],
      },
      select: { id: true },
    });

    if (existente) {
      return { asientoId: existente.id, asientoOmitido: true };
    }

    const i = factura.importes;
    const descuento = Math.round(
      (i.gravado + i.igv + i.exonerado + i.inafecto + i.icbper - i.total) * 100,
    ) / 100;
    const mappings = (await (this.prisma as any).accountingMapping?.findMany({
      where: { company_id: factura.companyId, process_code: 'VENTA', is_active: true },
    })) ?? [];
    const roles = new Map<string, string>(mappings.map((m: any) => [m.role_code, m.account_code]));
    const cuentas = {
      ...(roles.get('CXC') ? { porCobrar: { codigo: roles.get('CXC')!, nombre: 'Cuentas por cobrar' } } : {}),
      ...(roles.get('IGV') ? { igv: { codigo: roles.get('IGV')!, nombre: 'IGV - Cuenta propia' } } : {}),
      ...(roles.get('VENTA_GRAVADA') ? { gravada: { codigo: roles.get('VENTA_GRAVADA')!, nombre: 'Ventas gravadas' } } : {}),
      ...(roles.get('VENTA_EXONERADA') ? { exonerada: { codigo: roles.get('VENTA_EXONERADA')!, nombre: 'Ventas exoneradas' } } : {}),
      ...(roles.get('VENTA_INAFECTA') ? { inafecta: { codigo: roles.get('VENTA_INAFECTA')!, nombre: 'Ventas inafectas' } } : {}),
      ...(roles.get('ICBPER') ? { icbper: { codigo: roles.get('ICBPER')!, nombre: 'ICBPER por pagar' } } : {}),
      ...(roles.get('DETRACCION') ? { detraccion: { codigo: roles.get('DETRACCION')!, nombre: 'Cuentas por cobrar - detracciones' } } : {}),
      ...(roles.get('RETENCION') ? { porCobrarRetenido: { codigo: roles.get('RETENCION')!, nombre: 'IGV - Retenciones' } } : {}),
      ...(roles.get('DESCUENTO') ? { descuento: { codigo: roles.get('DESCUENTO')!, nombre: 'Descuentos concedidos' } } : {}),
    };
    const datos = { ...i, descuento: descuento > 0 ? descuento : 0, cuentas };
    const lineas = factura.tipoComprobante === '07'
      ? lineasAsientoNotaCredito(datos)
      : lineasAsientoVenta(datos);
    const balance = balanceAsiento(lineas);

    if (!balance.cuadra) {
      // Se avisa con las cifras en lugar de dejar que la partida doble falle
      // con "no cuadra" sin decir cuánto falta ni de qué lado.
      errores.push(
        `Contabilidad: el asiento no cuadra (debe ${balance.debe.toFixed(2)} ` +
          `contra haber ${balance.haber.toFixed(2)}).`,
      );
      return { asientoOmitido: false };
    }

    try {
      const asiento = await this.generadorAsientos.execute({
        companyId: factura.companyId,
        period: periodoDe(factura.fechaEmision),
        entryDate: new Date(`${factura.fechaEmision}T00:00:00Z`).toISOString(),
        glosa: this.glosaDe(factura, numero),
        sourceModule: MODULO_ORIGEN,
        sourceReferenceId: factura.id,
        idempotencyKey: claveAsientoM1(factura.id),
        lines: lineas.map((l) => ({ ...l })),
      });

      return { asientoId: asiento.id, asientoOmitido: false };
    } catch (error) {
      errores.push(`Contabilidad: ${(error as Error).message}`);
      return { asientoOmitido: false };
    }
  }

  /** Contabiliza el costo de las salidas de almacén de la factura. */
  private async registrarCostoVenta(
    factura: FacturaParaPuente,
    numero: string,
    errores: string[],
  ): Promise<{ asientoCostoId?: string; costoVenta?: number }> {
    const referencia = `${factura.id}:COSTO`;
    const existente = await this.prisma.accountingEntry.findFirst({
      where: { company_id: factura.companyId, source_module: MODULO_ORIGEN, source_reference_id: referencia },
      select: { id: true },
    });
    if (existente) return { asientoCostoId: existente.id };

    const movimientos = await this.prisma.inventoryMovement.findMany({
      where: { company_id: factura.companyId, source_reference_id: numero, operation_type_code: '01' },
      select: { quantity: true, previous_unit_cost: true },
    });
    const costo = Math.round(movimientos.reduce((sum, m) => sum + Number(m.quantity) * Number(m.previous_unit_cost), 0) * 100) / 100;
    if (costo <= 0) return { costoVenta: 0 };

    const mappings = (await (this.prisma as any).accountingMapping?.findMany({
      where: { company_id: factura.companyId, process_code: 'VENTA', is_active: true },
    })) ?? [];
    const roles = new Map<string, string>(mappings.map((m: any) => [m.role_code, m.account_code]));
    try {
      const asiento = await this.generadorAsientos.execute({
        companyId: factura.companyId,
        period: periodoDe(factura.fechaEmision),
        entryDate: new Date(`${factura.fechaEmision}T00:00:00Z`).toISOString(),
        glosa: `Costo de ventas según ${numero}`,
        sourceModule: MODULO_ORIGEN,
        sourceReferenceId: referencia,
        idempotencyKey: `m1:invoice-cost:${factura.id}`,
        lines: [
          { lineOrder: 1, accountCode: roles.get('COSTO_VENTA') || '691', accountName: 'Costo de ventas', debitAmount: costo, creditAmount: 0 },
          { lineOrder: 2, accountCode: roles.get('INVENTARIO') || '201', accountName: 'Mercaderías', debitAmount: 0, creditAmount: costo },
        ],
      });
      return { asientoCostoId: asiento.id, costoVenta: costo };
    } catch (error) {
      errores.push(`Costo de ventas: ${(error as Error).message}`);
      return { costoVenta: costo };
    }
  }

  /**
   * ¿Ya existe el movimiento de venta de este producto para esta factura?
   *
   * Se busca por el número de documento completo, que es lo que el puente
   * escribe en `source_reference_id` a través del repositorio de inventario.
   *
   * Devuelve `null` cuando el SKU no está en el inventario de la empresa: eso no
   * es un duplicado ni un "no hay movimiento previo", es la señal de que la
   * línea no se puede mover a un almacén y hay que avisarlo.
   */
  private async existeMovimiento(
    companyId: string,
    numeroDocumento: string,
    sku: string,
  ): Promise<boolean | null> {
    const producto = await this.prisma.inventoryProduct.findFirst({
      where: { company_id: companyId, sku },
      select: { id: true },
    });

    // Si el producto no existe, el caso de uso fallará y el mensaje dirá qué
    // SKU falta; aquí solo se descarta el duplicado sobre un producto real.
    // Se devuelve `null` (no `false`) porque "no está en el inventario" no es
    // lo mismo que "no hay movimiento previo", y el llamador necesita
    // distinguirlo para avisarlo.
    if (!producto) return null;

    const movimiento = await this.prisma.inventoryMovement.findFirst({
      where: {
        company_id: companyId,
        source_reference_id: numeroDocumento,
        operation_type_code: '01',
        product_id: producto.id,
      },
      select: { id: true },
    });

    return movimiento !== null;
  }

  /** Glosa del asiento: describe el documento sin superar el largo de columna. */
  private glosaDe(factura: FacturaParaPuente, numero: string): string {
    const cliente = factura.cliente?.razonSocial?.trim() || 'cliente';
    const glosa = `Venta según ${numero} a ${cliente}`;
    return glosa.length > 200 ? `${glosa.slice(0, 197)}...` : glosa;
  }
}

/** Las cuentas usadas se reexportan para documentar el asiento en los tests. */
export { CUENTAS_VENTA };
