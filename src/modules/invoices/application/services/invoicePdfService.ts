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

/** Formatos de representación impresa admitidos. */
export type FormatoPdf = 'a4' | 'ticket80mm';

/** 80 mm en puntos PostScript: 80 mm / 25.4 * 72 = 226.77. */
export const ANCHO_TICKET_MM = 80;
const ANCHO_TICKET_PT = Math.round((ANCHO_TICKET_MM / 25.4) * 72); // ≈ 227

/** Margen lateral del ticket térmico; 8 pt deja una mancha de ~64 mm. */
const MARGEN_TICKET = 8;

/**
 * Alto inicial del lienzo del ticket, en puntos.
 *
 * pdfkit no mide el contenido antes de crear la página: si se le da un alto
 * chico, añade páginas de 80 mm cuando el texto no cabe y el QR termina en un
 * segundo trozo. Este valor cubre un comprobante de una línea con su QR; si el
 * detalle es más largo, pdfkit sigue añadiendo tiros del mismo ancho, que es
 * como funciona una impresora térmica de verdad.
 */
const ALTO_TICKET_INICIAL = Math.round((230 / 25.4) * 72); // ≈ 652 pt ≈ 230 mm

/** Geometría de cada formato. */
interface Geometria {
  /** `'A4'` o [ancho, alto] en puntos. pdfkit rechaza un número suelto. */
  tamanoPagina: 'A4' | [number, number];
  margen: number;
  /** Ancho disponible para contenido. */
  util: number;
  /**
   * En el ticket el grosor de la fuente y las columnas cambian: 7 pt es lo que
   * se lee en una impresora térmica de 203 dpi sin desbordar.
   */
  compacto: boolean;
}

const GEOMETRIA: Record<FormatoPdf, Geometria> = {
  a4: { tamanoPagina: 'A4', margen: 40, util: ANCHO_UTIL, compacto: false },
  ticket80mm: {
    tamanoPagina: [ANCHO_TICKET_PT, ALTO_TICKET_INICIAL],
    margen: MARGEN_TICKET,
    util: ANCHO_TICKET_PT - MARGEN_TICKET * 2,
    compacto: true,
  },
};

/** Normaliza lo que llega por query: 'ticket80mm', 'TICKET80MM', 'a4'... */
export const normalizarFormato = (valor?: string): FormatoPdf => {
  const limpio = (valor ?? '').trim().toLowerCase();
  return limpio === 'ticket80mm' || limpio === 'ticket' || limpio === '80mm'
    ? 'ticket80mm'
    : 'a4';
};

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
   *
   * @param formato `a4` (por defecto) o `ticket80mm` para la impresora térmica.
   *   El ticket se maqueta en una sola columna estrecha: la caja útil es de
   *   ~64 mm, así que las columnas de la A4 no caben y se reordenan.
   */
  public async generar(
    datos: DatosPdfComprobante,
    formato: FormatoPdf = 'a4',
  ): Promise<Buffer> {
    const g = GEOMETRIA[formato];
    const doc = new PDFDocument({
      size: g.tamanoPagina,
      margin: g.margen,
      // `autoFirstPage` se deja en true: pdfkit crea la primera página con
      // `size` y, al llegar al borde inferior, añade otra del mismo ancho. Es
      // la altura dinámica del ticket sin tener que medir el contenido antes.
    });
    const partes: Buffer[] = [];

    doc.on('data', (trozo: Buffer) => partes.push(trozo));

    const terminado = new Promise<Buffer>((resolve, reject) => {
      doc.on('end', () => resolve(Buffer.concat(partes)));
      doc.on('error', reject);
    });

    if (g.compacto) {
      this.ticket(doc, datos, g);
    } else {
      this.cabecera(doc, datos);
      this.cliente(doc, datos);
      this.detalle(doc, datos);
      this.totales(doc, datos);
      if (datos.cuotas && datos.cuotas.length > 0) {
        this.cronograma(doc, datos);
      }
      this.pie(doc, datos);
    }

    doc.end();
    return terminado;
  }

  /** Nombre de archivo que el usuario verá al descargar. */
  public nombreArchivo(
    datos: DatosPdfComprobante,
    formato: FormatoPdf = 'a4',
  ): string {
    const numero = `${datos.serie}-${String(datos.correlativo).padStart(8, '0')}`;
    const sufijo = formato === 'ticket80mm' ? '-ticket80mm' : '';
    return `${datos.rucEmisor}-${datos.tipoComprobante}-${numero}${sufijo}.pdf`;
  }

  /**
   * Maquetación para impresora térmica de 80 mm.
   *
   * La caja útil son ~64 mm: no caben las columnas de la A4 ni el membrete en
   * dos bloques. Se apila todo en una columna centrada y el detalle va como
   * "cantidad x descripción" con el importe en la línea siguiente, que es como
   * imprime un ticket de mostrador. El QR pasa al pie, a 40 pt.
   */
  private ticket(
    doc: PDFKit.PDFDocument,
    d: DatosPdfComprobante,
    g: Geometria,
  ): void {
    const x = g.margen;

    // Membrete centrado.
    doc.fontSize(9).text(d.razonSocialEmisor, x, doc.y, {
      width: g.util,
      align: 'center',
    });
    doc.fontSize(7).fillColor('#333');
    doc.text(`RUC ${d.rucEmisor}`, x, doc.y, { width: g.util, align: 'center' });
    if (d.direccionEmisor) {
      doc.text(d.direccionEmisor, x, doc.y, { width: g.util, align: 'center' });
    }
    doc.fillColor('#000').moveDown(0.4);

    this.lineaTicket(doc, g);

    // Recuadro del comprobante, ahora a todo el ancho.
    doc.fontSize(8).text(d.nombreTipo, x, doc.y, { width: g.util, align: 'center' });
    doc.fontSize(10).text(
      `${d.serie}-${String(d.correlativo).padStart(8, '0')}`,
      x,
      doc.y,
      { width: g.util, align: 'center' },
    );
    doc.fontSize(7).text(`Fecha de emisión: ${d.fechaEmision}`, x, doc.y, {
      width: g.util,
      align: 'center',
    });
    doc.moveDown(0.3);

    this.lineaTicket(doc, g);

    // Adquirente.
    doc.fontSize(7);
    doc.text(`Señor(es): ${d.clienteRazonSocial}`, x, doc.y, { width: g.util });
    doc.text(`Documento: ${d.clienteDocumento}`, x, doc.y, { width: g.util });
    doc.text(`Moneda: ${d.moneda}`, x, doc.y, { width: g.util });
    doc.moveDown(0.3);
    this.lineaTicket(doc, g);

    // Detalle en dos renglones por línea.
    for (const linea of d.lineas) {
      const cant = `${linea.cantidad} ${linea.unidad} x ${monto(linea.valorUnitario)}`;
      doc.fontSize(7).text(linea.descripcion, x, doc.y, { width: g.util });
      const yFila = doc.y;
      doc.text(cant, x, yFila, { width: g.util * 0.6 });
      doc.text(monto(linea.total), x + g.util * 0.6, yFila, {
        width: g.util * 0.4,
        align: 'right',
      });
      doc.y = Math.max(doc.y, yFila) + 2;
    }

    this.lineaTicket(doc, g);

    // Totales apilados a la derecha.
    const filas: [string, number][] = [];
    if (d.gravado > 0) filas.push(['Op. gravada', d.gravado]);
    if (d.exonerado > 0) filas.push(['Op. exonerada', d.exonerado]);
    if (d.inafecto > 0) filas.push(['Op. inafecta', d.inafecto]);
    filas.push(['IGV (18%)', d.igv]);
    if (d.icbper > 0) filas.push(['ICBPER', d.icbper]);
    if (d.detraccion > 0) filas.push(['Detracción SPOT', -d.detraccion]);

    for (const [etiqueta, valor] of filas) {
      const y = doc.y;
      doc.fontSize(7).text(etiqueta, x, y, { width: g.util * 0.55 });
      doc.text(monto(valor), x + g.util * 0.55, y, {
        width: g.util * 0.45,
        align: 'right',
      });
      doc.y = y + 9;
    }

    this.lineaTicket(doc, g);

    const yTotal = doc.y;
    doc.fontSize(9).text('IMPORTE TOTAL', x, yTotal, { width: g.util * 0.55 });
    doc.text(`S/ ${monto(d.total)}`, x + g.util * 0.55, yTotal, {
      width: g.util * 0.45,
      align: 'right',
    });
    doc.y = yTotal + 13;

    // Leyenda 1000 en el ticket: en una sola columna, sin recuadro.
    doc.fontSize(6.5).text(`SON: ${d.montoEnLetras}`, x, doc.y, {
      width: g.util,
    });
    doc.moveDown(0.3);

    if (d.detraccion > 0 && d.cuentaBancoNacion) {
      doc.fontSize(6.5).text(
        `Detracción: Banco de la Nación, cuenta ${d.cuentaBancoNacion}.`,
        x,
        doc.y,
        { width: g.util },
      );
      doc.moveDown(0.3);
    }

    // El QR de SUNAT es obligatorio también en el ticket.
    const base64 = d.qrBase64.replace(/^data:image\/png;base64,/, '');
    if (base64) {
      try {
        const lado = Math.min(90, g.util);
        doc.image(Buffer.from(base64, 'base64'), x + (g.util - lado) / 2, doc.y, {
          width: lado,
        });
        doc.y += lado + 4;
      } catch {
        doc.fontSize(7).text('(QR no disponible)', x, doc.y, {
          width: g.util,
          align: 'center',
        });
      }
    }

    doc.fontSize(6).fillColor('#555').text(
      'Representación impresa de un comprobante electrónico. ' +
        'Consulte su validez en el portal de SUNAT.',
      x,
      doc.y,
      { width: g.util, align: 'center' },
    );
    doc.fillColor('#000');
  }

  /** Separador discontinuo del ticket. */
  private lineaTicket(doc: PDFKit.PDFDocument, g: Geometria): void {
    const y = doc.y + 2;
    doc
      .moveTo(g.margen, y)
      .lineTo(g.margen + g.util, y)
      .dash(1, { space: 2 })
      .strokeColor('#888')
      .stroke()
      .undash();
    doc.y = y + 4;
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
