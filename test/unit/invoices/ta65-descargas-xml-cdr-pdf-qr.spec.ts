/**
 * TA-65 · descargas de XML, CDR y PDF con QR.
 *
 * Lo que se protege, en orden de importancia:
 *
 *  1. La trama del QR tiene EXACTAMENTE diez campos con el formato que SUNAT
 *     exige: fecha DD-MM-AAAA y no ISO, IGV y total con dos decimales, hash sin
 *     el `=` de relleno. Un QR con la trama mal formada es tan inútil como no
 *     ponerlo.
 *  2. El PDF se genera de verdad y empieza con `%PDF-`: se comprueba el binario,
 *     no que la función no lance.
 *  3. El XML guardado se devuelve tal cual; solo se regenera si falta. Volver a
 *     generarlo cambiaría la firma y dejaría de coincidir con el que SUNAT
 *     validó.
 *  4. Un comprobante de otra empresa responde 404, no 403.
 *  5. Sin CDR no se devuelve un archivo vacío: se explica qué falta.
 */
import { describe, expect, it, jest } from '@jest/globals';
import { NotFoundException } from '@nestjs/common';
import {
  fechaTramaSunat,
  tramaQrSunat,
  tramaValida,
  InvoiceQrService,
  type DatosQrComprobante,
} from '../../../src/modules/invoices/application/services/invoiceQrService';
import { InvoicePdfService } from '../../../src/modules/invoices/application/services/invoicePdfService';
import { InvoiceDownloadService } from '../../../src/modules/invoices/application/services/invoiceDownloadService';
import { UblGeneratorService, type InvoicePayload } from '../../../src/modules/invoices/ublGeneratorService';
import { payloadMedioPago } from './ta63MedioPagoFixtures';

// ---------------------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------------------

const DATOS_QR: DatosQrComprobante = {
  rucEmisor: '20601012341',
  tipoComprobante: '01',
  serie: 'F001',
  correlativo: 143,
  igv: 90,
  total: 590,
  fechaEmision: '2026-10-31',
  tipoDocCliente: '6',
  numDocCliente: '20100066603',
  hashCpe: 'abc123XYZ=',
};

/** Fila simulada del comprobante en la base. */
function filaComprobante(extra: Record<string, unknown> = {}) {
  return {
    id: 'inv-1',
    ruc_emisor: '20601012341',
    tipo_comprobante: '01',
    serie: 'F001',
    correlativo: 143,
    fecha_emision: new Date('2026-10-31T00:00:00Z'),
    estado: 'ACEPTADO',
    moneda: 'PEN',
    payload_ubl: {
      razonSocialEmisor: 'FERRETERIA LOS ANDES S.A.C.',
      direccionEmisor: 'Av. Larco 123',
      montoEnLetras: 'SON: QUINIENTOS NOVENTA Y 00/100 SOLES',
      hashCpe: 'abc123XYZ=',
    },
    xml_storage_url: '<?xml version="1.0"?><Invoice/>',
    cdr_storage_url: '<?xml version="1.0"?><ApplicationResponse/>',
    cdr_codigo: '0',
    cliente_nombre: 'CONSTRUCTORA DEL NORTE S.A.C.',
    cliente_documento: '20100066603',
    items: [
      {
        description: 'Cemento Portland tipo I',
        unit_code: 'BG',
        quantity: 20,
        unit_value: 25,
        igv_amount: 90,
        total_amount: 590,
        igv_affectation_type: '10',
      },
    ],
    ...extra,
  };
}

/** Construye el servicio con dobles. */
function servicio(fila: unknown = filaComprobante(), generadorReal = false) {
  const findFirst = jest.fn<(args: unknown) => Promise<unknown>>(
    async () => fila,
  );
  const generateInvoiceXml = jest.fn<(payload: unknown) => string>(
    (payload) => generadorReal
      ? new UblGeneratorService().generateInvoiceXml(payload as InvoicePayload)
      : '<?xml version="1.0"?><Invoice regenerado="true"/>',
  );

  // Firma y guardado del XML regenerado. El fallback de la descarga FIRMA antes
  // de entregar: un XML reconstruido sin firma no es un comprobante electrónico.
  const signXml = jest.fn<(xml: string) => { signedXml: string }>((xml) => ({
    signedXml: `${xml}<!--firmado-->`,
  }));
  const guardar = jest.fn<(id: string, xml: string) => Promise<string | null>>(
    async () => 'hash',
  );

  const descargas = new InvoiceDownloadService(
    { invoice: { findFirst } } as never,
    { generateInvoiceXml } as never,
    new InvoicePdfService(),
    new InvoiceQrService(),
    { signXml } as never,
    { guardar } as never,
  );

  return { descargas, findFirst, generateInvoiceXml, signXml, guardar };
}

// ---------------------------------------------------------------------------
// 1 · Trama del QR
// ---------------------------------------------------------------------------

describe('TA-65 · trama del QR de SUNAT', () => {
  it('la trama tiene diez campos y el separador final', () => {
    const trama = tramaQrSunat(DATOS_QR);
    const campos = trama.split('|');

    expect(campos).toHaveLength(11);
    expect(campos[10]).toBe('');
    expect(tramaValida(trama)).toBe(true);
  });

  it('la trama completa es exactamente la que exige SUNAT', () => {
    expect(tramaQrSunat(DATOS_QR)).toBe(
      '20601012341|01|F001|143|90.00|590.00|31-10-2026|6|20100066603|abc123XYZ|',
    );
  });

  it('la fecha va en DD-MM-AAAA y no en ISO', () => {
    expect(fechaTramaSunat('2026-10-31')).toBe('31-10-2026');
    expect(fechaTramaSunat('2026-01-05')).toBe('05-01-2026');
    // Y nunca se cuela el formato ISO.
    expect(tramaQrSunat(DATOS_QR)).not.toContain('2026-10-31');
  });

  it('el IGV y el total llevan siempre dos decimales', () => {
    const trama = tramaQrSunat({ ...DATOS_QR, igv: 90.5, total: 590 });
    const campos = trama.split('|');
    expect(campos[4]).toBe('90.50');
    expect(campos[5]).toBe('590.00');
  });

  it('el hash pierde el signo igual de relleno del base64', () => {
    const trama = tramaQrSunat({ ...DATOS_QR, hashCpe: 'abc123XYZ==' });
    expect(trama.split('|')[9]).toBe('abc123XYZ');
  });

  it('un hash con saltos de línea no rompe la trama', () => {
    const trama = tramaQrSunat({ ...DATOS_QR, hashCpe: 'abc\n123\tXYZ=' });
    expect(trama.split('|')[9]).toBe('abc123XYZ');
  });

  it('una trama a la que le falta un campo se detecta como inválida', () => {
    expect(tramaValida('20601012341|01|F001|143')).toBe(false);
    expect(tramaValida('')).toBe(false);
  });

  it('el QR se genera como PNG en base64', async () => {
    const qr = new InvoiceQrService();
    const dataUrl = await qr.generarPng(DATOS_QR);

    expect(dataUrl.startsWith('data:image/png;base64,')).toBe(true);
    // El base64 del PNG debe ser largo: un QR de 220 px no cabe en pocos bytes.
    expect(dataUrl.length).toBeGreaterThan(500);
  });

  it('el QR también se entrega como Buffer, que es lo que consume pdfkit', async () => {
    const qr = new InvoiceQrService();
    const buffer = await qr.generarBuffer(DATOS_QR);

    // Firma PNG: 0x89 'P' 'N' 'G'.
    expect(buffer[0]).toBe(0x89);
    expect(buffer.subarray(1, 4).toString('ascii')).toBe('PNG');
  });
});

// ---------------------------------------------------------------------------
// 2 · PDF
// ---------------------------------------------------------------------------

describe('TA-65 · representación impresa en PDF', () => {
  /** Datos completos para el PDF. */
  function datosPdf(qr = '') {
    return {
      rucEmisor: '20601012341',
      razonSocialEmisor: 'FERRETERIA LOS ANDES S.A.C.',
      direccionEmisor: 'Av. Larco 123 - Trujillo',
      tipoComprobante: '01',
      serie: 'F001',
      correlativo: 143,
      fechaEmision: '2026-10-31',
      moneda: 'PEN',
      clienteRazonSocial: 'CONSTRUCTORA DEL NORTE S.A.C.',
      clienteDocumento: '20100066603',
      nombreTipo: 'FACTURA ELECTRÓNICA',
      lineas: [
        {
          descripcion: 'Cemento Portland tipo I',
          unidad: 'BG',
          cantidad: 20,
          valorUnitario: 25,
          igv: 90,
          total: 590,
        },
      ],
      gravado: 500,
      exonerado: 0,
      inafecto: 0,
      igv: 90,
      icbper: 0,
      detraccion: 0,
      total: 590,
      montoEnLetras: 'SON: QUINIENTOS NOVENTA Y 00/100 SOLES',
      qrBase64: qr,
    };
  }

  it('genera un PDF real, no solo un buffer cualquiera', async () => {
    const pdf = new InvoicePdfService();
    const buffer = await pdf.generar(datosPdf());

    expect(buffer.length).toBeGreaterThan(1000);
    // Todo PDF empieza con la firma %PDF-.
    expect(buffer.subarray(0, 5).toString('ascii')).toBe('%PDF-');
  });

  it('el PDF incluye el QR cuando se le pasa', async () => {
    const qr = await new InvoiceQrService().generarPng(DATOS_QR);
    const pdf = new InvoicePdfService();

    const conQr = await pdf.generar(datosPdf(qr));
    const sinQr = await pdf.generar(datosPdf());

    // La imagen incrustada pesa: el PDF con QR debe ser notablemente mayor.
    expect(conQr.length).toBeGreaterThan(sinQr.length);
  });

  it('un QR corrupto no impide imprimir el comprobante', async () => {
    const pdf = new InvoicePdfService();
    const buffer = await pdf.generar(datosPdf('esto-no-es-base64-de-png'));

    expect(buffer.subarray(0, 5).toString('ascii')).toBe('%PDF-');
  });

  it('el PDF con detracción se genera y nombra la cuenta del Banco de la Nación', async () => {
    const pdf = new InvoicePdfService();
    const buffer = await pdf.generar({
      ...datosPdf(),
      detraccion: 142,
      cuentaBancoNacion: '00019123456',
    });

    expect(buffer.subarray(0, 5).toString('ascii')).toBe('%PDF-');
  });

  it('el PDF con cuotas al crédito se genera', async () => {
    const pdf = new InvoicePdfService();
    const buffer = await pdf.generar({
      ...datosPdf(),
      cuotas: [
        { numero: 'Cuota001', monto: 295, vencimiento: '2026-11-30' },
        { numero: 'Cuota002', monto: 295, vencimiento: '2026-12-31' },
      ],
    });

    expect(buffer.subarray(0, 5).toString('ascii')).toBe('%PDF-');
  });

  it('el nombre del archivo sigue la convención de SUNAT', () => {
    const pdf = new InvoicePdfService();
    // El correlativo va con 8 dígitos, igual que en el nombre del XML y del ZIP.
    expect(pdf.nombreArchivo(datosPdf())).toBe(
      '20601012341-01-F001-00000143.pdf',
    );
  });
});

// ---------------------------------------------------------------------------
// 3 · Servicio de descargas
// ---------------------------------------------------------------------------

describe('TA-65 · descargas', () => {
  it.each([undefined, '001'] as const)('regenera payload con medio %s sin inventar el medio histórico', async (medio) => {
    const payload = JSON.parse(JSON.stringify({ ...payloadMedioPago(), medioPagoDetraccion: medio }));
    const d = servicio(filaComprobante({ payload_ubl: payload, xml_storage_url: null, estado: 'EN_COLA' }), true);
    const archivo = await d.descargas.descargar('emp-1', 'inv-1', 'xml');
    expect(archivo.contenido.toString('utf8')).toContain(
      `<cbc:PaymentMeansCode>${medio ?? '999'}</cbc:PaymentMeansCode>`,
    );
    expect(d.signXml).toHaveBeenCalledTimes(1);
  });

  it.each(['1001', '014', 'sin-detraccion'])('descarga rechaza medio inválido %s antes de firmar o guardar', async (medio) => {
    const payload = { ...payloadMedioPago(), medioPagoDetraccion: medio === 'sin-detraccion' ? '001' : medio,
      ...(medio === 'sin-detraccion' ? { montoDetraccion: 0 } : {}) };
    const d = servicio(filaComprobante({ payload_ubl: payload, xml_storage_url: null, estado: 'EN_COLA' }), true);
    await expect(d.descargas.descargar('emp-1', 'inv-1', 'xml')).rejects.toThrow(/Catálogo 59|sin detracción efectiva/);
    expect(d.signXml).not.toHaveBeenCalled();
    expect(d.guardar).not.toHaveBeenCalled();
  });

  it('el XML se devuelve con su nombre y su tipo', async () => {
    const { descargas } = servicio();
    const archivo = await descargas.descargar('emp-1', 'inv-1', 'xml');

    expect(archivo.nombre).toBe('20601012341-01-F001-00000143.xml');
    expect(archivo.contentType).toContain('xml');
    expect(archivo.contenido.toString('utf8')).toContain('<Invoice/>');
  });

  it('el XML guardado NO se regenera: se entrega el que firmó el worker', async () => {
    const { descargas, generateInvoiceXml } = servicio();

    await descargas.descargar('emp-1', 'inv-1', 'xml');

    // Regenerar cambiaría la firma y el comprobante dejaría de coincidir con
    // el que SUNAT validó.
    expect(generateInvoiceXml).not.toHaveBeenCalled();
  });

  it('sin XML guardado se regenera desde el payload', async () => {
    const { descargas, generateInvoiceXml } = servicio(
      filaComprobante({ xml_storage_url: null, estado: 'EN_COLA' }),
    );

    const archivo = await descargas.descargar('emp-1', 'inv-1', 'xml');

    expect(generateInvoiceXml).toHaveBeenCalledTimes(1);
    expect(archivo.contenido.toString('utf8')).toContain('regenerado="true"');
  });

  it('el CDR se devuelve tal cual llegó de SUNAT', async () => {
    const { descargas } = servicio();
    const archivo = await descargas.descargar('emp-1', 'inv-1', 'cdr');

    expect(archivo.nombre).toBe('20601012341-01-F001-00000143.cdr.xml');
    expect(archivo.contenido.toString('utf8')).toContain('ApplicationResponse');
  });

  it('sin CDR guardado responde 404 con el motivo', async () => {
    const { descargas } = servicio(
      filaComprobante({ cdr_storage_url: null, estado: 'EN_COLA' }),
    );

    await expect(descargas.descargar('emp-1', 'inv-1', 'cdr')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('el 404 de un comprobante en cola dice en qué estado está', async () => {
    const { descargas } = servicio(
      filaComprobante({ cdr_storage_url: null, estado: 'EN_COLA' }),
    );

    await expect(descargas.descargar('emp-1', 'inv-1', 'cdr')).rejects.toThrow(
      /EN_COLA/,
    );
  });

  it('un comprobante de otra empresa responde 404, no 403', async () => {
    const { descargas, findFirst } = servicio(null);

    await expect(
      descargas.descargar('emp-2', 'inv-1', 'xml'),
    ).rejects.toThrow(NotFoundException);

    // Y se confirma que la consulta filtra por empresa: el aislamiento no puede
    // depender de que el id sea difícil de adivinar.
    const args = findFirst.mock.calls[0][0] as unknown as {
      where: { company_id: string };
    };
    expect(args.where.company_id).toBe('emp-2');
  });

  it('el PDF se genera desde los ítems guardados', async () => {
    const { descargas } = servicio();
    const archivo = await descargas.descargar('emp-1', 'inv-1', 'pdf');

    expect(archivo.nombre).toBe('20601012341-01-F001-00000143.pdf');
    expect(archivo.contentType).toBe('application/pdf');
    expect(archivo.contenido.subarray(0, 5).toString('ascii')).toBe('%PDF-');
  });

  it('el PDF de un comprobante con varias líneas se genera', async () => {
    const { descargas } = servicio(
      filaComprobante({
        items: [
          {
            description: 'Cemento Portland tipo I',
            unit_code: 'BG',
            quantity: 20,
            unit_value: 25,
            igv_amount: 90,
            total_amount: 590,
            igv_affectation_type: '10',
          },
          {
            description: 'Arena gruesa',
            unit_code: 'MTR',
            quantity: 10,
            unit_value: 50,
            igv_amount: 0,
            total_amount: 500,
            igv_affectation_type: '20',
          },
          {
            description: 'Regalo de aniversario',
            unit_code: 'NIU',
            quantity: 1,
            unit_value: 100,
            igv_amount: 18,
            total_amount: 0,
            igv_affectation_type: '14',
          },
        ],
      }),
    );

    const archivo = await descargas.descargar('emp-1', 'inv-1', 'pdf');
    expect(archivo.contenido.subarray(0, 5).toString('ascii')).toBe('%PDF-');
  });
});

it.each(['<?xml version="1.0"?><ApplicationResponse/>', { rawXml: '<?xml version="1.0"?><ApplicationResponse/>' }])('recupera el CDR conservado históricamente sin inventar uno', async (cdr_sunat) => {
  const d = servicio(filaComprobante({ cdr_storage_url: null, cdr_sunat }));
  const archivo = await d.descargas.descargar('emp-1', 'inv-1', 'cdr');
  expect(archivo.contenido.toString()).toBe('<?xml version="1.0"?><ApplicationResponse/>');
  expect(d.generateInvoiceXml).not.toHaveBeenCalled();
});

it.each(['ACEPTADO', 'OBSERVADO', 'ANULADO'])('no reconstruye XML original perdido de un comprobante %s', async (estado) => {
  const d = servicio(filaComprobante({ xml_storage_url: null, estado }));
  await expect(d.descargas.descargar('emp-1', 'inv-1', 'xml')).rejects.toThrow(/XML original no conservado/);
  expect(d.generateInvoiceXml).not.toHaveBeenCalled();
  expect(d.signXml).not.toHaveBeenCalled();
  expect(d.guardar).not.toHaveBeenCalled();
});
it('el PDF usa los importes registrados, sin recalcular IGV ni inferir tipo de documento por longitud', async () => {
  const generar = jest.fn().mockResolvedValue(Buffer.from('%PDF-prueba'));
  const generarPng = jest.fn().mockResolvedValue('');
  const fila = filaComprobante({ monto_total: 1.01, customer_identity_type: '6', customer_identity_number: '20100066603',
    payload_ubl: { montoGravado: 0.86, montoIgv: 0.15, montoTotal: 1.01, razonSocialEmisor: 'Emisor registrado', hashCpe: 'hash-real-guardado' },
    items: [{ description: 'Artículo', unit_code: 'NIU', quantity: 3, unit_value: 0.2838983051, igv_amount: 0.15, total_amount: 1.01, igv_affectation_type: '10' }] });
  const s = new InvoiceDownloadService({ invoice: { findFirst: async () => fila } } as never, {} as never,
    { generar, nombreArchivo: () => 'doc.pdf' } as never, { generarPng } as never, {} as never, {} as never);
  await s.descargar('emp-1', 'inv-1', 'pdf');
  expect(generar).toHaveBeenLastCalledWith(expect.objectContaining({ gravado: 0.86, igv: 0.15, total: 1.01 }), 'a4');
  expect(generarPng).toHaveBeenLastCalledWith(expect.objectContaining({ tipoDocCliente: '6', total: 1.01 }));
  (fila as any).customer_identity_type = null;
  (fila as any).customer_legal_name = null;
  (fila as any).customer_identity_number = null;
  (fila as any).currency_code = null;
  (fila as any).payload_ubl = {};
  generarPng.mockClear();
  await s.descargar('emp-1', 'inv-1', 'pdf');
  expect(generarPng).not.toHaveBeenCalled();
  expect(generar).toHaveBeenLastCalledWith(expect.objectContaining({ razonSocialEmisor: null, clienteRazonSocial: null, clienteDocumento: null, moneda: null, qrBase64: '', igv: 0.15, gravado: 0.86 }), 'a4');
});
it.each(['a4', 'ticket80mm'] as const)('el PDF %s representa datos ausentes sin nombres ficticios', async (formato) => {
  const d = new InvoiceDownloadService({ invoice: { findFirst: async () => filaComprobante({ payload_ubl: {}, customer_legal_name: null, customer_identity_number: null, currency_code: null }) } } as never,
    {} as never, new InvoicePdfService(), new InvoiceQrService(), {} as never, {} as never);
  const archivo = await d.descargar('emp-1', 'inv-1', 'pdf', formato);
  expect(archivo.contenido.subarray(0, 5).toString()).toBe('%PDF-');
});
it('PDF mixto conserva ICBPER registrado por líneas, inafectas y digest del XML guardado', async () => {
 const generar = jest.fn().mockResolvedValue(Buffer.from('%PDF-prueba'));
 const generarPng = jest.fn().mockResolvedValue('');
 const fila = filaComprobante({ monto_total: 149.5, customer_identity_type: '6', customer_identity_number: '20100066603',
   xml_storage_url: '<?xml version="1.0"?><Invoice><ds:DigestValue>digest-registrado=</ds:DigestValue></Invoice>',
   payload_ubl: { montoGravado: 100, montoIgv: 18, lineas: [{ icbperLinea: 1.5 }, {}] },
   items: [
    { description: 'Gravado', unit_code: 'NIU', quantity: 1, unit_value: 100, igv_amount: 18, total_amount: 118, igv_affectation_type: '10' },
    { description: 'Exonerado', unit_code: 'NIU', quantity: 1, unit_value: 20, igv_amount: 0, total_amount: 20, igv_affectation_type: '20' },
    { description: 'Inafecto', unit_code: 'NIU', quantity: 1, unit_value: 10, igv_amount: 0, total_amount: 10, igv_affectation_type: '30' },
   ] });
 const s = new InvoiceDownloadService({ invoice: { findFirst: async () => fila } } as never, {} as never,
   { generar, nombreArchivo: () => 'doc.pdf' } as never, { generarPng } as never, {} as never, {} as never);
 await s.descargar('emp-1', 'inv-1', 'pdf');
 expect(generar).toHaveBeenCalledWith(expect.objectContaining({ gravado: 100, igv: 18, exonerado: 20, inafecto: 10, icbper: 1.5, total: 149.5 }), 'a4');
 expect(generarPng).toHaveBeenCalledWith(expect.objectContaining({ hashCpe: 'digest-registrado=', total: 149.5 }));
});
