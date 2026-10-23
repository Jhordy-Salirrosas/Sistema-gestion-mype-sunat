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

export interface InvoicePayload extends DatosTributarios {
  rucEmisor: string;
  razonSocialEmisor: string;
  nombreComercialEmisor?: string;
  ubigeoEmisor?: string;
  direccionEmisor?: string;
  departamentoEmisor?: string;
  provinciaEmisor?: string;
  distritoEmisor?: string;
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
