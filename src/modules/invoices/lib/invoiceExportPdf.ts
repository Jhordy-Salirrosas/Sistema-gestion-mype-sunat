/**
 * Construcción del PDF binario homologado del comprobante (M1).
 *
 * Genera un flujo `%PDF-1.4` real en memoria con el recuadro del RUC, los datos
 * del CPE, el desglose tributario, la glosa en letras, el Hash y la trama QR.
 * No usa librerías externas: los objetos PostScript se escriben a mano.
 */
import type { ComprobanteDemo } from '../data/invoiceDemoTypes';
import { montoEnLetrasSunat, generarTramaQrSunat } from './invoiceCreditAndRules';
import { identidadEmisora } from './invoiceExportConstants';

/** Escapa paréntesis y barras para el literal de texto de PostScript. */
const ps = (texto: string): string =>
  texto.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');

/** Formatea un monto con dos decimales y separador de miles. */
const monto = (valor: number): string =>
  valor.toLocaleString('es-PE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

/** Líneas de texto que componen el recuadro del comprobante. */
const lineasContenido = (c: ComprobanteDemo): string[] => {
  const numeroSerie = `${c.serie}-${String(c.correlativo).padStart(4, '0')}`;
  // El RUC y la razón social salen de la empresa activa, no de un literal: el
  // QR impreso debe llevar el mismo RUC con el que el backend firmó el XML.
  const emisor = identidadEmisora();
  const trama = generarTramaQrSunat({
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
const streamContenido = (c: ComprobanteDemo): string => {
  const lineas = lineasContenido(c);
  const comandos = ['BT', '/F1 9 Tf', '14 TL', '40 800 Td'];

  lineas.forEach((linea) => {
    comandos.push(`(${ps(linea)}) Tj T*`);
  });
  comandos.push('ET');

  return comandos.join('\n');
};

/**
 * Construye el PDF binario completo en formato `%PDF-1.4`.
 *
 * Los offsets de la tabla `xref` se calculan sobre el flujo ya serializado.
 */
export const construirPdfBinarioSunat = (c: ComprobanteDemo): string => {
  const contenido = streamContenido(c);

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
export const descargarPdfComprobante = (c: ComprobanteDemo): void => {
  const blob = new Blob([construirPdfBinarioSunat(c)], {
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
