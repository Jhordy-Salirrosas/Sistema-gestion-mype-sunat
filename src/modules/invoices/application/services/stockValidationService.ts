/**
 * Validación de stock de los ítems del comprobante (TA-62, HU-10).
 *
 * Por qué existe: `InvoiceItem` ya guardaba `unit_code` y la cantidad, pero
 * nadie comparaba esa cantidad contra `InventoryBalance.current_stock`. Una
 * ferretería podía emitir una factura por 500 kg de clavos teniendo 20, SUNAT
 * la aceptaba (le importa el tributo, no el almacén) y el descuadre aparecía
 * semanas después al inventariar.
 *
 * Dos decisiones que no son obvias:
 *
 *  - Se valida contra `InventoryBalance` (el saldo por almacén) y no contra
 *    `InventoryProduct`, porque el producto no tiene stock propio: el stock
 *    vive en el saldo de cada almacén. Cuando la empresa tiene un solo
 *    almacén, el total coincide; se valida únicamente el almacén elegido.
 *
 *  - Un fallo de stock es un error de NEGOCIO, no del servidor. Se lanza una
 *    excepción con el detalle de qué producto falta, para que el front muestre
 *    la fila en rojo en lugar de un "500 Internal Server Error" que no dice
 *    nada útil a la cajera.
 */
import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../../database/prismaService';
import type { LineaDetalle } from '../../xmlNodesHelper';
import { Prisma } from '../../../../generated/client/client';

/** Ítem a validar: código del producto en el catálogo (SKU) y cantidad. */
export interface ItemAValidar {
  codigo?: string | null;
  descripcion: string;
  cantidad: number;
  unidad?: string;
  afectacion?: string | null;
}

/** Resultado de la validación de stock. */
export interface ResultadoStock {
  /** Ítems cuyo stock alcanza. */
  validados: number;
  /** Ítems sin `codigo`: no representan un producto del almacén (servicios). */
  omitidos: number;
  /**
   * Avisos que NO bloquean la emisión: por ejemplo un producto que no está en
   * el catálogo de la empresa. Bloquear por eso impediría facturar a quien
   * todavía no cargó su inventario.
   */
  avisos: string[];
}

/** Detalle de un faltante, para el mensaje de error. */
interface Faltante {
  descripcion: string;
  codigo: string;
  pedido: number;
  disponible: number;
  unidad: string;
}

@Injectable()
export class StockValidationService {
  private readonly logger = new Logger(StockValidationService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Comprueba que cada ítem con código de producto tenga stock suficiente.
   *
   * Se hace UNA sola consulta agregada para todos los códigos en lugar de una
   * por ítem: una factura de 40 líneas haría 40 consultas y el plazo del
   * mostrador es de segundos.
   *
   * @throws BadRequestException con el detalle de los faltantes.
   */
  async validar(companyId: string, items: ItemAValidar[], almacen = 'ALM-01'): Promise<ResultadoStock> {
    const conCodigo = items.filter(
      (item) => typeof item.codigo === 'string' && item.codigo.trim() !== '',
    );
    const omitidos = items.length - conCodigo.length;

    if (conCodigo.length === 0) {
      return { validados: 0, omitidos, avisos: [] };
    }

    const codigos = [...new Set(conCodigo.map((item) => item.codigo!.trim()))];

    // Saldo por SKU del almacén elegido. El filtro por
    // `company_id` es imprescindible: sin él se leería el stock de otra empresa
    // que use el mismo SKU (Anti-IDOR).
    const saldos = await this.prisma.inventoryBalance.groupBy({
      by: ['product_id'],
      where: {
        company_id: companyId,
        warehouse: { warehouse_code: almacen },
        product: { sku: { in: codigos }, is_active: true },
      },
      _sum: { current_stock: true },
    });

    const productos = await this.prisma.inventoryProduct.findMany({
      where: { company_id: companyId, sku: { in: codigos }, is_active: true },
      select: {
        id: true,
        sku: true,
        description: true,
        sunat_unit_code: true,
        tax_affectation: true,
        is_inventory: true,
      },
    });

    const stockPorSku = this.mapaDeStock(productos, saldos);
    const avisos: string[] = [];
    const faltantes: Faltante[] = [];

    const cantidades = new Map<string, Prisma.Decimal>();
    for (const item of conCodigo) {
      const sku = item.codigo!.trim();
      cantidades.set(sku, (cantidades.get(sku) ?? new Prisma.Decimal(0)).plus(item.cantidad));
    }
    const revisados = new Set<string>();
    for (const item of conCodigo) {
      const codigo = item.codigo!.trim();
      const entrada = stockPorSku.get(codigo);

      if (!entrada) {
        // Producto que no está en el inventario de la empresa: no se puede
        // afirmar nada sobre su stock, así que se avisa y se deja pasar.
        avisos.push(
          `El producto ${codigo} no está en el inventario: no se validó su stock`,
        );
        continue;
      }

      if (
        entrada.taxAffectation &&
        item.afectacion?.trim() &&
        item.afectacion.trim() !== entrada.taxAffectation
      ) {
        throw new BadRequestException(
          `La afectación tributaria del producto ${codigo} (${entrada.taxAffectation}) viene de su configuración y no coincide con la enviada (${item.afectacion.trim()}).`,
        );
      }

      const pedido = cantidades.get(codigo)!;
      if (!revisados.has(codigo) && entrada.isInventory && pedido.greaterThan(entrada.stock)) {
        faltantes.push({
          descripcion: entrada.descripcion,
          codigo,
          pedido: pedido.toNumber(),
          disponible: entrada.stock,
          unidad: item.unidad ?? entrada.unidad,
        });
      }
      revisados.add(codigo);
    }

    if (faltantes.length > 0) {
      const detalle = faltantes
        .map(
          (f) =>
            `${f.codigo} ${f.descripcion}: se pide ${f.pedido} ${f.unidad} y hay ${f.disponible}`,
        )
        .join('; ');

      throw new BadRequestException(
        `Stock insuficiente para emitir el comprobante: ${detalle}`,
      );
    }

    if (avisos.length > 0) {
      this.logger.warn(`[TA-62] ${avisos.join(' | ')}`);
    }

    return { validados: conCodigo.length - avisos.length, omitidos, avisos };
  }

  /** Une productos y saldos en un mapa por SKU. */
  private mapaDeStock(
    productos: Array<{
      id: string;
      sku: string;
      description: string;
      sunat_unit_code: string;
      tax_affectation?: string | null;
      is_inventory?: boolean;
    }>,
    saldos: Array<{ product_id: string; _sum: { current_stock: unknown } }>,
  ): Map<
    string,
    {
      descripcion: string;
      stock: number;
      unidad: string;
      taxAffectation: string | null;
      isInventory: boolean;
    }
  > {
    const totalPorProducto = new Map<string, number>();
    for (const saldo of saldos) {
      const valor = Number(saldo._sum.current_stock ?? 0);
      totalPorProducto.set(saldo.product_id, Number.isFinite(valor) ? valor : 0);
    }

    const mapa = new Map<
      string,
      {
        descripcion: string;
        stock: number;
        unidad: string;
        taxAffectation: string | null;
        isInventory: boolean;
      }
    >();
    for (const producto of productos) {
      mapa.set(producto.sku, {
        descripcion: producto.description,
        stock: totalPorProducto.get(producto.id) ?? 0,
        unidad: producto.sunat_unit_code,
        taxAffectation: producto.tax_affectation?.trim() || null,
        isInventory: producto.is_inventory !== false,
      });
    }
    return mapa;
  }

  /**
   * Convierte las líneas del payload UBL en ítems validables.
   *
   * Se expone aquí para que el caso de uso no tenga que saber cómo se llama el
   * campo del código en el modelo de líneas.
   */
  static itemsDesdeLineas(lineas: LineaDetalle[]): ItemAValidar[] {
    return lineas.map((linea) => ({
      codigo: linea.codigo ?? null,
      descripcion: linea.descripcion,
      cantidad: linea.cantidad,
      unidad: linea.unidad,
    }));
  }
}
