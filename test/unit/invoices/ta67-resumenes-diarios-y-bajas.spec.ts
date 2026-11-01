/**
 * TA-67 · resumen diario (RC) y comunicación de baja (RA).
 *
 * Lo que se protege:
 *
 *  1. El resumen lleva SOLO boletas y sus notas. Colar una factura hace rechazar
 *     el resumen completo, y las facturas se envían aparte con `sendBill`.
 *  2. Lo rechazado y lo anulado no entran al resumen: incluirlo resucita un
 *     comprobante que el contribuyente quiso retirar.
 *  3. Solo se da de baja lo que SUNAT ya aceptó u observó.
 *  4. El XML de resumen y de baja se genera con la estructura que exige SUNAT,
 *     con un identificador RA-AAAAMMDD-NNN / RC-AAAAMMDD-NNN.
 */
import { describe, expect, it } from '@jest/globals';
import { BadRequestException } from '@nestjs/common';
import {
  construirComunicacionBaja,
  construirResumenDiario,
  diasDesdeEmision,
  esc,
  excluidoDelResumen,
  vaEnBaja,
  vaEnResumen,
  type CabeceraResumen,
  type ComprobanteAgregado,
} from '../../../src/modules/invoices/application/services/summaryDocumentsBuilder';
import {
  construirSobreGetStatus,
  construirSobreSendSummary,
  extraerEtiqueta,
  parseGetStatusResponse,
  parseSendSummaryResponse,
} from '../../../src/modules/sunat/soap/sunatSummaryOperations';

const CABECERA: CabeceraResumen = {
  rucEmisor: '20601012341',
  razonSocialEmisor: 'FERRETERIA LOS ANDES S.A.C.',
  correlativo: 1,
  fechaResumen: '2026-10-31',
  fechaGeneracion: '2026-11-01',
};

/** Boleta aceptada de S/ 590 (500 de base + 90 de IGV). */
function boleta(extra: Partial<ComprobanteAgregado> = {}): ComprobanteAgregado {
  return {
    tipoComprobante: '03',
    serie: 'B001',
    correlativo: 25,
    fechaEmision: '2026-10-31',
    estado: 'ACEPTADO',
    total: 590,
    igv: 90,
    tipoDocCliente: '1',
    numDocCliente: '70123456',
    ...extra,
  };
}

// ---------------------------------------------------------------------------
// 1 · Qué comprobante pertenece a un resumen
// ---------------------------------------------------------------------------

describe('TA-67 · pertenencia al resumen diario', () => {
  it('una boleta pertenece al resumen', () => {
    expect(vaEnResumen(boleta())).toBe(true);
  });

  it('una factura NO pertenece al resumen', () => {
    expect(vaEnResumen(boleta({ tipoComprobante: '01', serie: 'F001' }))).toBe(
      false,
    );
  });

  it('una nota de crédito a boleta sí pertenece', () => {
    expect(
      vaEnResumen(
        boleta({
          tipoComprobante: '07',
          serie: 'BC01',
          documentoAfectado: 'B001-00000025',
        }),
      ),
    ).toBe(true);
  });

  it('una nota de crédito a FACTURA no pertenece al resumen de boletas', () => {
    expect(
      vaEnResumen(boleta({ tipoComprobante: '07', serie: 'FC01' })),
    ).toBe(false);
  });

  it('lo rechazado y lo anulado se excluyen del resumen', () => {
    expect(excluidoDelResumen(boleta({ estado: 'RECHAZADO' }))).toBe(true);
    expect(excluidoDelResumen(boleta({ estado: 'ANULADO' }))).toBe(true);
    expect(excluidoDelResumen(boleta({ estado: 'ACEPTADO' }))).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 2 · XML del resumen diario
// ---------------------------------------------------------------------------

describe('TA-67 · XML del resumen diario', () => {
  it('genera un SummaryDocuments con la estructura que exige SUNAT', () => {
    const xml = construirResumenDiario(CABECERA, [boleta()]);

    expect(xml).toContain('<SummaryDocuments xmlns="urn:sunat:names:specification:ubl:peru:schema:xsd:SummaryDocuments-1"');
    expect(xml).toContain('<cbc:UBLVersionID>2.0</cbc:UBLVersionID>');
    expect(xml).toContain('<cbc:CustomizationID>1.1</cbc:CustomizationID>');
    expect(xml).toContain('<cac:SummaryDocumentsLine>');
    expect(xml).toContain('<cbc:DocumentTypeCode>03</cbc:DocumentTypeCode>');
  });

  it('el identificador del resumen es RC-AAAAMMDD-NNN', () => {
    const xml = construirResumenDiario(CABECERA, [boleta()]);
    expect(xml).toContain('<cbc:ID>RC-20261031-001</cbc:ID>');
  });

  it('el número de la boleta va con el correlativo de 8 dígitos', () => {
    const xml = construirResumenDiario(CABECERA, [boleta()]);
    expect(xml).toContain('<cbc:ID>B001-00000025</cbc:ID>');
  });

  it('el importe y el IGV salen del comprobante, con dos decimales', () => {
    const xml = construirResumenDiario(CABECERA, [boleta()]);
    expect(xml).toContain('<cac:TotalAmount currencyID="PEN">590.00</cac:TotalAmount>');
    expect(xml).toContain('<cbc:TaxAmount currencyID="PEN">90.00</cbc:TaxAmount>');
    // La base es el total menos el IGV.
    expect(xml).toContain('<cbc:PaidAmount currencyID="PEN">500.00</cbc:PaidAmount>');
  });

  it('agrupa varias boletas en un solo XML', () => {
    const xml = construirResumenDiario(CABECERA, [
      boleta({ correlativo: 25 }),
      boleta({ correlativo: 26 }),
      boleta({ correlativo: 27 }),
    ]);

    const lineas = xml.match(/<cac:SummaryDocumentsLine>/g) ?? [];
    expect(lineas).toHaveLength(3);
  });

  it('excluye del XML la boleta anulada y la rechazada', () => {
    const xml = construirResumenDiario(CABECERA, [
      boleta({ correlativo: 25 }),
      boleta({ correlativo: 26, estado: 'ANULADO' }),
      boleta({ correlativo: 27, estado: 'RECHAZADO' }),
    ]);

    expect(xml).toContain('B001-00000025');
    expect(xml).not.toContain('B001-00000026');
    expect(xml).not.toContain('B001-00000027');
  });

  it('rechaza el resumen si se coló una factura', () => {
    expect(() =>
      construirResumenDiario(CABECERA, [
        boleta(),
        boleta({ tipoComprobante: '01', serie: 'F001', correlativo: 143 }),
      ]),
    ).toThrow(BadRequestException);
  });

  it('el mensaje del error dice cuál comprobante no corresponde', () => {
    expect(() =>
      construirResumenDiario(CABECERA, [
        boleta({ tipoComprobante: '01', serie: 'F001', correlativo: 143 }),
      ]),
    ).toThrow(/F001-143/);
  });

  it('un resumen sin comprobantes útiles es un error, no un XML vacío', () => {
    expect(() =>
      construirResumenDiario(CABECERA, [boleta({ estado: 'ANULADO' })]),
    ).toThrow(/RESUMEN_VACIO|no tiene comprobantes/);
  });

  it('escapa el nombre del emisor con caracteres reservados', () => {
    const xml = construirResumenDiario(
      { ...CABECERA, razonSocialEmisor: 'FERRETERIA "EL & MEJOR" S.A.C.' },
      [boleta()],
    );

    expect(xml).toContain('FERRETERIA &quot;EL &amp; MEJOR&quot; S.A.C.');
    // Y el XML no queda con un & suelto que lo invalide.
    expect(xml).not.toMatch(/& (?!amp;)/);
  });
});

// ---------------------------------------------------------------------------
// 3 · Comunicación de baja
// ---------------------------------------------------------------------------

describe('TA-67 · comunicación de baja', () => {
  it('genera un VoidedDocuments con la estructura que exige SUNAT', () => {
    const xml = construirComunicacionBaja(CABECERA, [
      boleta({ tipoComprobante: '01', serie: 'F001', correlativo: 143 }),
    ]);

    expect(xml).toContain('<VoidedDocuments xmlns="urn:sunat:names:specification:ubl:peru:schema:xsd:VoidedDocuments-1"');
    expect(xml).toContain('<cbc:CustomizationID>1.0</cbc:CustomizationID>');
    expect(xml).toContain('<cac:VoidedDocumentsLine>');
  });

  it('el identificador de la baja es RA-AAAAMMDD-NNN', () => {
    const xml = construirComunicacionBaja(CABECERA, [
      boleta({ tipoComprobante: '01', serie: 'F001', correlativo: 143 }),
    ]);
    expect(xml).toContain('<cbc:ID>RA-20261031-001</cbc:ID>');
  });

  it('cada comprobante lleva su serie, su número y el motivo', () => {
    const xml = construirComunicacionBaja(CABECERA, [
      boleta({
        tipoComprobante: '01',
        serie: 'F001',
        correlativo: 143,
        motivoBaja: 'Error en el RUC del cliente',
      }),
    ]);

    expect(xml).toContain('<cbc:DocumentSerialID>F001</cbc:DocumentSerialID>');
    expect(xml).toContain('<cbc:DocumentNumberID>143</cbc:DocumentNumberID>');
    expect(xml).toContain('Error en el RUC del cliente');
  });

  it('rechaza dar de baja un comprobante que SUNAT no aceptó', () => {
    expect(() =>
      construirComunicacionBaja(CABECERA, [
        boleta({ tipoComprobante: '01', serie: 'F001', estado: 'EN_COLA' }),
      ]),
    ).toThrow(BadRequestException);
  });

  it('el mensaje del error dice el estado exacto del comprobante', () => {
    expect(() =>
      construirComunicacionBaja(CABECERA, [
        boleta({
          tipoComprobante: '01',
          serie: 'F001',
          correlativo: 25,
          estado: 'ERROR_RED',
        }),
      ]),
    ).toThrow(/F001-25.*ERROR_RED/);
  });

  it('acepta dar de baja un comprobante observado', () => {
    expect(() =>
      construirComunicacionBaja(CABECERA, [
        boleta({ tipoComprobante: '01', serie: 'F001', estado: 'OBSERVADO' }),
      ]),
    ).not.toThrow();
  });

  it('una comunicación vacía es un error', () => {
    expect(() => construirComunicacionBaja(CABECERA, [])).toThrow(
      /no tiene comprobantes/,
    );
  });

  it('escapa los caracteres reservados en el motivo de baja', () => {
    const xml = construirComunicacionBaja(CABECERA, [
      boleta({
        tipoComprobante: '01',
        serie: 'F001',
        motivoBaja: 'Anulado por <error> & corrección',
      }),
    ]);

    expect(xml).toContain('Anulado por &lt;error&gt; &amp; corrección');
  });

  it('la función esc escapa los cinco caracteres reservados', () => {
    expect(esc('<&>"')).toBe('&lt;&amp;&gt;&quot;');
  });
});

// ---------------------------------------------------------------------------
// 4 · Operaciones SOAP sendSummary / getStatus
// ---------------------------------------------------------------------------

describe('TA-67 · operaciones SOAP del resumen', () => {
  it('el sobre de sendSummary lleva el fileName y el contenido en Base64', () => {
    const sobre = construirSobreSendSummary({
      fileName: '20601012341-03-RC-20261031-001.zip',
      contentFileBase64: 'UEsDBBQ=',
    });

    expect(sobre).toContain('<ser:sendSummary>');
    expect(sobre).toContain('20601012341-03-RC-20261031-001.zip');
    expect(sobre).toContain('<contentFile>UEsDBBQ=</contentFile>');
  });

  it('el sobre de getStatus lleva el ticket', () => {
    const sobre = construirSobreGetStatus({ ticket: '1234567890' });

    expect(sobre).toContain('<ser:getStatus>');
    expect(sobre).toContain('<ticket>1234567890</ticket>');
  });

  it('la respuesta de sendSummary da el ticket', () => {
    const xml =
      '<soap:Envelope><soap:Body><ns2:sendSummaryResponse>' +
      '<ticket>1234567890</ticket></ns2:sendSummaryResponse></soap:Body></soap:Envelope>';

    expect(parseSendSummaryResponse(xml).ticket).toBe('1234567890');
    expect(parseSendSummaryResponse(xml).fault).toBeNull();
  });

  it('un Fault en sendSummary se informa, no se confunde con falta de ticket', () => {
    const xml =
      '<soap:Envelope><soap:Body><soap:Fault>' +
      '<faultstring>El comprobante ya fue informado</faultstring>' +
      '</soap:Fault></soap:Body></soap:Envelope>';

    const resultado = parseSendSummaryResponse(xml);
    expect(resultado.ticket).toBeNull();
    expect(resultado.fault).toContain('ya fue informado');
  });

  it('el código 98 significa EN PROCESO, no error', () => {
    const xml =
      '<soap:Envelope><soap:Body><ns2:getStatusResponse>' +
      '<statusCode>98</statusCode>' +
      '<content></content>' +
      '</ns2:getStatusResponse></soap:Body></soap:Envelope>';

    const resultado = parseGetStatusResponse(xml);
    // Tratarlo como error haría reenviar el resumen y duplicarlo.
    expect(resultado.enProceso).toBe(true);
    expect(resultado.contenido).toBeNull();
  });

  it('el código 99 también significa EN PROCESO', () => {
    const xml =
      '<soap:Envelope><soap:Body><ns2:getStatusResponse>' +
      '<statusCode>99</statusCode>' +
      '</ns2:getStatusResponse></soap:Body></soap:Envelope>';

    expect(parseGetStatusResponse(xml).enProceso).toBe(true);
  });

  it('el código 0 con contenido significa CDR listo', () => {
    const xml =
      '<soap:Envelope><soap:Body><ns2:getStatusResponse>' +
      '<statusCode>0</statusCode>' +
      '<content>UEsDBAoAAAAAAA==</content>' +
      '</ns2:getStatusResponse></soap:Body></soap:Envelope>';

    const resultado = parseGetStatusResponse(xml);
    expect(resultado.enProceso).toBe(false);
    expect(resultado.contenido).toBe('UEsDBAoAAAAAAA==');
  });

  it('extraerEtiqueta funciona con y sin prefijo de namespace', () => {
    expect(extraerEtiqueta('<ticket>abc</ticket>', 'ticket')).toBe('abc');
    expect(extraerEtiqueta('<ns2:ticket>abc</ns2:ticket>', 'ticket')).toBe('abc');
    expect(extraerEtiqueta('<otra>abc</otra>', 'ticket')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 4 · Regla 2957: plazo de 7 días calendario
// ---------------------------------------------------------------------------

describe('TA-67 · regla 2957 (plazo del resumen)', () => {
  it('cuenta días calendario entre la emisión y la fecha del resumen', () => {
    // 31 de octubre -> 7 de noviembre son 7 días, justo en el límite.
    expect(diasDesdeEmision('2026-10-31', '2026-11-07')).toBe(7);
    expect(diasDesdeEmision('2026-10-31', '2026-11-08')).toBe(8);
    expect(diasDesdeEmision('2026-10-31', '2026-10-31')).toBe(0);
  });

  it('no cuenta horas sueltas: cruzar de día ya es un día', () => {
    // Un comprobante emitido a las 23:00 y resumido a las 00:30 del día
    // siguiente cuenta como 1, no como 0 por la diferencia de horas.
    expect(diasDesdeEmision('2026-10-31', '2026-11-01')).toBe(1);
  });

  it('devuelve null si la fecha no tiene forma YYYY-MM-DD', () => {
    expect(diasDesdeEmision('31/10/2026', '2026-11-07')).toBeNull();
    expect(diasDesdeEmision('2026-10-31', '')).toBeNull();
  });

  it('acepta un resumen dentro del plazo', () => {
    expect(() =>
      construirResumenDiario(CABECERA, [
        boleta({ fechaEmision: '2026-10-31' }),
      ]),
    ).not.toThrow();
  });

  it('acepta el borde exacto de 7 días', () => {
    expect(() =>
      construirResumenDiario(
        { ...CABECERA, fechaResumen: '2026-11-07' },
        [boleta({ fechaEmision: '2026-10-31' })],
      ),
    ).not.toThrow();
  });

  it('rechaza el resumen el día 8 con el código de la regla', () => {
    expect(() =>
      construirResumenDiario(
        { ...CABECERA, fechaResumen: '2026-11-08' },
        [boleta({ fechaEmision: '2026-10-31' })],
      ),
    ).toThrow(/2957/);
  });

  it('el mensaje nombra el comprobante vencido y cuántos días pasaron', () => {
    expect(() =>
      construirResumenDiario(
        { ...CABECERA, fechaResumen: '2026-11-10' },
        [boleta({ fechaEmision: '2026-10-31' })],
      ),
    ).toThrow(/B001-25.*2026-10-31.*10 días/);
  });

  it('cuenta todos los vencidos, no solo el primero', () => {
    expect(() =>
      construirResumenDiario(
        { ...CABECERA, fechaResumen: '2026-11-20' },
        [boleta({ correlativo: 1 }), boleta({ correlativo: 2 })],
      ),
    ).toThrow(/2 comprobantes fuera de plazo/);
  });

  it('lo anulado no bloquea el resumen por plazo', () => {
    // Si el único vencido está anulado no va al XML, así que no puede
    // impedir el envío de los demás.
    expect(() =>
      construirResumenDiario(
        { ...CABECERA, fechaResumen: '2026-11-20' },
        [boleta({ fechaEmision: '2026-11-19' }), boleta({ estado: 'ANULADO' })],
      ),
    ).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// 5 · Regla 2308: la RA no lleva boletas
// ---------------------------------------------------------------------------

describe('TA-67 · regla 2308 (boleta en comunicación de baja)', () => {
  it('una factura sí puede darse de baja por RA', () => {
    expect(
      vaEnBaja(boleta({ tipoComprobante: '01', serie: 'F001' })),
    ).toBe(true);
  });

  it('una nota de crédito o débito a factura también', () => {
    expect(vaEnBaja(boleta({ tipoComprobante: '07', serie: 'FC01' }))).toBe(true);
    expect(vaEnBaja(boleta({ tipoComprobante: '08', serie: 'FD01' }))).toBe(true);
  });

  it('una boleta NO se da de baja por RA', () => {
    expect(vaEnBaja(boleta())).toBe(false);
  });

  it('rechaza la RA con una boleta y dice cómo se anula', () => {
    expect(() => construirComunicacionBaja(CABECERA, [boleta()])).toThrow(
      /2308.*resumen diario/s,
    );
  });

  it('el mensaje de la boleta nombra el comprobante', () => {
    expect(() =>
      construirComunicacionBaja(CABECERA, [
        boleta({ serie: 'B002', correlativo: 77 }),
      ]),
    ).toThrow(/B002-77/);
  });

  it('el tipo se comprueba antes que el estado', () => {
    // Una boleta en cola falla por tipo (2308), no por estado: el error de
    // diseño es más informativo que "todavía no está aceptada".
    expect(() =>
      construirComunicacionBaja(CABECERA, [boleta({ estado: 'EN_COLA' })]),
    ).toThrow(/2308/);
  });
});