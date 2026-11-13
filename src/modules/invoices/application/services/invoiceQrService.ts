/**
 * QR de la representación impresa: Anexo 6, apartado 6.4.3.
 * Diez campos separados por |, con el formato del comprobante y el
 * DigestValue Base64 del XML firmado (incluido su relleno).
 */
import { Injectable } from '@nestjs/common';
import * as QRCode from 'qrcode';

/** Datos mínimos para armar la trama del QR. */
export interface DatosQrComprobante {
  rucEmisor: string;
  tipoComprobante: string;
  serie: string;
  correlativo: number;
  igv: number;
  total: number;
  /** Fecha de emisión en formato YYYY-MM-DD. */
  fechaEmision: string;
  tipoDocCliente: string;
  numDocCliente: string;
  /** DigestValue Base64 del XML firmado, incluido su relleno final. */
  hashCpe: string;
}

/** Conserva el día fiscal ISO guardado; no convierte su zona horaria. */
export const fechaTramaSunat = (fecha: string): string => fecha.slice(0, 10);

/** Diez campos; solo se retira el espacio de formato del DigestValue. */
export const tramaQrSunat = (datos: DatosQrComprobante): string => {
  const hash = datos.hashCpe.replace(/\s+/g, '');

  return [
    datos.rucEmisor,
    datos.tipoComprobante,
    datos.serie,
    String(datos.correlativo).padStart(8, '0'),
    Number(datos.igv).toFixed(2),
    Number(datos.total).toFixed(2),
    fechaTramaSunat(datos.fechaEmision),
    datos.tipoDocCliente,
    datos.numDocCliente,
    hash,
  ].join('|');
};

/** Valida la estructura de diez campos, incluidos receptores anónimos. */
export const tramaValida = (trama: string): boolean => {
  const campos = trama.split('|');
  return campos.length === 10;
};

@Injectable()
export class InvoiceQrService {
  /** Devuelve el PNG del QR en base64, listo para incrustar en el PDF. */
  public async generarPng(data: DatosQrComprobante): Promise<string> {
    const trama = tramaQrSunat(data);

    return QRCode.toDataURL(trama, {
      errorCorrectionLevel: 'Q',
      margin: 1,
      width: 220,
    });
  }

  /** Devuelve el PNG como Buffer, que es lo que consume pdfkit. */
  public async generarBuffer(data: DatosQrComprobante): Promise<Buffer> {
    const trama = tramaQrSunat(data);

    return QRCode.toBuffer(trama, {
      type: 'png',
      errorCorrectionLevel: 'Q',
      margin: 1,
      width: 220,
    });
  }
}
