/**
 * Traducción del formulario de emisión al contrato fiscal (M1, docente 31-10).
 *
 * POR QUÉ ESTAS PRUEBAS IMPORTAN MÁS QUE OTRAS
 *
 * Durante la revisión del 31-10 se comprobó contra el servidor real que el front
 * mandaba el formulario a `POST /invoices`, que exige `payload_ubl`. El backend
 * respondía 400 `property clienteRuc should not exist` a TODAS las emisiones: la
 * pantalla nunca pudo emitir. El adaptador es la pieza que traduce una forma en
 * la otra, así que si se rompe, la pantalla vuelve a no emitir.
 *
 * Lo que se fija aquí:
 *  - El DTO que sale cumple el contrato de `CreateInvoiceDto`.
 *  - El total se CALCULA de las líneas, nunca se acepta del cliente.
 *  - El IGV se liquida por línea según su afectación (no un 18 % plano).
 *  - Las gratuitas no suman a la base pero sí declaran su línea.
 *  - La detracción es de la LÍNEA: si el flete está sujeto y el cemento no, solo
 *    se detrae el flete (palabras del docente: "los productos son con
 *    detracción, no la factura").
 */
import { describe, expect, it } from '@jest/globals';
import {
  traducirEmision,
  type DatosEmisor,
} from '../../../src/modules/invoices/application/services/emitirComprobanteAdapter';
import type {
  EmitirComprobanteDto,
  LineaEmisionDto,
} from '../../../src/modules/invoices/application/dto/emitirComprobanteDto';
import type { InvoicePayload } from '../../../src/modules/invoices/invoicePayload';

/** Emisor de prueba con un RUC válido. */
const emisor: DatosEmisor = {
  ruc: '20100070970',
  razonSocial: 'FERRETERÍA LOS ANDES S.A.C.',
  ubigeo: '150101',
};

/** Línea de la grilla. */
const linea = (parcial: Partial<LineaEmisionDto> = {}): LineaEmisionDto =>
  ({
    descripcion: 'Cemento Portland tipo I',
    codigo: 'CEM-001',
    unidad: 'NIU',
    cantidad: 1,
    valorUnitario: 100,
    afectacion: '10',
    ...parcial,
  }) as LineaEmisionDto;

/** Formulario completo. */
const formulario = (
  parcial: Partial<EmitirComprobanteDto> = {},
): EmitirComprobanteDto =>
  ({
    tipo_comprobante: '01',
    serie: 'F001',
    customer_identity_type: '6',
    customer_identity_number: '20100070970',
    customer_legal_name: 'FERRETERÍA LOS ANDES S.A.C.',
    items: [linea()],
    ...parcial,
  }) as EmitirComprobanteDto;

/** Extrae el payload UBL ya tipado del DTO. */
const payloadDe = (dto: EmitirComprobanteDto): InvoicePayload => {
  const traducido = traducirEmision(dto, emisor, 1);
  return traducido.dto.payload_ubl as unknown as InvoicePayload;
};

describe('traducirEmision — contrato de entrada', () => {
  it('produce un CreateInvoiceDto con todos los campos obligatorios', () => {
    const { dto } = traducirEmision(formulario(), emisor, 7);

    expect(dto.ruc_emisor).toBe('20100070970');
    expect(dto.serie).toBe('F001');
    expect(dto.correlativo).toBe(7);
    expect(dto.tipo_comprobante).toBe('01');
    expect(dto.monto_total).toBeGreaterThan(0);
    expect(dto.fecha_emision).toMatch(/T00:00:00\.000Z$/);
    expect(typeof dto.payload_ubl).toBe('object');
  });

  // El correlativo lo reserva la base; el adaptador solo lo transporta.
  it('usa el correlativo que recibe y no uno propio', () => {
    const { dto } = traducirEmision(formulario(), emisor, 42);

    expect(dto.correlativo).toBe(42);
    expect(payloadDe(formulario()).numero).toBe(1);
  });

  it('el emisor sale de la empresa, no del formulario', () => {
    const payload = payloadDe(formulario());

    expect(payload.rucEmisor).toBe(emisor.ruc);
    expect(payload.razonSocialEmisor).toBe(emisor.razonSocial);
  });

  it('normaliza la serie a mayúsculas', () => {
    const { dto } = traducirEmision(formulario({ serie: 'f001' }), emisor, 1);

    expect(dto.serie).toBe('F001');
  });
});

describe('traducirEmision — liquidación de impuestos', () => {
  // El total NO se acepta del cliente: se calcula. Si se aceptara, el XML
  // podría declarar ante SUNAT un importe distinto de la suma de sus líneas.
  it('calcula el total de la línea gravada (valor + 18 % de IGV)', () => {
    const { importes } = traducirEmision(
      formulario({ items: [linea({ cantidad: 2, valorUnitario: 50 })] }),
      emisor,
      1,
    );

    expect(importes.gravado).toBe(100);
    expect(importes.igv).toBe(18);
    expect(importes.total).toBe(118);
  });

  it('suma varias líneas gravadas', () => {
    const { importes } = traducirEmision(
      formulario({
        items: [
          linea({ cantidad: 1, valorUnitario: 100 }),
          linea({ cantidad: 2, valorUnitario: 50 }),
        ],
      }),
      emisor,
      1,
    );

    expect(importes.gravado).toBe(200);
    expect(importes.igv).toBe(36);
    expect(importes.total).toBe(236);
  });

  // Antes de TA-62 toda línea declaraba IGV aunque fuera exonerada.
  it('una línea exonerada no genera IGV y va a su propia base', () => {
    const { importes } = traducirEmision(
      formulario({ items: [linea({ afectacion: '20', valorUnitario: 100 })] }),
      emisor,
      1,
    );

    expect(importes.exonerado).toBe(100);
    expect(importes.gravado).toBe(0);
    expect(importes.igv).toBe(0);
    expect(importes.total).toBe(100);
  });

  it('una línea inafecta va a la base inafecta', () => {
    const { importes } = traducirEmision(
      formulario({ items: [linea({ afectacion: '30', valorUnitario: 100 })] }),
      emisor,
      1,
    );

    expect(importes.inafecto).toBe(100);
    expect(importes.igv).toBe(0);
  });

  // Regla 3278: el LineExtensionAmount de una gratuita es cero.
  it('una línea gratuita no suma a ninguna base ni cobra IGV', () => {
    const { importes, lineas } = traducirEmision(
      formulario({ items: [linea({ afectacion: '11', valorUnitario: 100 })] }),
      emisor,
      1,
    );

    expect(importes.gravado).toBe(0);
    expect(importes.igv).toBe(0);
    expect(importes.total).toBe(0);
    expect(lineas[0].totalLinea).toBe(0);
  });

  it('reparte cada afectación en su base al mezclar líneas', () => {
    const { importes } = traducirEmision(
      formulario({
        items: [
          linea({ afectacion: '10', valorUnitario: 100 }),
          linea({ afectacion: '20', valorUnitario: 50 }),
          linea({ afectacion: '30', valorUnitario: 30 }),
        ],
      }),
      emisor,
      1,
    );

    expect(importes.gravado).toBe(100);
    expect(importes.exonerado).toBe(50);
    expect(importes.inafecto).toBe(30);
    expect(importes.igv).toBe(18);
    expect(importes.total).toBe(198);
  });

  it('suma el ICBPER al total sin aplicarle IGV', () => {
    const { importes } = traducirEmision(
      formulario({
        items: [
          linea({ valorUnitario: 100 }),
          linea({ descripcion: 'Bolsa', codigo: 'ICBPER', valorUnitario: 0, icbper: 0.5 }),
        ],
      }),
      emisor,
      1,
    );

    expect(importes.icbper).toBe(0.5);
    expect(importes.total).toBe(118.5);
  });

  it('redondea el IGV por línea sin acumular céntimos de error', () => {
    const { importes } = traducirEmision(
      formulario({
        items: Array.from({ length: 10 }, () =>
          linea({ cantidad: 1, valorUnitario: 0.33 }),
        ),
      }),
      emisor,
      1,
    );

    expect(importes.gravado).toBe(3.3);
    expect(importes.igv).toBe(0.6);
  });
});

describe('traducirEmision — detracción por línea', () => {
  // "Los productos son con detracción, no la factura".
  it('detrae solo la línea sujeta, no todo el comprobante', () => {
    const { importes } = traducirEmision(
      formulario({
        items: [
          linea({ descripcion: 'Cemento', afectacion: '10', valorUnitario: 1000 }),
          linea({
            descripcion: 'Flete',
            afectacion: '10',
            valorUnitario: 800,
            codigoDetraccion: '012',
          }),
        ],
      }),
      emisor,
      1,
    );

    // El 12 % se aplica sobre los 800 del flete, no sobre los 1800.
    expect(importes.detraccion).toBe(96);
    expect(importes.importePagar).toBe(1800 + 324 - 96);
  });

  it('no detrae si el importe total no supera los S/ 700', () => {
    const { importes } = traducirEmision(
      formulario({
        items: [
          linea({ valorUnitario: 500, codigoDetraccion: '012' }),
        ],
      }),
      emisor,
      1,
    );

    expect(importes.detraccion).toBe(0);
  });

  it('no detrae cuando ninguna línea está sujeta', () => {
    const { importes } = traducirEmision(
      formulario({ items: [linea({ valorUnitario: 5000 })] }),
      emisor,
      1,
    );

    expect(importes.detraccion).toBe(0);
  });
});

describe('traducirEmision — retención del cliente', () => {
  // El docente: "el agente de retención pertenece al cliente, no al
  // comprobante". Se activa con un dato del adquirente.
  it('aplica la retención del 3 % cuando el cliente es agente', () => {
    const { importes } = traducirEmision(
      formulario({ agente_retencion: true, items: [linea({ valorUnitario: 1000 })] }),
      emisor,
      1,
    );

    // 3 % del total (1180) redondeado al entero superior.
    expect(importes.retencion).toBe(Math.ceil(1180 * 0.03));
    expect(importes.importePagar).toBe(1180 - importes.retencion);
  });

  it('no retiene nada si el cliente no es agente', () => {
    const { importes } = traducirEmision(formulario(), emisor, 1);

    expect(importes.retencion).toBe(0);
  });
});

describe('traducirEmision — datos del adquirente y del comprobante', () => {
  it('transporta el documento y la razón social del cliente', () => {
    const { dto } = traducirEmision(formulario(), emisor, 1);
    const payload = dto.payload_ubl as unknown as InvoicePayload;

    expect(dto.customer_identity_number).toBe('20100070970');
    expect(dto.customer_legal_name).toBe('FERRETERÍA LOS ANDES S.A.C.');
    expect(payload.cliente?.numeroDocumento).toBe('20100070970');
    expect(payload.cliente?.tipoDocumento).toBe('6');
  });

  it('limpia separadores del documento', () => {
    const { dto } = traducirEmision(
      formulario({ customer_identity_number: '20-100-070-970' }),
      emisor,
      1,
    );

    expect(dto.payload_ubl).toBeDefined();
    expect((dto.payload_ubl as unknown as InvoicePayload).cliente?.numeroDocumento).toBe(
      '20100070970',
    );
  });

  it('usa el tipo de operación de venta nacional', () => {
    expect(payloadDe(formulario()).tipoOperacion).toBe('0101');
  });

  it('una boleta lleva el tipo 03 y su serie B001', () => {
    const { dto } = traducirEmision(
      formulario({
        tipo_comprobante: '03',
        serie: 'B001',
        customer_identity_type: '1',
        customer_identity_number: '45678912',
      }),
      emisor,
      1,
    );

    expect(dto.tipo_comprobante).toBe('03');
    expect(dto.serie).toBe('B001');
  });

  it('transporta la referencia y el motivo de una nota', () => {
    const payload = payloadDe(
      formulario({
        tipo_comprobante: '07',
        documento_afectado: 'F001-00000042',
        codigo_motivo_nota: '01',
        descripcion_motivo_nota: 'Anulación de la operación',
      }),
    );

    expect(payload.documentoAfectado).toBe('F001-00000042');
    expect(payload.codigoMotivoNota).toBe('01');
  });

  /**
   * TA-66: el UUID del origen tiene que sobrevivir a la traducción.
   *
   * El adaptador es una función pura y no resuelve el UUID (eso lo hace el
   * servicio, que es quien consulta la base); lo que se comprueba aquí es que no
   * se caiga por el camino. Si se perdiera en este punto, la columna volvería a
   * quedar en NULL aunque el servicio la hubiera resuelto bien.
   */
  it('transporta el UUID del comprobante afectado (TA-66)', () => {
    const { dto } = traducirEmision(
      formulario({
        tipo_comprobante: '07',
        documento_afectado: 'F001-00000042',
        codigo_motivo_nota: '01',
        referenced_invoice_id: 'origen-1',
      }),
      emisor,
      1,
    );

    expect(dto.referenced_invoice_id).toBe('origen-1');
    // El número fiscal se sigue guardando: es lo que se muestra y lo que va al XML.
    expect(dto.referenced_series_correlative).toBe('F001-00000042');
  });

  it('sin origen resuelto no inventa un UUID', () => {
    const { dto } = traducirEmision(
      formulario({ tipo_comprobante: '07', documento_afectado: 'F001-00000042' }),
      emisor,
      1,
    );

    expect(dto.referenced_invoice_id).toBeUndefined();
  });

  it('sin documento de cliente no inventa un bloque de cliente', () => {
    const payload = payloadDe(
      formulario({
        customer_identity_number: undefined,
        customer_identity_type: undefined,
      }),
    );

    expect(payload.cliente).toBeUndefined();
  });
});

describe('traducirEmision — avisos honestos', () => {
  // El backend mueve el Kardex por SKU. Una línea sin código no puede generar
  // movimiento: se dice, no se esconde.
  it('avisa de las líneas sin código de producto en una factura', () => {
    const { avisos } = traducirEmision(
      formulario({ items: [linea({ codigo: undefined })] }),
      emisor,
      1,
    );

    expect(avisos).toHaveLength(1);
    expect(avisos[0]).toContain('Kardex');
  });

  it('no avisa cuando todas las líneas tienen código', () => {
    const { avisos } = traducirEmision(formulario(), emisor, 1);

    expect(avisos).toHaveLength(0);
  });
});
