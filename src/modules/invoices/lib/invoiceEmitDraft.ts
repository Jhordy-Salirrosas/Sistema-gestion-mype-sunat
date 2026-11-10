/**
 * Modelo y conversión del borrador de emisión de comprobantes (M1).
 *
 * TypeScript puro: define el estado del formulario y la conversión hacia el
 * `ComprobanteDemo` final. Se aísla del modal para respetar el límite de líneas.
 *
 * Reglas que se cubren aquí (y no solo en la UI):
 *  - El correlativo se calcula a partir de los comprobantes ya emitidos para
 *    esa serie, de modo que dos emisiones nunca comparten `serie-correlativo`
 *    (que es la clave primaria del CPE y también el `id` de la grilla).
 *  - Una Nota hereda del documento afectado el tipo de operación, la forma de
 *    pago y las cuotas; no puede llevar detracción ni retención (solo las
 *    facturas las generan) y usa la serie F/B que exige SUNAT.
 *  - Las Notas al crédito recuperan la fecha de emisión del documento afectado
 *    (Catálogo 09, motivo 13), como manda la RS 193-2020/SUNAT.
 */
import type { DescuentoGlobal } from './invoiceDescuentoGlobal';
import type { LineaComprobante } from './invoiceTaxes';
import { buscarAfectado } from './invoiceNotaOrigen';
import type {
  ComprobanteDemo,
  ItemDemo,
  TipoComprobante,
  TipoOperacion,
} from '../data/invoiceDemoTypes';
import { construir } from '../data/invoiceDemoTypes';
import {
  serieInicialPorTipo,
  serieParaNota,
  type TipoEmisible,
} from './invoiceEmitValidation';
import {
  calcularItem,
  totalizarItems,
  type ItemBorrador,
} from './invoiceItems';
import {
  buscarDetraccion,
  repartirEnCuotas,
  type CuotaBorrador,
} from './invoiceDetraccion';
import { diasEntreFechas, fechaIsoValida } from './invoiceFecha';

/** Estado editable del formulario de emisión. */
export interface BorradorEmision {
  almacen?: string;
  medioPagoDetraccion?: import('./medioPagoDetraccion').MedioPagoDetraccion | '';
  tipo: TipoEmisible;
  serie: string;
  correlativo: number;
  clienteId?: string;
  clienteTipoDocumento?: string;
  clienteDireccion?: string;
  clienteTieneCredito?: boolean | null;
  clienteAdmiteDescuento?: boolean | null;
  clienteDoc: string;
  clienteTipoDoc: '1' | '6';
  clienteRazonSocial: string;
  /**
   * Detalle del comprobante (TA-64).
   *
   * Sustituye a los antiguos `descripcion` + `base` + `afectacion`, que solo
   * permitían una línea. La primera línea hereda esos valores iniciales para no
   * romper el flujo de quien escribía directo en el primer campo.
   */
  items: readonly ItemBorrador[];
  descuentoGlobal?: DescuentoGlobal | null;
  formaPago: 'Contado' | 'Credito';
  /**
   * Cronograma editable (TA-64). Si está vacío se reparte el neto
   * automáticamente en `numeroCuotas` partes.
   */
  cuotas: readonly CuotaBorrador[];
  numeroCuotas: number;
  /** Código del Catálogo 54; vacío = la operación no está sujeta a SPOT. */
  codigoDetraccion: string;
  agenteRetencion: boolean;
  correccionRetencion?: boolean;
  bolsas: number;
  documentoAfectado: string;
  /** Tipo del documento afectado, para heredar el tipo de operación. */
  tipoDocumentoAfectado: TipoOperacion;
  motivoCodigo: string;
  motivoDescripcion: string;
  fecha: string;
}

/** Contador para generar claves estables de línea sin depender de Date.now. */
let contadorClaves = 0;

/** Clave estable para una línea nueva. */
export const nuevaClave = (): string => {
  contadorClaves += 1;
  return `item-${contadorClaves}`;
};

/** Estado de una serie para calcular el siguiente correlativo. */
interface EstadoSerie {
  serie: string;
  correlativo: number;
}

/** Borrador inicial para un tipo de comprobante. */
export const borradorInicial = (
  tipo: TipoEmisible,
  fecha: string,
): BorradorEmision => ({
  almacen: 'ALM-01',
  tipo,
  serie: serieInicialPorTipo(tipo),
  correlativo: 100,
  clienteDoc: '',
  clienteTipoDoc: '6',
  clienteRazonSocial: '',
  items: [
    {
      clave: nuevaClave(),
      codigo: tipo === '07' || tipo === '08' ? '' : 'SRV-001',
      descripcion: tipo === '07' || tipo === '08' ? '' : 'Servicio de confección',
      unidad: 'NIU',
      cantidad: 1,
      valorUnitario: tipo === '07' || tipo === '08' ? 0 : 100,
      afectacion: 'GRAVADA',
      icbper: 0,
    },
  ],
  descuentoGlobal: null,
  formaPago: 'Contado',
  cuotas: [],
  numeroCuotas: 2,
  codigoDetraccion: '',
  agenteRetencion: false,
  bolsas: 0,
  documentoAfectado: '',
  tipoDocumentoAfectado: '0101',
  motivoCodigo: tipo === '08' ? '02' : '01',
  motivoDescripcion:
    tipo === '08' ? 'Aumento en el valor' : 'Anulación de la operación',
  fecha,
});

/**
 * Calcula el siguiente correlativo libre de una serie.
 *
 * Toma el mayor correlativo ya existente en esa serie (sin importar el tipo de
 * documento ni el estado) y le suma uno. Si la serie no tiene comprobantes se
 * usa el correlativo base tal cual, que es el primer número libre de la serie:
 * sumarle uno dejaría huecos entre la semilla y la primera emisión.
 */
export const siguienteCorrelativo = (
  existentes: readonly EstadoSerie[],
  serie: string,
  base = 100,
): number => {
  const deLaSerie = existentes
    .filter((c) => c.serie === serie)
    .map((c) => c.correlativo);

  if (deLaSerie.length === 0) return base;

  return Math.max(...deLaSerie) + 1;
};

/**
 * Convierte el borrador a las líneas que consume el motor tributario.
 *
 * TA-64: antes devolvía UNA línea con el campo `base` del formulario. Ahora
 * devuelve todas las líneas de la grilla, ya con su afectación y con las
 * gratuitas en cero (regla 3278).
 */
export const borradorALiquidar = (
  b: BorradorEmision,
): readonly LineaComprobante[] =>
  b.items.map((item) => {
    const total = calcularItem(item);
    return { base: total.base, afectacion: item.afectacion };
  });

/** Totales de la grilla del borrador (base, IGV, ICBPER y total). */
export const totalesDelBorrador = (b: BorradorEmision) =>
  totalizarItems(b.items);

/** Indica si el tipo de comprobante es una Nota de Crédito o de Débito. */
export const esTipoNota = (tipo: string): boolean =>
  tipo === '07' || tipo === '08';

/**
 * Convierte el borrador a un comprobante listo para la grilla.
 *
 * El resultado entra como `EN_COLA`: la cola Outbox lo despacha y el CDR llega
 * después.
 *
 * TA-64: el comprobante se arma con las LÍNEAS de la grilla, no con una base
 * única. La `base` y la `afectacion` que recibe `construir` son solo el
 * agregado; los importes reales salen de `items`.
 */
export const borradorAComprobante = (
  b: BorradorEmision,
): ComprobanteDemo => {
  const esNota = esTipoNota(b.tipo);
  const totales = totalizarItems(b.items);
  const numeroCuotas = b.formaPago === 'Credito' ? b.numeroCuotas : 0;

  // La afectación del comprobante es la de su primera línea onerosa: es lo que
  // se usa para decidir si lleva IGV en el resumen.
  const primeraOnerosa =
    b.items.find((i) => i.afectacion !== 'GRATUITA') ?? b.items[0];

  const items: readonly ItemDemo[] = b.items.map((item) => ({
    codigo: item.codigo.trim() || 'ITM',
    descripcion: item.descripcion.trim() || 'ÍTEM SIN DESCRIPCIÓN',
    unidad: item.unidad,
    cantidad: item.cantidad,
    valorUnitario: item.valorUnitario,
    afectacion: item.afectacion,
  }));

  const detraccion = b.codigoDetraccion
    ? buscarDetraccion(b.codigoDetraccion)
    : undefined;

  return construir({
    tipo: b.tipo as TipoComprobante,
    serie: b.serie,
    correlativo: b.correlativo,
    ruc: b.clienteDoc,
    tipoDocCliente: b.clienteDoc.length === 11 ? '6' : '1',
    razonSocial: b.clienteRazonSocial || 'CLIENTE SIN RAZÓN SOCIAL',
    fecha: b.fecha,
    base: totales.base,
    afectacion: primeraOnerosa?.afectacion ?? 'GRAVADA',
    // Solo las Facturas generan detracción SPOT o retención del IGV; una Nota
    // las hereda del documento afectado, no las crea.
    detraccionPct: !esNota ? detraccion?.porcentaje : undefined,
    agenteRetencion: !esNota && b.agenteRetencion,
    estado: 'EN_COLA',
    tipoOperacion: esNota
      ? b.tipoDocumentoAfectado
      : detraccion
        ? '1001'
        : undefined,
    formaPago: b.formaPago,
    numeroCuotas,
    documentoAfectado: esNota ? b.documentoAfectado : undefined,
    motivoNota: esNota
      ? { codigo: b.motivoCodigo, descripcion: b.motivoDescripcion }
      : undefined,
    items,
  });
};

/** Aplica el tipo de comprobante y deja la serie coherente con él. */
export const cambiarTipo = (
  b: BorradorEmision,
  tipo: TipoEmisible,
): BorradorEmision => ({
  ...b,
  tipo,
  serie: serieInicialPorTipo(tipo),
  // Los motivos del Catálogo 09 y 10 son distintos: se reinician al cambiar.
  motivoCodigo: tipo === '08' ? '02' : '01',
  motivoDescripcion:
    tipo === '08' ? 'Aumento en el valor' : 'Anulación de la operación',
  documentoAfectado: '',
  tipoDocumentoAfectado: '0101',
});

/**
 * Vincula una Nota con el documento que modifica.
 *
 * SUNAT exige que la Nota use la misma serie (F/B) que el documento afectado y
 * que su tipo de operación sea el de la factura 1001 cuando esta lleva
 * detracción. La forma de pago quedó en el documento original: la Nota al
 * crédito la replica y además recupera su fecha de emisión (motivo 13).
 * Devuelve el borrador actualizado y el comprobante encontrado.
 */
export const vincularDocumentoAfectado = (
  b: BorradorEmision,
  existentes: readonly ComprobanteDemo[],
): {
  borrador: BorradorEmision;
  afectado: ComprobanteDemo | undefined;
} => {
  // Búsqueda por NÚMERO FISCAL. Antes comparaba contra `c.id` (el UUID), así que
  // el afectado nunca se encontraba: la nota no heredaba serie, tipo de
  // operación, forma de pago ni fecha del documento original.
  const afectado = existentes.find(
    (c) => ['ACEPTADO', 'OBSERVADO'].includes(c.estado) && (c.tipo === '01' || c.tipo === '03') && buscarAfectado([c], b.documentoAfectado) !== undefined,
  );

  return {
    borrador: {
      ...b,
      serie: serieParaNota(b.tipo, b.documentoAfectado, b.serie),
      tipoDocumentoAfectado: afectado?.tipoOperacion ?? '0101',
      // El adquirente siempre es el del origen, incluso si había otro cliente.
      clienteDoc: afectado?.clienteRuc ?? b.clienteDoc,
      clienteRazonSocial: afectado?.clienteRazonSocial ?? b.clienteRazonSocial,
      clienteId: undefined,
      clienteTipoDocumento: afectado?.clienteTipoDoc,
      clienteDireccion: undefined,
      formaPago: afectado?.formaPago ?? b.formaPago,
      numeroCuotas:
        afectado?.formaPago === 'Credito'
          ? Math.max(1, afectado.cuotas.length)
          : b.numeroCuotas,
      cuotas:
        afectado?.formaPago === 'Credito'
          ? afectado.cuotas.map((c) => ({
              monto: c.monto,
              vencimiento: c.vencimiento,
            }))
          : [],
      fecha: afectado?.fechaEmision ?? b.fecha,
    },
    afectado,
  };
};

/** Cambia la forma de pago y reinicia el cronograma cuando pasa a contado. */
export const cambiarFormaPago = (
  b: BorradorEmision,
  formaPago: BorradorEmision['formaPago'],
  netoPendiente: number,
): BorradorEmision => ({
  ...b,
  formaPago,
  cuotas:
    formaPago === 'Credito'
      ? repartirEnCuotas(netoPendiente, b.numeroCuotas, b.fecha).map((c) => ({
          monto: c.monto,
          vencimiento: c.vencimiento,
        }))
      : [],
});

/**
 * Cambia la fecha de emisión y RE-DERIVA el cronograma (D9).
 *
 * POR QUÉ NO BASTA CON CAMBIAR EL CAMPO
 *
 * La fecha de emisión es la base de todos los vencimientos. Mientras el
 * formulario la congelaba al abrirse, las cuotas nacían siempre «después de la
 * emisión» y la regla 3267 se cumplía sola. Al volverse editable, el usuario
 * puede mover la emisión hacia adelante y dejar los vencimientos atrás: el
 * comprobante se ve correcto en pantalla y el backend lo rechaza al enviar.
 *
 * LA REGLA QUE SE APLICA AQUÍ
 *
 * Cada cuota conserva su PLAZO —los días que el usuario eligió respecto de su
 * antigua emisión— y solo se mueve su fecha. Así un cronograma «a 30 y 60 días»
 * sigue diciendo 30 y 60 días con la fecha nueva. Recalcular desde cero volvería
 * a repartir cada 30 días y borraría en silencio un ajuste del usuario
 * («la primera a 15 días, la segunda a 90»).
 *
 * OJO CON LO QUE ESTO NO PUEDE HACER: si el usuario ya no quiere esos plazos,
 * esta función no lo adivina. Se conserva lo pactado y se avisa en pantalla;
 * volver a repartir es una acción explícita («Repartir» en el editor de cuotas).
 */
export const cambiarFechaEmision = (
  b: BorradorEmision,
  nuevaFecha: string,
): BorradorEmision => {
  // Sin cronograma no hay nada que mover; y si la fecha no es válida no se
  // toca el borrador, para no dejar las cuotas apoyadas en una fecha rota.
  if (b.cuotas.length === 0 || !fechaIsoValida(nuevaFecha)) {
    return { ...b, fecha: nuevaFecha };
  }

  const cuotas = b.cuotas.map((cuota) => {
    // El plazo se mide contra la emisión ANTERIOR, que es a la que el usuario
    // ató esa fecha cuando la eligió (a mano o por el reparto automático).
    const plazo = diasEntreFechas(b.fecha, cuota.vencimiento);
    // Si su vencimiento no era una fecha real no hay plazo que conservar: se
    // deja como está y `validarCronograma` lo convertirá en un error visible.
    if (plazo === null) return cuota;

    const destino = new Date(`${nuevaFecha}T00:00:00Z`);
    destino.setUTCDate(destino.getUTCDate() + plazo);
    return { ...cuota, vencimiento: destino.toISOString().slice(0, 10) };
  });

  return { ...b, fecha: nuevaFecha, cuotas };
};
