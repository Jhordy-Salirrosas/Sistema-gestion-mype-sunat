/**
 * Traducción del formulario de emisión al contrato fiscal (M1).
 *
 * Este archivo es la bisagra que faltaba. Recibe lo que el usuario escribió en
 * la pantalla y produce un `CreateInvoiceDto` con su `payload_ubl` completo,
 * listo para el mismo generador UBL que usa la integración por API.
 *
 * Es una función PURA a propósito: no consulta la base ni guarda nada. Así se
 * puede probar que una factura de 3 líneas produce el XML esperado sin montar
 * Nest, y el servicio que la llama se queda solo con el trabajo de buscar los
 * datos de la empresa y los correlativos.
 *
 * DECISIONES QUE NO SON OBVIAS
 *
 *  - **El total no se acepta, se calcula.** Si el cliente pudiera mandar el
 *    importe, el XML podría declarar ante SUNAT un total distinto de la suma de
 *    sus líneas. Se liquida línea por línea con el motor de impuestos y el
 *    resultado es lo que se declara.
 *
 *  - **El IGV se calcula por línea y se redondea por línea.** Redondear al
 *    final descuadra un céntimo en las facturas de muchas líneas pequeñas
 *    (diez líneas de S/ 0.33), y SUNAT compara el total con la suma de sus
 *    partes.
 *
 *  - **La detracción es de la línea, no del comprobante.** El docente lo señaló
 *    textualmente: "los productos son con detracción, no la factura". Solo las
 *    líneas con código del Catálogo 54 aportan a la base detraída.
 */
import type { CreateInvoiceDto } from '../dto/createInvoiceDto';
import type { EmitirComprobanteDto, LineaEmisionDto } from '../dto/emitirComprobanteDto';
import type { InvoicePayload } from '../../invoicePayload';
import type { LineaDetalle } from '../../xmlNodesHelper';
import { calcularRetencion, TASA_IGV } from '../../ublTotalesHelper';
import { porcentajeDetraccion, superaUmbralDetraccion } from '../../sunatCatalogsQuery';
import { importeEnLetras } from './importeEnLetras';

/** Datos del emisor que vienen de la empresa autenticada, no del formulario. */
export interface DatosEmisor {
  ruc: string;
  razonSocial: string;
  nombreComercial?: string;
  ubigeo?: string;
  direccion?: string;
  departamento?: string;
  provincia?: string;
  distrito?: string;
}

/** Lo que va a quedar en el comprobante, ya liquidado. */
export interface ComprobanteTraducido {
  dto: CreateInvoiceDto;
  /** Totales declarados, para que el llamador pueda mostrarlos sin recalcular. */
  importes: {
    gravado: number;
    igv: number;
    exonerado: number;
    inafecto: number;
    icbper: number;
    detraccion: number;
    retencion: number;
    total: number;
    importePagar: number;
  };
  /** Detalle por línea para la respuesta de la pantalla. */
  lineas: readonly LineaDetalle[];
  /** Avisos no bloqueantes (por ejemplo, un producto sin código de almacén). */
  avisos: readonly string[];
}

/** Redondeo monetario sin arrastrar error de coma flotante. */
const centimos = (valor: number): number => Math.round(valor * 100) / 100;

/** ¿La afectación es gratuita? No se cobra, pero sí se informa. */
const esGratuita = (afectacion: string): boolean => {
  const codigo = afectacion.trim();
  return (
    ['11', '12', '13', '14', '15', '16'].includes(codigo) ||
    codigo === '21' ||
    ['31', '32', '33', '34', '35', '36'].includes(codigo)
  );
};

/** Tributo del Catálogo 05 que corresponde a cada afectación. */
const tributoDe = (afectacion: string): string => {
  const dos = afectacion.trim().slice(0, 2);
  if (dos.startsWith('1')) return '1000'; // gravadas (10-17)
  if (['20', '21'].includes(dos)) return '9997'; // exoneradas
  if (['30', '31', '32', '33', '34', '35', '36', '37'].includes(dos)) {
    return '9998'; // inafectas
  }
  if (dos === '40') return '9995'; // exportación
  return '1000';
};

/** Liquidación de una línea. */
interface LineaLiquidada {
  linea: LineaDetalle;
  valorVenta: number;
  igv: number;
  icbper: number;
}

/**
 * Liquida una línea de la grilla.
 *
 * El valor unitario llega SIN IGV (es lo que se escribe en el mostrador como
 * "valor de venta"). El IGV de una gravada onerosa es el 18 % de su valor de
 * venta; una gratuita no cobra IGV pero declara su tributo referencial.
 */
const liquidarLinea = (item: LineaEmisionDto, indice: number): LineaLiquidada => {
  const afectacion = item.afectacion ?? '10';
  const unidad = (item.unidad ?? 'NIU').toUpperCase();
  const cantidad = item.cantidad;
  const valorVentaBruto = centimos(cantidad * item.valorUnitario);
  const gratuita = esGratuita(afectacion);

  // Regla 3278: una gratuita lleva LineExtensionAmount en 0 y su precio
  // unitario en cero. Declarar importe en una transferencia gratuita haría
  // creer a SUNAT que hubo una venta.
  const valorVenta = gratuita ? 0 : valorVentaBruto;
  const igv = !gratuita && tributoDe(afectacion) === '1000'
    ? centimos(valorVenta * TASA_IGV)
    : 0;

  /**
   * `totalLinea` va CON IGV incluido.
   *
   * El contrato no es obvio y confundirlo produce un rechazo de SUNAT con el
   * código 3103 ("MontoTributoCalculado 11.07 contra MontoTributo 13.50"):
   * `bloqueLinea` calcula la base como `totalLinea - igvLinea`, así que si aquí
   * se guardara el valor de venta SIN IGV, la base se quedaba corta y el IGV
   * declarado no cuadraba con base × 18 %.
   *
   * `ublGeneratorService` ya lo hace así (línea ~272: `montoGravado + igv`), y
   * ese es el contrato real. Se detectó emitiendo contra BETA el 31-10.
   */
  const linea: LineaDetalle = {
    id: indice + 1,
    descripcion: item.descripcion.trim(),
    codigo: item.codigo?.trim() || undefined,
    unidad,
    cantidad,
    valorUnitario: item.valorUnitario,
    precioUnitario: centimos(item.valorUnitario * (1 + TASA_IGV)),
    afectacion,
    totalLinea: centimos(valorVenta + igv),
    igvLinea: igv,
    icbperLinea: item.icbper && item.icbper > 0 ? centimos(item.icbper) : undefined,
  };

  return {
    linea,
    valorVenta,
    igv,
    icbper: linea.icbperLinea ?? 0,
  };
};

/**
 * Reparte las líneas entre las cuatro bases del comprobante.
 *
 * Se hace aquí y no con `calcularTotales` porque ese helper está pensado para
 * recibir los montos ya sumados; la pantalla necesita además las líneas del
 * XML. Ambas rutas deben coincidir, y hay una prueba que lo compara.
 */
const repartirBases = (liquidadas: readonly LineaLiquidada[]) => {
  const acumulado = {
    gravado: 0,
    igv: 0,
    exonerado: 0,
    inafecto: 0,
    exportado: 0,
    icbper: 0,
  };

  for (const { linea, valorVenta, igv, icbper } of liquidadas) {
    const tributo = tributoDe(linea.afectacion);
    if (tributo === '1000') {
      acumulado.gravado += valorVenta;
      acumulado.igv += igv;
    } else if (tributo === '9997') {
      acumulado.exonerado += valorVenta;
    } else if (tributo === '9998') {
      acumulado.inafecto += valorVenta;
    } else {
      acumulado.exportado += valorVenta;
    }
    acumulado.icbper += icbper;
  }

  return {
    gravado: centimos(acumulado.gravado),
    igv: centimos(acumulado.igv),
    exonerado: centimos(acumulado.exonerado),
    inafecto: centimos(acumulado.inafecto),
    exportado: centimos(acumulado.exportado),
    icbper: centimos(acumulado.icbper),
  };
};

/**
 * Base sujeta a detracción: solo las líneas con código del Catálogo 54.
 *
 * El umbral de S/ 700 se evalúa sobre el IMPORTE TOTAL de la operación, como
 * pide SUNAT, pero el porcentaje se aplica únicamente sobre la base de las
 * líneas sujetas. Si un flete está sujeto y el cemento no, se detrae el flete.
 */
const calcularDetraccion = (
  liquidadas: readonly LineaLiquidada[],
  dto: EmitirComprobanteDto,
  totalComprobante: number,
): number => {
  let baseSujeta = 0;

  for (let i = 0; i < liquidadas.length; i += 1) {
    const codigo = dto.items[i]?.codigoDetraccion?.trim();
    if (!codigo) continue;
    if (porcentajeDetraccion(codigo) === null) continue;
    baseSujeta += liquidadas[i].valorVenta;
  }

  if (baseSujeta <= 0) return 0;
  if (!superaUmbralDetraccion(totalComprobante)) return 0;

  // El porcentaje puede variar por línea; se aplica el de la primera línea
  // sujeta, que es lo que SUNAT admite: un comprobante tiene UNA detracción.
  const codigo = dto.items.find((i) => i.codigoDetraccion?.trim())?.codigoDetraccion;
  const porcentaje = codigo ? porcentajeDetraccion(codigo.trim()) : null;
  if (porcentaje === null) return 0;

  // Redondeo al entero: SUNAT no admite céntimos en la detracción.
  return Math.round(baseSujeta * porcentaje);
};

/**
 * Convierte el formulario en el DTO fiscal con su UBL.
 *
 * @param dto lo que escribió el usuario.
 * @param emisor datos de la empresa autenticada (nunca del formulario).
 * @param correlativo número ya reservado por `InvoiceSeriesService`.
 */
export const traducirEmision = (
  dto: EmitirComprobanteDto,
  emisor: DatosEmisor,
  correlativo: number,
): ComprobanteTraducido => {
  const avisos: string[] = [];
  const liquidadas = dto.items.map(liquidarLinea);
  const bases = repartirBases(liquidadas);

  const total = centimos(
    bases.gravado +
      bases.igv +
      bases.exonerado +
      bases.inafecto +
      bases.exportado +
      bases.icbper,
  );

  const detraccion = calcularDetraccion(liquidadas, dto, total);
  const retencion = dto.agente_retencion ? calcularRetencion(total) : 0;
  const importePagar = centimos(total - detraccion - retencion);

  // Aviso honesto: sin SKU no se puede mover el Kardex. No bloquea, porque un
  // servicio no tiene almacén, pero el usuario merece saberlo.
  const sinCodigo = dto.items.filter((i) => !i.codigo?.trim()).length;
  if (sinCodigo > 0 && dto.tipo_comprobante === '01') {
    avisos.push(
      `${sinCodigo} línea(s) sin código de producto: no generarán movimiento de Kardex.`,
    );
  }

  const fecha = (dto.fecha_emision ?? new Date().toISOString()).slice(0, 10);

  const payload: InvoicePayload = {
    rucEmisor: emisor.ruc,
    razonSocialEmisor: emisor.razonSocial,
    nombreComercialEmisor: emisor.nombreComercial,
    ubigeoEmisor: emisor.ubigeo,
    direccionEmisor: emisor.direccion,
    departamentoEmisor: emisor.departamento,
    provinciaEmisor: emisor.provincia,
    distritoEmisor: emisor.distrito,

    tipoComprobante: dto.tipo_comprobante,
    serie: dto.serie.toUpperCase(),
    numero: correlativo,
    fechaEmision: fecha,
    // TIPO DE OPERACIÓN (Catálogo 51).
    //
    // Una operación CON DETRACCIÓN no es una venta nacional normal: SUNAT exige
    // el código 1001 y, si se manda 0101 con un `PaymentTerms` de detracción,
    // rechaza con el 3128 ("información de código de bien y servicio de
    // detracción que no corresponde al tipo de operación"). Se detectó emitiendo
    // contra BETA el 31-10, después de corregir el importe total.
    tipoOperacion: detraccion > 0 ? '1001' : '0101',
    formaPago: dto.forma_pago ?? 'Contado',
    tipoMoneda: 'PEN',

    // Los montos agregados y el detalle por línea viajan juntos para que el
    // generador no tenga que elegir entre dos fuentes de verdad.
    montoGravado: bases.gravado,
    montoIgv: bases.igv,
    montoTotal: total,
    lineasTributarias: liquidadas.map(({ linea, valorVenta, igv, icbper }) => ({
      afectacion: linea.afectacion,
      valorVenta,
      igv,
      icbper: icbper > 0 ? icbper : undefined,
    })),

    codigoDetraccion: detraccion > 0
      ? dto.items.find((i) => i.codigoDetraccion?.trim())?.codigoDetraccion
      : undefined,
    montoDetraccion: detraccion > 0 ? detraccion : undefined,
    montoRetencion: retencion > 0 ? retencion : undefined,
    /**
     * Leyenda 2006: el importe en letras.
     *
     * SUNAT la exige cuando el comprobante lleva detracción y lo deja con la
     * observación 4265 si falta:
     *   "4265 - El XML no contiene el codigo de leyenda 2006 para tipo de
     *    operacion de detracciones"
     *
     * El generador ya sabía emitir el bloque, pero solo si recibía este campo, y
     * nadie lo calculaba: las facturas con detracción salían
     * ACEPTADAS_CON_OBSERVACIONES. Se descubrió leyendo el CDR descargado el
     * 31-10.
     */
    montoEnLetras: detraccion > 0 ? importeEnLetras(total) : undefined,
    /**
     * Cuenta del Banco de la Nación para depositar la detracción.
     *
     * SUNAT la exige cuando el comprobante lleva detracción: sin ella responde
     * con el código 3034 "El xml no contiene el tag o no existe información en el
     * nro de cuenta de detracción". Se descubrió emitiendo contra BETA el 31-10.
     *
     * Viene del DTO porque la cuenta es del EMISOR y no del comprobante: hasta
     * que la empresa no la configure no hay forma de inventarla, así que si falta
     * el XML queda incompleto y el rechazo de SUNAT lo dice con claridad.
     */
    cuentaBancoNacion: dto.cuenta_banco_nacion?.trim() || undefined,

    cliente: dto.customer_identity_number
      ? {
          tipoDocumento:
            dto.customer_identity_type ??
            (dto.tipo_comprobante === '01' ? '6' : '1'),
          numeroDocumento: dto.customer_identity_number.replace(/\D/g, ''),
          razonSocial: dto.customer_legal_name.trim(),
        }
      : undefined,

    lineas: liquidadas.map((l) => l.linea),

    documentoAfectado: dto.documento_afectado,
    codigoMotivoNota: dto.codigo_motivo_nota,
    descripcionMotivoNota: dto.descripcion_motivo_nota,
  };

  const createDto: CreateInvoiceDto = {
    ruc_emisor: emisor.ruc,
    serie: payload.serie,
    correlativo,
    tipo_comprobante: dto.tipo_comprobante,
    monto_total: total,
    fecha_emision: new Date(`${fecha}T00:00:00Z`).toISOString(),
    payload_ubl: payload as unknown as Record<string, unknown>,
    customer_identity_type: dto.customer_identity_type,
    customer_identity_number: dto.customer_identity_number,
    customer_legal_name: dto.customer_legal_name.trim(),
  };

  return {
    dto: createDto,
    importes: {
      gravado: bases.gravado,
      igv: bases.igv,
      exonerado: bases.exonerado,
      inafecto: bases.inafecto,
      icbper: bases.icbper,
      detraccion,
      retencion,
      total,
      importePagar,
    },
    lineas: liquidadas.map((l) => l.linea),
    avisos,
  };
};
