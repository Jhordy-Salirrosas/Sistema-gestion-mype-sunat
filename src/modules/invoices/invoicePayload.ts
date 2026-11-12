/**
 * Contrato de entrada del generador UBL 2.1 (M1).
 *
 * Se separa de `ublGeneratorService` para que ese archivo contenga solo la
 * lógica de generación y respete el límite de líneas del proyecto.
 */
import type {
  CuotaXml,
  LineaDetalle,
  PartyCliente,
} from './xmlNodesHelper';
import type { DatosTributarios } from './ublTotalesHelper';
import type { MedioPagoDetraccion } from './domain/rules/medioPagoDetraccion';

export interface InvoicePayload extends DatosTributarios {
  /** Foto del maestro al crear, sellada por M1; no altera el XML fiscal. */
  m1InventorySnapshot?: Record<string, boolean>;
  /** Política física sellada por el servidor al crear notas 02 nuevas. */
  politicaDevolucionFisica02?: number;
  /** Almacén congelado al crear; los históricos pueden no tenerlo. */
  almacen?: string;
  rucEmisor: string;
  razonSocialEmisor: string;
  nombreComercialEmisor?: string;
  ubigeoEmisor?: string;
  direccionEmisor?: string;
  departamentoEmisor?: string;
  provinciaEmisor?: string;
  distritoEmisor?: string;
  codigoLocalAnexoEmisor?: string;
  /** Tipo del Catálogo 01: '01' Factura, '03' Boleta, '07' NC, '08' ND. */
  tipoComprobante: string;
  /** Serie según tipo: F001, B001, FC01, FD01. */
  serie: string;
  numero: number;
  /** Fecha de emisión en formato YYYY-MM-DD. */
  fechaEmision: string;
  /** Hora de emisión en formato HH:mm:ss. */
  horaEmision?: string;
  /** Tipo de operación del Catálogo 51. */
  tipoOperacion?: string;
  formaPago?: 'Contado' | 'Credito';
  cuotas?: CuotaXml[];
  /**
   * Detracción SPOT (TA-63): código del Catálogo 54, por ejemplo '012'.
   * Activa la Leyenda 2006 y el `cac:PaymentMeans` de detracción.
   */
  codigoDetraccion?: string;
  /** Catálogo 59; ausencia conserva 999, incluso al regenerar históricos. */
  medioPagoDetraccion?: MedioPagoDetraccion;
  /**
   * Importe en letras informativo; la leyenda 2006 usa el texto normativo SPOT.
   */
  montoEnLetras?: string;
  /** Cuenta del Banco de la Nación para el depósito de la detracción. */
  cuentaBancoNacion?: string;
  observaciones?: string;
  ordenCompra?: string;
  cliente?: PartyCliente;
  linea?: LineaDetalle;
  lineas?: LineaDetalle[];
  /** Nota de crédito (07) o débito (08): documento que se modifica. */
  documentoAfectado?: string;
  codigoMotivoNota?: string;
  descripcionMotivoNota?: string;
}
