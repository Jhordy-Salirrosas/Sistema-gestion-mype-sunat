/**
 * Código QR del comprobante según la trama oficial de SUNAT (TA-65).
 *
 * La representación impresa de un CPE debe llevar un QR con la misma
 * información que el XML, para que cualquier validador pueda reconstruir el
 * documento. La trama que exige SUNAT tiene exactamente diez campos separados
 * por barra vertical, más el hash que se calcula sobre el XML:
 *
 *   RUC | TIPO | SERIE | CORRELATIVO | IGV | TOTAL | FECHA | TIPO_DOC | NUM_DOC | HASH |
 *
 * Dos detalles que se equivocan con frecuencia y que este módulo aísla:
 *
 *  - El **IGV** va con dos decimales y es el del comprobante, no el de una
 *    línea.
 *  - La **fecha** va en DD-MM-AAAA. Con formato ISO el validador de SUNAT
 *    rechaza el QR aunque el XML esté perfecto.
 *
 * El servicio NO dibuja: devuelve el PNG en base64 y el PDF decide dónde
 * colocarlo. Separar el cálculo del formato permite probar la trama sin generar
 * una imagen.
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
  /** Hash del XML, sin el signo igual final que agrega el base64. */
  hashCpe: string;
}

/** Convierte una fecha YYYY-MM-DD a DD-MM-AAAA, como exige SUNAT. */
export const fechaTramaSunat = (fecha: string): string => {
  const partes = fecha.slice(0, 10).split('-');
  if (partes.length !== 3) return fecha;
  const [anio, mes, dia] = partes;
  return `${dia}-${mes}-${anio}`;
};

/**
 * Arma la trama de diez campos.
 *
 * El hash se sanea quitando el `=` de relleno y cualquier salto de línea: el
 * base64 del hash del XML llega así y meterlo tal cual rompe el QR.
 */
export const tramaQrSunat = (datos: DatosQrComprobante): string => {
  const hash = (datos.hashCpe ?? '').replace(/=+$/, '').replace(/\s+/g, '');

  return [
    datos.rucEmisor,
    datos.tipoComprobante,
    datos.serie,
    String(datos.correlativo),
    Number(datos.igv).toFixed(2),
    Number(datos.total).toFixed(2),
    fechaTramaSunat(datos.fechaEmision),
    datos.tipoDocCliente,
    datos.numDocCliente,
    hash,
    '',
  ].join('|');
};

/** Valida que la trama tenga los diez campos más el separador final. */
export const tramaValida = (trama: string): boolean => {
  const campos = trama.split('|');
  return campos.length === 11 && campos[10] === '';
};

@Injectable()
export class InvoiceQrService {
  /** Devuelve el PNG del QR en base64, listo para incrustar en el PDF. */
  public async generarPng(data: DatosQrComprobante): Promise<string> {
    const trama = tramaQrSunat(data);

    return QRCode.toDataURL(trama, {
      errorCorrectionLevel: 'M',
      margin: 1,
      width: 220,
    });
  }

  /** Devuelve el PNG como Buffer, que es lo que consume pdfkit. */
  public async generarBuffer(data: DatosQrComprobante): Promise<Buffer> {
    const trama = tramaQrSunat(data);

    return QRCode.toBuffer(trama, {
      type: 'png',
      errorCorrectionLevel: 'M',
      margin: 1,
      width: 220,
    });
  }
}
