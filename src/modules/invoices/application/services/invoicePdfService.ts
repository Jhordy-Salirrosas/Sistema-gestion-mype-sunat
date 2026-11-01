/**
 * Representación impresa del comprobante en PDF (TA-65).
 *
 * Se compone con `pdfkit`, sin navegador headless: abrir Chromium desde un
 * servicio de facturación añade cientos de megas y hace impredecibles los tests.
 * El PDF es un documento de la serie A4 con el membrete, los datos del cliente,
 * el detalle y, al pie, la trama del QR que exige SUNAT.
 *
 * Qué se imprime y por qué:
 *
 *  - **Leyenda del importe en letras** (Leyenda 1000): obligatoria en la
 *    representación impresa.
 *  - **Cuentas del Banco de la Nación** cuando hay detracción: el cliente
 *    necesita el número para depositar; ponerlo en el PDF evita una llamada.
 *  - **Cronograma de cuotas** si la venta es al crédito, con su vencimiento.
 *  - **QR** con la trama oficial de diez campos (ver `invoiceQrService`).
 *
 * El generador NO calcula impuestos: recibe el desglose ya liquidado para que el
 * PDF no pueda decir un número distinto del XML enviado.
 */
import { Injectable } from '@nestjs/common';
import PDFDocument from 'pdfkit';

/** Línea del detalle tal como se imprime. */
export interface LineaImpresa {
  descripcion: string;
  unidad: string;
  cantidad: number;
  valorUnitario: number;
  igv: number;
  total: number;
}

/** Cuota del cronograma impreso. */
export interface CuotaImpresa {
  numero: string;
  monto: number;
  vencimiento: string;
}

/** Todo lo que necesita el PDF. */
export interface DatosPdfComprobante {
  rucEmisor: string;
  razonSocialEmisor: string;
  direccionEmisor?: string;
  tipoComprobante: string;
  serie: string;
  correlativo: number;
  fechaEmision: string;
  moneda: string;
  clienteRazonSocial: string;
  clienteDocumento: string;
  /** Descripción legible del tipo: "FACTURA ELECTRÓNICA". */
  nombreTipo: string;
  lineas: readonly LineaImpresa[];
  gravado: number;
  exonerado: number;
  inafecto: number;
  igv: number;
  icbper: number;
  detraccion: number;
  total: number;
  montoEnLetras: string;
  /** Cuotas al crédito; vacío si la venta es al contado. */
  cuotas?: readonly CuotaImpresa[];
  /** Cuenta del Banco de la Nación para la detracción. */
  cuentaBancoNacion?: string;
  /** PNG del QR en base64 (con o sin el prefijo data:). */
  qrBase64: string;
}

/** Ancho de la caja de texto de una A4 con márgenes de 40. */
const ANCHO_UTIL = 515;

/** Formatea un importe con dos decimales y separador de miles. */
export const monto = (valor: number): string =>
  new Intl.NumberFormat('es-PE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(valor);

@Injectable()
export class InvoicePdfService {
  /**
   * Genera el PDF y devuelve el binario completo.
   *
   * Se acumulan los `chunk` en un Buffer en lugar de devolver el stream: el
   * controlador necesita conocer el largo para el `Content-Length` y el
   * `Content-Disposition`, y un stream de tamaño desconocido obliga a
   * transferencia chunked.
   */
  public async generar(datos: DatosPdfComprobante): Promise<Buffer> {
    const doc = new PDFDocument({ size: 'A4', margin: 40 });
    const partes: Buffer[] = [];

    doc.on('data', (trozo: Buffer) => partes.push(trozo));

    const terminado = new Promise<Buffer>((resolve, reject) => {
      doc.on('end', () => resolve(Buffer.concat(partes)));
      doc.on('error', reject);
    });

    this.cabecera(doc, datos);
    this.cliente(doc, datos);
    this.detalle(doc, datos);
    this.totales(doc, datos);
    if (datos.cuotas && datos.cuotas.length > 0) {
      this.cronograma(doc, datos);
    }
    this.pie(doc, datos);

    doc.end();
    return terminado;
  }

  /** Nombre de archivo que el usuario verá al descargar. */
  public nombreArchivo(datos: DatosPdfComprobante): string {
    const numero = `${datos.serie}-${String(datos.correlativo).padStart(8, '0')}`;
    return `${datos.rucEmisor}-${datos.tipoComprobante}-${numero}.pdf`;
  }

  /** Membrete del emisor y datos del comprobante. */
  private cabecera(doc: PDFKit.PDFDocument, d: DatosPdfComprobante): void {
    doc.fontSize(13).text(d.razonSocialEmisor, { continued: false });
    doc.fontSize(8).fillColor('#444');
    doc.text(`RUC ${d.rucEmisor}`);
    if (d.direccionEmisor) doc.text(d.direccionEmisor);
    doc.fillColor('#000').moveDown(0.6);

    // Recuadro del comprobante a la derecha.
    const y = 40;
    doc
      .rect(320, y, 235, 62)
      .lineWidth(1)
      .strokeColor('#000')
      .stroke();

    doc.fontSize(9).text(d.nombreTipo, 330, y + 8, { width: 215, align: 'center' });
    doc.fontSize(11).text(
      `${d.serie}-${String(d.correlativo).padStart(8, '0')}`,
      330,
      y + 24,
      { width: 215, align: 'center' },
    );
    doc
      .fontSize(8)
      .text(`Fecha de emisión: ${d.fechaEmision}`, 330, y + 44, {
        width: 215,
        align: 'center',
      });

    doc.y = Math.max(doc.y, y + 70);
    doc.moveDown(0.4);
  }

  /** Bloque del adquirente. */
  private cliente(doc: PDFKit.PDFDocument, d: DatosPdfComprobante): void {
    doc.fontSize(9);
    doc.text(`Señor(es): ${d.clienteRazonSocial}`);
    doc.text(`Documento: ${d.clienteDocumento}`);
    doc.text(`Moneda: ${d.moneda}`);
    doc.moveDown(0.6);
  }

  /** Tabla del detalle. */
  private detalle(doc: PDFKit.PDFDocument, d: DatosPdfComprobante): void {
    const columnas = [
      { titulo: 'Descripción', ancho: 235, alinear: 'left' as const },
      { titulo: 'Und.', ancho: 40, alinear: 'left' as const },
      { titulo: 'Cant.', ancho: 50, alinear: 'right' as const },
      { titulo: 'V. unit.', ancho: 60, alinear: 'right' as const },
      { titulo: 'IGV', ancho: 55, alinear: 'right' as const },
      { titulo: 'Total', ancho: 75, alinear: 'right' as const },
    ];

    let x = 40;
    const yCabecera = doc.y;
    doc.fontSize(8).fillColor('#000');

    for (const col of columnas) {
      doc.text(col.titulo, x, yCabecera, {
        width: col.ancho,
        align: col.alinear,
      });
      x += col.ancho;
    }

    doc
      .moveTo(40, doc.y + 2)
      .lineTo(40 + ANCHO_UTIL, doc.y + 2)
      .strokeColor('#999')
      .stroke();

    doc.moveDown(0.3);

    for (const linea of d.lineas) {
      const y = doc.y;
      let cx = 40;
      const valores = [
        linea.descripcion,
        linea.unidad,
        String(linea.cantidad),
        monto(linea.valorUnitario),
        monto(linea.igv),
        monto(linea.total),
      ];

      columnas.forEach((col, i) => {
        doc.fontSize(8).text(valores[i], cx, y, {
          width: col.ancho,
          align: col.alinear,
        });
        cx += col.ancho;
      });

      // La fila más alta manda: una descripción larga ocupa dos líneas.
      doc.y = Math.max(doc.y, y) + 4;
    }

    doc.moveTo(40, doc.y).lineTo(40 + ANCHO_UTIL, doc.y).strokeColor('#999').stroke();
    doc.moveDown(0.6);
  }

  /** Resumen de totales y la leyenda del importe en letras. */
  private totales(doc: PDFKit.PDFDocument, d: DatosPdfComprobante): void {
    const filas: [string, number][] = [];
    if (d.gravado > 0) filas.push(['Op. gravada', d.gravado]);
    if (d.exonerado > 0) filas.push(['Op. exonerada', d.exonerado]);
    if (d.inafecto > 0) filas.push(['Op. inafecta', d.inafecto]);
    filas.push(['IGV (18%)', d.igv]);
    if (d.icbper > 0) filas.push(['ICBPER', d.icbper]);
    if (d.detraccion > 0) filas.push(['Detracción SPOT', -d.detraccion]);

    const xEtiqueta = 330;
    const anchoEtiqueta = 130;

    for (const [etiqueta, valor] of filas) {
      const y = doc.y;
      doc.fontSize(8).text(etiqueta, xEtiqueta, y, { width: anchoEtiqueta });
      doc.text(monto(valor), xEtiqueta + anchoEtiqueta, y, {
        width: 95,
        align: 'right',
      });
      doc.y = y + 12;
    }

    doc
      .moveTo(xEtiqueta, doc.y + 1)
      .lineTo(xEtiqueta + anchoEtiqueta + 95, doc.y + 1)
      .strokeColor('#000')
      .stroke();

    doc.moveDown(0.4);
    doc.fontSize(10);
    const yTotal = doc.y;
    doc.text('IMPORTE TOTAL', xEtiqueta, yTotal, { width: anchoEtiqueta });
    doc.text(`S/ ${monto(d.total)}`, xEtiqueta + anchoEtiqueta, yTotal, {
      width: 95,
      align: 'right',
    });
    doc.y = yTotal + 20;

    // Leyenda 1000: el importe en letras va en recuadro, no como línea suelta.
    // Un comprobante impreso sin "SON ... CENTAVOS" no parece un comprobante.
    const yLetras = doc.y;
    const altoLetras = 26;
    doc
      .rect(40, yLetras, ANCHO_UTIL, altoLetras)
      .lineWidth(0.7)
      .strokeColor('#666')
      .stroke();
    doc
      .fontSize(8)
      .fillColor('#333')
      .text(`SON: ${d.montoEnLetras}`, 48, yLetras + 8, {
        width: ANCHO_UTIL - 16,
      });
    doc.fillColor('#000');
    doc.y = yLetras + altoLetras + 8;

    if (d.detraccion > 0 && d.cuentaBancoNacion) {
      doc.fontSize(8).text(
        `Detracción: depositar en el Banco de la Nación, cuenta ${d.cuentaBancoNacion}.`,
        40,
        doc.y,
        { width: ANCHO_UTIL },
      );
      doc.moveDown(0.4);
    }
  }

  /** Cronograma de cuotas al crédito. */
  private cronograma(doc: PDFKit.PDFDocument, d: DatosPdfComprobante): void {
    doc.fontSize(9).text('Cronograma de pagos');
    doc.fontSize(8);

    for (const cuota of d.cuotas ?? []) {
      doc.text(`${cuota.numero}: S/ ${monto(cuota.monto)} — vence el ${cuota.vencimiento}`);
    }
    doc.moveDown(0.6);
  }

  /** Pie con el QR y la leyenda de validez. */
  private pie(doc: PDFKit.PDFDocument, d: DatosPdfComprobante): void {
    const yPie = 700;
    const base64 = d.qrBase64.replace(/^data:image\/png;base64,/, '');

    if (base64) {
      try {
        doc.image(Buffer.from(base64, 'base64'), 40, yPie, { width: 80 });
      } catch {
        // Un QR corrupto no debe impedir que el comprobante se imprima: se
        // omite la imagen y se avisa en el cuerpo.
        doc.fontSize(8).text('(QR no disponible)', 40, yPie);
      }
    }

    doc.fontSize(7).fillColor('#555');
    doc.text(
      'Representación impresa de un comprobante electrónico. ' +
        'Consulte su validez con el número de comprobante en el portal de SUNAT.',
      130,
      yPie + 10,
      { width: 425 },
    );
    doc.fillColor('#000');
  }
}
