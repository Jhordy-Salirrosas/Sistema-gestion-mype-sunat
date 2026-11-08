import { multiplicarMoneda, dividirMoneda, dividirUnitario } from '../../money';
import { redondearMoneda as centimos } from '../../money';
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
import { BadRequestException } from '@nestjs/common';
import type { CreateInvoiceDto } from '../dto/createInvoiceDto';
import type { EmitirComprobanteDto, LineaEmisionDto } from '../dto/emitirComprobanteDto';
import type { InvoicePayload } from '../../invoicePayload';
import type { LineaDetalle } from '../../xmlNodesHelper';
import { calcularRetencion, TASA_IGV } from '../../ublTotalesHelper';
import { tributoDeAfectacion, porcentajeDetraccion, superaUmbralDetraccion } from '../../sunatCatalogsQuery';
import { importeEnLetras } from './importeEnLetras';
import { numeroDeCuota } from './paymentTermsAndSpotValidator';
import { aplicarDescuentoGlobal } from './descuentoGlobal';
import { validarMedioPagoDetraccionEmision } from './validarMedioPagoDetraccion';

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
  descuentoNoAfecto: number;
}

/**
 * Liquida una línea de la grilla.
 *
 * El precio unitario de venta incluye IGV. La base unitaria conserva precisión
 * y solo los importes de línea se redondean a céntimos. El IGV de una gravada onerosa es el 18 % de su valor de
 * venta; una gratuita no cobra IGV pero declara su tributo referencial.
 */
const liquidarLinea = (item: LineaEmisionDto, indice: number): LineaLiquidada => {
  const afectacion = item.afectacion;
  if (!afectacion || !tributoDeAfectacion(afectacion)) throw new BadRequestException('La línea requiere afectación tributaria registrada');
  const unidad = (item.unidad ?? 'NIU').toUpperCase();
  const cantidad = item.cantidad;
  const gratuita = esGratuita(afectacion);
  const gravada = !gratuita && tributoDe(afectacion) === '1000';
  const tienePrecioConIgv =
    typeof item.precioUnitario === 'number' && Number.isFinite(item.precioUnitario);

  // Cuando llega `precioUnitario` (precio final con IGV incluido digitado en la venta),
  // jamás se trata como base sin impuesto: en operaciones gravadas se desglosa la base
  // dividiendo entre (1 + TASA_IGV) y el total de la línea preserva el precio con IGV.
  const precioUnitarioEfectivo = tienePrecioConIgv
    ? item.precioUnitario!
    : gravada
      ? centimos(item.valorUnitario * (1 + TASA_IGV))
      : item.valorUnitario ?? 0;

  const valorUnitarioEfectivo = tienePrecioConIgv
    ? gravada
      ? dividirUnitario(item.precioUnitario!, 1 + TASA_IGV)
      : item.precioUnitario!
    : item.valorUnitario ?? 0;

  const totalBrutoConIgv = tienePrecioConIgv
    ? multiplicarMoneda(cantidad, item.precioUnitario!)
    : null;
  const valorVentaBruto =
    tienePrecioConIgv && gravada
      ? dividirMoneda(totalBrutoConIgv!, 1 + TASA_IGV)
      : multiplicarMoneda(cantidad, valorUnitarioEfectivo);

  // Regla 3278: una gratuita lleva LineExtensionAmount en 0 y su precio
  // unitario en cero. Declarar importe en una transferencia gratuita haría
  // creer a SUNAT que hubo una venta.
  const descuento = item.descuento;
  if (descuento && (gratuita || !Number.isFinite(descuento.monto) || descuento.monto <= 0 || descuento.monto > valorVentaBruto || !['00', '01'].includes(descuento.codigo))) {
    throw new BadRequestException(`Descuento inválido en la línea ${indice + 1}`);
  }
  const valorVenta = gratuita ? 0 : centimos(valorVentaBruto - (descuento?.codigo === '00' ? descuento.monto : 0));
  const totalLineaSinDescuento =
    !gratuita && tienePrecioConIgv && !descuento
      ? totalBrutoConIgv!
      : null;
  const igv = gravada
    ? totalLineaSinDescuento !== null
      ? centimos(totalLineaSinDescuento - valorVenta)
      : multiplicarMoneda(valorVenta, TASA_IGV)
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
  // El importe legado solo se acepta si coincide con cantidades comprobables.
  const bolsas = item.cantidadBolsas ?? ((item.icbper ?? 0) > 0 ? cantidad : 0);
  if (!Number.isSafeInteger(bolsas) || bolsas < 0) throw new BadRequestException('ICBPER requiere cantidad entera de bolsas');
  const icbper = multiplicarMoneda(bolsas, 0.5);
  if (item.icbper !== undefined && item.icbper !== icbper) throw new BadRequestException('ICBPER no coincide con la cantidad de bolsas');
  const linea: LineaDetalle = {
    id: indice + 1,
    descripcion: item.descripcion.trim(),
    codigo: item.codigo?.trim() || undefined,
    unidad,
    cantidad,
    valorUnitario: valorUnitarioEfectivo,
    precioUnitario: precioUnitarioEfectivo,
    afectacion,
    totalLinea: totalLineaSinDescuento !== null ? totalLineaSinDescuento : centimos(valorVenta + igv),
    igvLinea: igv,
    descuentos: descuento ? [{ codigo: descuento.codigo, monto: descuento.monto }] : undefined,
    icbperLinea: icbper > 0 ? icbper : undefined,
    cantidadBolsas: bolsas > 0 ? bolsas : undefined,
  };

  return {
    linea,
    valorVenta,
    igv,
    icbper: linea.icbperLinea ?? 0,
    descuentoNoAfecto: descuento?.codigo === '01' ? descuento.monto : 0,
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
 * pide SUNAT, pero el porcentaje se aplica únicamente sobre el importe con tributos de las
 * líneas sujetas. Si un flete está sujeto y el cemento no, se detrae el flete.
 */
const calcularDetraccion = (
  liquidadas: readonly LineaLiquidada[],
  dto: EmitirComprobanteDto,
  totalComprobante: number,
  baseGravadaOriginal: number,
  totalAntesGlobal: number,
): number => {
  let baseSujeta = 0;

  for (let i = 0; i < liquidadas.length; i += 1) {
    const codigo = dto.items[i]?.codigoDetraccion?.trim();
    if (!codigo) continue;
    if (porcentajeDetraccion(codigo) === null) continue;
    baseSujeta += liquidadas[i].valorVenta + liquidadas[i].igv + liquidadas[i].icbper - liquidadas[i].descuentoNoAfecto;
  }

  const global = dto.descuento_global;
  if (global?.codigo === '02' && baseGravadaOriginal > 0) {
    const gravadaSujeta = liquidadas.reduce((suma, l, i) => suma + (dto.items[i]?.codigoDetraccion && porcentajeDetraccion(dto.items[i].codigoDetraccion!.trim()) !== null && tributoDe(l.linea.afectacion) === '1000' ? l.valorVenta : 0), 0);
    baseSujeta -= centimos(global.monto * (gravadaSujeta / baseGravadaOriginal) * (1 + TASA_IGV));
  } else if (global?.codigo === '03' && totalAntesGlobal > 0) {
    baseSujeta -= centimos(global.monto * baseSujeta / totalAntesGlobal);
  }
  if (baseSujeta <= 0) return 0;
  if (!superaUmbralDetraccion(totalComprobante)) return 0;

  // El porcentaje puede variar por línea; se aplica el de la primera línea
  // sujeta, que es lo que SUNAT admite: un comprobante tiene UNA detracción.
  const codigo = dto.items.find((i) => i.codigoDetraccion?.trim())?.codigoDetraccion;
  const porcentaje = codigo ? porcentajeDetraccion(codigo.trim()) : null;
  if (porcentaje === null) return 0;

  // Preservar los céntimos del importe sujeto.
  return centimos(baseSujeta * porcentaje);
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
  const liquidadas = dto.items.map((item, indice) => liquidarLinea(item, indice));
  const originales = repartirBases(liquidadas);
  const descuentoLineaNoAfecto = liquidadas.reduce((suma, l) => suma + l.descuentoNoAfecto, 0);
  const antesGlobal = aplicarDescuentoGlobal(originales, null, descuentoLineaNoAfecto);
  const global = aplicarDescuentoGlobal(originales, dto.descuento_global, descuentoLineaNoAfecto);
  const bases = global.bases;
  const total = global.total;

  const detraccion = calcularDetraccion(liquidadas, dto, total, originales.gravado, antesGlobal.total);
  validarMedioPagoDetraccionEmision(dto.medio_pago_detraccion, detraccion > 0);
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
    // Cronograma de la venta al crédito. El DTO llega con `{monto, vencimiento}`
    // y el generador UBL necesita el número de cuota (Cuota001...) que es lo
    // que se escribe en el XML. Se numera aquí y no en el front para que la
    // numeración sea consecutiva aunque el cliente mande el arreglo desordenado.
    cuotas: (dto.cuotas ?? []).map((c, i) => ({
      numero: numeroDeCuota(i + 1),
      monto: c.monto,
      vencimiento: c.vencimiento,
    })),
    tipoMoneda: 'PEN',

    // Los montos agregados y el detalle por línea viajan juntos para que el
    // generador no tenga que elegir entre dos fuentes de verdad.
    montoGravado: bases.gravado,
    montoIgv: bases.igv,
    montoTotal: total,
    montoTotalIncluyeIcbper: true,
    descuentoGlobal: dto.descuento_global ?? null,
    baseDescuentoGlobal: global.baseDescuento,
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
    ...(dto.medio_pago_detraccion !== undefined
      ? { medioPagoDetraccion: dto.medio_pago_detraccion }
      : {}),
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
    // Referencia para notas de crédito y débito. Se copia a sus columnas porque
    // la bandeja no lee el `payload_ubl`: con estas columnas en NULL una nota
    // aceptada aparecía sin documento de origen ni motivo, aunque el XML los
    // llevara dentro.
    //
    // `referenced_document_type` es el tipo del documento AFECTADO, no de la
    // nota: la serie decide el tipo según el Catálogo 01 y las series de factura
    // empiezan por F (FA01/FB01/FE01/F001), las de boleta por B.
    referenced_document_type: dto.documento_afectado
      ? (dto.documento_afectado.trim().toUpperCase().startsWith('B') ? '03' : '01')
      : undefined,
    referenced_series_correlative: dto.documento_afectado?.trim() || undefined,
    // TA-66: el UUID del comprobante afectado. Lo pone `verificarDocumentoOrigen`
    // en el DTO porque es quien busca el origen por número; sin él la columna
    // queda NULL y el saldo no descuenta las notas anteriores.
    referenced_invoice_id: dto.referenced_invoice_id,
    credit_debit_reason_code: dto.codigo_motivo_nota?.trim() || undefined,
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
