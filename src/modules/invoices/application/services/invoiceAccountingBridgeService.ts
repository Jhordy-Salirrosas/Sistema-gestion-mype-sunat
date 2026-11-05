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
import { CUENTAS_VENTA, balanceAsiento, lineasAsientoVenta, periodoDe } from './accountingBridge';
import { movimientosDeFactura, type LineaParaKardex } from './kardexBridge';

/** Módulo que se escribe en `source_module` del asiento. */
export const MODULO_ORIGEN = 'M1_INVOICES';

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
  };
  /** Motivo para no generar asiento automático; el Kardex sigue su curso. */
  motivoBloqueoAsiento?: string | null;
  /** Código de almacén de origen del stock; por defecto usa el del sistema. */
  almacen?: string;
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
        source_module: MODULO_ORIGEN,
        source_reference_id: numero,
      },
      select: { id: true },
    });

    if (existente) {
      return { asientoId: existente.id, asientoOmitido: true };
    }

    const lineas = lineasAsientoVenta(factura.importes);
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
        sourceReferenceId: numero,
        lines: lineas.map((l) => ({ ...l })),
      });

      return { asientoId: asiento.id, asientoOmitido: false };
    } catch (error) {
      errores.push(`Contabilidad: ${(error as Error).message}`);
      return { asientoOmitido: false };
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
