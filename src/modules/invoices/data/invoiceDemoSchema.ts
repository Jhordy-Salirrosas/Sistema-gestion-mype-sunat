/**
 * Tipos del dominio de demostración de comprobantes (M1).
 *
 * Se separan de `./invoiceDemoTypes` para respetar el límite de líneas del
 * proyecto; ese módulo los re-exporta junto con la fábrica `construir`.
 */
import type { AfectacionIgv } from '../lib/invoiceCalculations';

/** Tipo de comprobante del Catálogo 01 de SUNAT. */
export type TipoComprobante = '01' | '03' | '07' | '08' | 'RA' | 'RC';

/**
 * Estado del comprobante tal como lo pinta la ficha.
 *
 * `SIN_CONFIRMAR` NO es un veredicto de SUNAT: el documento no llegó a
 * enviarse, así que no hay ni aceptación ni rechazo. Antes ese caso se
 * colapsaba en `RECHAZADO` y la ficha afirmaba algo falso sobre el comprobante.
 */
export type EstadoCdrDemo =
  | 'ACEPTADO'
  | 'OBSERVADO'
  | 'EN_COLA'
  | 'SIN_CONFIRMAR'
  | 'RECHAZADO';

/** Tipo de operación del Catálogo 51 de SUNAT. */
export type TipoOperacion = '0101' | '1001' | '0200';

/** Forma de pago declarada en el comprobante. */
export type FormaPago = 'Contado' | 'Credito';

/**
 * Forma de pago de un comprobante YA EMITIDO, tal como se leyó del backend.
 *
 * `null` = DESCONOCIDA: los comprobantes emitidos antes de que el backend
 * expusiera el dato no tienen de dónde sacarlo. Es distinto de `FormaPago`,
 * que es la decisión que se toma al emitir y por eso nunca admite desconocido.
 */
export type FormaPagoRegistrada = FormaPago | null;

/** Cuota del cronograma de pago al crédito. */
export interface CuotaDemo {
  numero: string;
  monto: number;
  vencimiento: string;
}

/** Motivo de la nota (Catálogo 09 para NC, Catálogo 10 para ND). */
export interface MotivoNota {
  codigo: string;
  descripcion: string;
}

/** Ítem del detalle del comprobante. */
export interface ItemDemo {
  codigo: string;
  descripcion: string;
  unidad: string;
  cantidad: number;
  valorUnitario: number;
  afectacion: AfectacionIgv;
}

/**
 * Tipo de documento de identidad del adquirente (Catálogo 06 de SUNAT).
 *
 * Se deriva del largo del documento cuando la semilla no lo declara: 11
 * dígitos es RUC (`6`) y 8 dígitos es DNI (`1`). La Boleta solo admite DNI,
 * por eso el tipo viaja con el comprobante en lugar de inferirse en cada capa.
 */
export type TipoDocIdentidad = '1' | '6';

/** Fila enriquecida que consume la tabla del módulo. */
export interface ComprobanteDemo {
  id: string;
  /**
   * Número fiscal completo (`F001-00000045`), con ceros de relleno.
   *
   * Es la identidad que se compara al buscar el origen de una nota. `id` es el
   * identificador técnico (UUID desde el backend, `serie-correlativo` sin ceros
   * en los datos demo) y no sirve para lo que teclea el usuario.
   */
  numero?: string;
  tipo: TipoComprobante;
  serie: string;
  correlativo: number;
  clienteRuc: string;
  /** Tipo de documento del cliente según el Catálogo 06. */
  clienteTipoDoc: TipoDocIdentidad;
  clienteRazonSocial: string;
  fechaEmision: string;
  moneda: 'PEN' | 'USD';
  baseImponible: number;
  igv: number;
  detraccion: number;
  retencion: number;
  totalNeto: number;
  estado: EstadoCdrDemo;
  cdrCodigo?: string;
  /**
   * Código y motivo del rechazo cuando SUNAT no devolvió CDR (SOAP Fault).
   *
   * El modal los usa para no rotular un RECHAZADO como "PENDIENTE": sin ellos
   * no había ningún código que mostrar.
   */
  ultimoErrorCodigo?: string;
  ultimoErrorMensaje?: string;
  /** Documento afectado, solo para notas de crédito/débito. */
  documentoAfectado?: string;
  /** Tiempo de despacho en la cola Outbox, en ms. */
  tiempoDespachoMs?: number;
  tipoOperacion: TipoOperacion;
  /**
   * Forma de pago con la que se emitió.
   *
   * Admite `null` en comprobantes leídos del backend: antes se rellenaba con
   * 'Contado' para toda fila, que es una AFIRMACIÓN fiscal que puede ser falsa.
   */
  formaPago: FormaPagoRegistrada;
  /** Cronograma de cuotas (solo si `formaPago` es 'Credito'). */
  cuotas: readonly CuotaDemo[];
  /** Motivo de la nota (solo para tipos 07 y 08). */
  motivoNota?: MotivoNota;
  cdrDescripcion: string;
  hashCpe: string;
  items: readonly ItemDemo[];
  /**
   * Estado CRUDO del backend (ACEPTADO, ERROR_RED…), cuando el comprobante
   * viene de la API.
   *
   * `estado` es la vista simplificada del front y colapsa `ERROR_RED` dentro de
   * RECHAZADO, lo que hace imposible distinguir un fallo de envío de un rechazo
   * real de SUNAT. La Bitácora necesita el crudo para no afirmar un veredicto
   * del fisco sobre un documento que nunca le llegó.
   */
  estadoBackend?: string;
}

/** Entrada reducida: el resto de montos se calcula. */
export interface SemillaComprobante {
  tipo: TipoComprobante;
  serie: string;
  correlativo: number;
  ruc: string;
  /** Tipo de documento del cliente; si se omite se infiere del largo de `ruc`. */
  tipoDocCliente?: TipoDocIdentidad;
  razonSocial: string;
  fecha: string;
  base: number;
  afectacion?: AfectacionIgv;
  detraccionPct?: number;
  agenteRetencion?: boolean;
  estado: EstadoCdrDemo;
  cdrCodigo?: string;
  documentoAfectado?: string;
  tiempoDespachoMs?: number;
  tipoOperacion?: TipoOperacion;
  formaPago?: FormaPago;
  numeroCuotas?: number;
  motivoNota?: MotivoNota;
  items?: readonly ItemDemo[];
}
