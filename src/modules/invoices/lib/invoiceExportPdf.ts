/**
 * Construcción del PDF binario homologado del comprobante (M1).
 *
 * Genera un flujo `%PDF-1.4` real en memoria con el recuadro del RUC, los datos
 * del CPE, el desglose tributario, la glosa en letras, el Hash y la trama QR.
 * Los objetos PDF se escriben a mano y qrcode-generator calcula los módulos QR.
 */
import qrcode from 'qrcode-generator';
import { extraerDigestValue, obtenerXmlDesdeBackend } from './invoiceDescarga';
import type { ComprobanteDemo } from '../data/invoiceDemoTypes';
import { montoEnLetrasSunat, generarTramaQrSunat } from './invoiceCreditAndRules';
import { identidadEmisora, cargarIdentidadEmisora, type IdentidadEmisora } from './invoiceExportConstants';

/** Escapa paréntesis y barras para el literal de texto de PostScript. */
const ps = (texto: string): string =>
  texto.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');

/** Formatea un monto con dos decimales y separador de miles. */
const monto = (valor: number): string =>
  valor.toLocaleString('es-PE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

/** La misma trama alimenta el texto y los módulos del QR de todos los tipos. */
export const tramaQrDelComprobante = (c: ComprobanteDemo, emisor: IdentidadEmisora = identidadEmisora()): string => {
  return generarTramaQrSunat({
    rucEmisor: emisor.ruc,
    tipo: c.tipo,
    serie: c.serie,
    correlativo: c.correlativo,
    igv: c.igv,
    total: c.totalNeto,
    fecha: c.fechaEmision,
    tipoDocCliente: c.clienteTipoDoc,
    numDocCliente: c.clienteRuc,
    hashCpe: c.hashCpe,
  });
};

/** Dibuja módulos vectoriales con zona blanca de cuatro módulos. */
export const comandosQrPdf = (trama: string): string => {
  const qr = qrcode(0, 'M');
  qr.addData(trama);
  qr.make();
  const n = qr.getModuleCount();
  const escala = 120 / (n + 8);
  const comandos = ['% QR SUNAT', 'q', '1 g', '435 30 120 120 re f', '0 g'];
  for (let fila = 0; fila < n; fila += 1) {
    for (let col = 0; col < n; col += 1) {
      if (qr.isDark(fila, col)) comandos.push(`${(435 + (col + 4) * escala).toFixed(4)} ${(30 + (n + 3 - fila) * escala).toFixed(4)} ${escala.toFixed(4)} ${escala.toFixed(4)} re f`);
    }
  }
  comandos.push('Q');
  return comandos.join('\n');
};

/** Líneas de texto que componen el recuadro del comprobante. */
const lineasContenido = (c: ComprobanteDemo, emisor: IdentidadEmisora): string[] => {
  const numeroSerie = `${c.serie}-${String(c.correlativo).padStart(4, '0')}`;
  // El membrete y la trama reciben la misma identidad efectiva resuelta.
  const trama = tramaQrDelComprobante(c, emisor);

  return [
    'EMPRESA EMISORA',
    `${emisor.razonSocial || '(empresa sin razón social en sesión)'}`,
    `R.U.C. N° ${emisor.ruc || '(sin RUC en sesión)'}`,
    '',
    `COMPROBANTE ELECTRONICO: ${numeroSerie}`,
    `FECHA DE EMISION: ${c.fechaEmision}`,
    `CLIENTE: ${c.clienteRazonSocial}`,
    `RUC/DNI: ${c.clienteRuc}`,
    `FORMA DE PAGO: ${c.formaPago === 'Credito' ? 'CREDITO' : 'CONTADO'}`,
    ...c.cuotas.map(
      (q) => `  ${q.numero}: S/ ${monto(q.monto)} vence ${q.vencimiento}`,
    ),
    '',
    'DETALLE',
    ...c.items.map(
      (it, i) =>
        `${i + 1}. ${it.descripcion} - ${it.cantidad} ${it.unidad} x ${monto(it.valorUnitario)}`,
    ),
    '',
    `BASE IMPONIBLE: S/ ${monto(c.baseImponible)}`,
    `IGV 18%: S/ ${monto(c.igv)}`,
    `DETRACCION SPOT: S/ ${monto(c.detraccion)}`,
    `RETENCION 3%: S/ ${monto(c.retencion)}`,
    `NETO A PAGAR: S/ ${monto(c.totalNeto)}`,
    '',
    montoEnLetrasSunat(c.totalNeto, c.moneda),
    '',
    `HASH SHA-256: ${c.hashCpe}`,
    `TRAMA QR: ${trama}`,
    `ESTADO SUNAT: ${c.estado} (${c.cdrCodigo ?? 'SIN CDR'})`,
    c.cdrDescripcion,
  ];
};

/** Construye el contenido del stream de texto del PDF. */
const streamContenido = (c: ComprobanteDemo, emisor: IdentidadEmisora): string => {
  const lineas = lineasContenido(c, emisor);
  const comandos = ['BT', '/F1 9 Tf', '14 TL', '40 800 Td'];

  lineas.forEach((linea) => {
    comandos.push(`(${ps(linea)}) Tj T*`);
  });
  comandos.push('ET');
  if (c.hashCpe) comandos.push(comandosQrPdf(tramaQrDelComprobante(c, emisor)));

  return comandos.join('\n');
};

/**
 * Construye el PDF binario completo en formato `%PDF-1.4`.
 *
 * Los offsets de la tabla `xref` se calculan sobre el flujo ya serializado.
 */
export const construirPdfBinarioSunat = (c: ComprobanteDemo, emisor: IdentidadEmisora = identidadEmisora()): string => {
  const contenido = streamContenido(c, emisor);

  const objetos = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>',
    `<< /Length ${contenido.length} >>\nstream\n${contenido}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ];

  let pdf = '%PDF-1.4\n';
  const offsets: number[] = [];

  objetos.forEach((cuerpo, i) => {
    offsets.push(pdf.length);
    pdf += `${i + 1} 0 obj\n${cuerpo}\nendobj\n`;
  });

  const inicioXref = pdf.length;
  const total = objetos.length + 1;

  pdf += `xref\n0 ${total}\n0000000000 65535 f \n`;
  offsets.forEach((off) => {
    pdf += `${String(off).padStart(10, '0')} 00000 n \n`;
  });

  pdf += `trailer\n<< /Size ${total} /Root 1 0 R >>\nstartxref\n${inicioXref}\n%%EOF\n`;

  return pdf;
};

/** Nombre del archivo PDF según la convención del módulo. */
export const nombreArchivoPdf = (c: ComprobanteDemo): string =>
  `${c.serie}-${String(c.correlativo).padStart(4, '0')}.pdf`;

/** Descarga el PDF homologado con MIME application/pdf. */
export const descargarPdfComprobante = async (c: ComprobanteDemo): Promise<void> => {
  const [xml, emisor] = await Promise.all([obtenerXmlDesdeBackend(c.id), cargarIdentidadEmisora()]);
  const digest = extraerDigestValue(xml);
  if (!digest) throw new Error('El XML firmado aún no está disponible para generar el PDF con QR.');
  const firmado = { ...c, hashCpe: digest };
  const blob = new Blob([construirPdfBinarioSunat(firmado, emisor)], {
    type: 'application/pdf',
  });
  const url = URL.createObjectURL(blob);
  const enlace = document.createElement('a');
  enlace.href = url;
  enlace.download = nombreArchivoPdf(c);
  document.body.appendChild(enlace);
  enlace.click();
  document.body.removeChild(enlace);
  URL.revokeObjectURL(url);
};
