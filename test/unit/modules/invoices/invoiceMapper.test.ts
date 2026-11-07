/**
 * TA-59 · mapper entre el backend y el frontend.
 *
 * Lo que se protege:
 *
 *  1. La grilla deja de quedar vacía: los nombres del backend
 *     (`cliente_documento`, `monto_total`) se traducen a los del front
 *     (`clienteRuc`, `total`). Es el defecto que hacía que la pantalla no
 *     mostrara nada aunque la petición fuera bien.
 *  2. `OBSERVADO` NO se convierte en rechazado: un comprobante observado existe
 *     ante SUNAT y tratarlo como rechazo haría reenviarlo y duplicarlo.
 *  3. Un estado desconocido NO se convierte en aceptado.
 *  4. El IGV derivado del total cuadra al céntimo.
 *  5. Los documentos se envían sin separadores, porque el backend valida módulo
 *     11 y un "20-100-070-970" con guiones es un RUC inválido.
 */
import { describe, expect, it } from 'vitest';
import {
  MAPA_ESTADOS,
  aCdrStatus,
  aCreateInvoiceDto,
  aInvoice,
  aInvoiceDetalle,
  aMoneda,
  aPaginaInvoices,
  esReintentable,
  type ComprobanteBackend,
  type ComprobanteDetalleBackend,
} from '@/modules/invoices/lib/invoiceMapper';

// ---------------------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------------------

/** Fila del backend tal como llega por HTTP. */
function fila(extra: Partial<ComprobanteBackend> = {}): ComprobanteBackend {
  return {
    id: 'inv-1',
    tipo_comprobante: '01',
    serie: 'F001',
    correlativo: 143,
    numero: 'F001-00000143',
    fecha_emision: '2026-10-31T00:00:00.000Z',
    estado: 'ACEPTADO',
    monto_total: 1180,
    moneda: 'PEN',
    cliente_documento: '20100066603',
    cliente_nombre: 'CONSTRUCTORA DEL NORTE S.A.C.',
    cdr_codigo: '0',
    ...extra,
  };
}

// ---------------------------------------------------------------------------
// 1 · Traducción de campos
// ---------------------------------------------------------------------------

describe('TA-59 · traducción de campos', () => {
  it('los nombres del backend se traducen a los del front', () => {
    const invoice = aInvoice(fila());

    expect(invoice.clienteRuc).toBe('20100066603');
    expect(invoice.clienteRazonSocial).toBe('CONSTRUCTORA DEL NORTE S.A.C.');
    expect(invoice.total).toBe(1180);
    expect(invoice.numero).toBe('F001-00000143');
  });

  it('deriva el IGV del total al 18 %', () => {
    const invoice = aInvoice(fila());

    // 1180 / 1.18 = 1000 de base; IGV = 180.
    expect(invoice.igv).toBe(180);
    expect(invoice.subtotal).toBe(1000);
  });

  it('el tipo de comprobante se conserva', () => {
    // El modelo del front no contemplaba el tipo aunque el backend lo manda.
    expect(aInvoice(fila()).tipoComprobante).toBe('01');
    expect(aInvoice(fila({ tipo_comprobante: '03' })).tipoComprobante).toBe('03');
  });

  it('sin cliente informado no se rompe la fila', () => {
    const invoice = aInvoice(
      fila({ cliente_documento: null, cliente_nombre: null }),
    );

    expect(invoice.clienteRuc).toBe('');
    expect(invoice.clienteRazonSocial).toBe('CLIENTE SIN NOMBRE');
  });

  it('un importe que llega como string se convierte a número', () => {
    // Los Decimal de Prisma se serializan como string en algunas versiones.
    const invoice = aInvoice(fila({ monto_total: '590.00' as never }));
    expect(invoice.total).toBe(590);
  });

  it('la moneda se normaliza a PEN o USD', () => {
    expect(aMoneda('USD')).toBe('USD');
    expect(aMoneda('PEN')).toBe('PEN');
    expect(aMoneda(null)).toBe('PEN');
    expect(aMoneda('EUR')).toBe('PEN');
  });

  it('los importes no arrastran error de coma flotante', () => {
    const invoice = aInvoice(fila({ monto_total: 100 }));
    // 100 / 1.18 = 84.7457... → base 84.75 e IGV 15.25.
    expect(invoice.subtotal + invoice.igv).toBeCloseTo(100, 2);
  });
});

// ---------------------------------------------------------------------------
// 2 · Estados
// ---------------------------------------------------------------------------

describe('TA-59 · traducción de estados', () => {
  it('ACEPTADO se traduce a ACEPTADO_SUNAT', () => {
    expect(aCdrStatus('ACEPTADO')).toBe('ACEPTADO_SUNAT');
  });

  it('OBSERVADO también es ACEPTADO_SUNAT, no un rechazo', () => {
    // Un comprobante observado existe ante SUNAT. Tratarlo como rechazo haría
    // reenviarlo y duplicarlo (código 1033).
    expect(aCdrStatus('OBSERVADO')).toBe('ACEPTADO_SUNAT');
  });

  it('EN_COLA se traduce a EN_COLA_OUTBOX', () => {
    expect(aCdrStatus('EN_COLA')).toBe('EN_COLA_OUTBOX');
  });

  it('ERROR_RED se traduce a SIN_CONFIRMAR, no a un rechazo', () => {
    // Deuda A: antes iba a FALLO_CRITICO, que la grilla rotulaba "En Cola DLQ"
    // y el modal convertía en RECHAZADO. Un fallo de transmisión no es un
    // veredicto de SUNAT: el documento no llegó a enviarse.
    expect(aCdrStatus('ERROR_RED')).toBe('SIN_CONFIRMAR');
    expect(aCdrStatus('ERROR_RED')).not.toBe('RECHAZADO_SUNAT');
    expect(aCdrStatus('ERROR_RED')).not.toBe('FALLO_CRITICO');
  });

  it('ningún estado del backend produce FALLO_CRITICO', () => {
    // Se conserva en el tipo por compatibilidad, pero si algún valor volviera a
    // apuntar ahí, volvería la etiqueta falsa sin que nadie lo note.
    const valores = Object.values(MAPA_ESTADOS);
    expect(valores).not.toContain('FALLO_CRITICO');
  });

  it('RECHAZADO se traduce a RECHAZADO_SUNAT', () => {
    expect(aCdrStatus('RECHAZADO')).toBe('RECHAZADO_SUNAT');
  });

  it('un estado desconocido NO se convierte en aceptado', () => {
    // El valor seguro es "en cola": la UI no debe mostrar como válido algo que
    // el front no sabe interpretar.
    expect(aCdrStatus('INVENTADO')).toBe('EN_COLA_OUTBOX');
    expect(aCdrStatus('')).toBe('EN_COLA_OUTBOX');
  });

  it('el estado crudo se conserva junto al status de CDR', () => {
    const invoice = aInvoice(fila({ estado: 'OBSERVADO' }));
    expect(invoice.estadoBackend).toBe('OBSERVADO');
    expect(invoice.cdrStatus).toBe('ACEPTADO_SUNAT');
  });

  it('el mapa cubre todos los estados del enum del backend', () => {
    for (const estado of [
      'ACEPTADO',
      'OBSERVADO',
      'EN_COLA',
      'PENDIENTE',
      'ENVIADO',
      'ERROR_RED',
      'RECHAZADO',
      'ANULADO',
    ]) {
      expect(MAPA_ESTADOS[estado]).toBeDefined();
    }
  });
});

// ---------------------------------------------------------------------------
// 3 · Reintentabilidad
// ---------------------------------------------------------------------------

describe('TA-59 · botón de reintento', () => {
  it('solo los estados con fallo admiten reintento', () => {
    expect(esReintentable('ERROR_RED')).toBe(true);
    expect(esReintentable('RECHAZADO')).toBe(true);
    expect(esReintentable('ENVIADO')).toBe(true);
  });

  it('un comprobante aceptado NO admite reintento', () => {
    // Reencolar una factura aceptada haría que SUNAT la rechace por duplicado.
    expect(esReintentable('ACEPTADO')).toBe(false);
    expect(esReintentable('OBSERVADO')).toBe(false);
  });

  it('la fila trae la marca de reintentable', () => {
    expect(aInvoice(fila({ estado: 'ERROR_RED' })).reintentable).toBe(true);
    expect(aInvoice(fila({ estado: 'ACEPTADO' })).reintentable).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 4 · Página y detalle
// ---------------------------------------------------------------------------

describe('TA-59 · página del listado', () => {
  it('traduce todas las filas de la página', () => {
    const pagina = aPaginaInvoices({
      data: [fila(), fila({ id: 'inv-2', correlativo: 144 })],
      total: 2,
      page: 1,
      page_size: 20,
      total_pages: 1,
    });

    expect(pagina.data).toHaveLength(2);
    expect(pagina.total).toBe(2);
    expect(pagina.pageSize).toBe(20);
  });

  it('una página vacía no rompe nada', () => {
    const pagina = aPaginaInvoices({
      data: [],
      total: 0,
      page: 1,
      page_size: 20,
      total_pages: 0,
    });

    expect(pagina.data).toEqual([]);
    // total_pages 0 se normaliza a 1 para que el paginador no muestre "0 de 0".
    expect(pagina.totalPages).toBe(1);
  });

  it('el detalle usa el IGV exacto que manda el backend', () => {
    const detalle: ComprobanteDetalleBackend = {
      ...fila(),
      ruc_emisor: '20601012341',
      base_imponible: 1000,
      total_igv: 180,
      cdr: {
        codigo: '0',
        descripcion: 'El comprobante fue aceptado',
        fecha_respuesta: '2026-10-31T10:00:00.000Z',
        observaciones: [],
      },
    };

    const invoice = aInvoiceDetalle(detalle);
    expect(invoice.igv).toBe(180);
    expect(invoice.subtotal).toBe(1000);
    expect(invoice.cdrMensaje).toBe('El comprobante fue aceptado');
  });

  it('un detalle sin CDR no rompe la ficha', () => {
    const detalle: ComprobanteDetalleBackend = {
      ...fila({ estado: 'EN_COLA' }),
      ruc_emisor: '20601012341',
      base_imponible: 1000,
      total_igv: 180,
      cdr: null,
    };

    const invoice = aInvoiceDetalle(detalle);
    expect(invoice.cdrMensaje).toBeUndefined();
    expect(invoice.cdrStatus).toBe('EN_COLA_OUTBOX');
  });
});

// ---------------------------------------------------------------------------
// 5 · Alta: del front al backend
// ---------------------------------------------------------------------------

describe('TA-59 · alta de comprobante', () => {
  it('limpia los separadores del documento del cliente', () => {
    const dto = aCreateInvoiceDto({
      serie: 'F001',
      clienteRuc: '20-100-070-970',
      clienteRazonSocial: '  CLIENTE S.A.C.  ',
      moneda: 'PEN',
      items: [
        { descripcion: '  Cemento  ', cantidad: 2, precioUnitario: 25 },
      ],
    });

    // El backend valida módulo 11: un RUC con guiones es inválido.
    expect(dto.clienteRuc).toBe('20100070970');
    expect(dto.clienteRazonSocial).toBe('CLIENTE S.A.C.');
  });

  it('recorta los espacios de las descripciones', () => {
    const dto = aCreateInvoiceDto({
      serie: 'F001',
      clienteRuc: '20100070970',
      clienteRazonSocial: 'CLIENTE',
      moneda: 'PEN',
      items: [{ descripcion: '   Fierro   ', cantidad: 1, precioUnitario: 10 }],
    });

    expect(dto.items[0].descripcion).toBe('Fierro');
  });

  it('conserva la moneda elegida', () => {
    const dto = aCreateInvoiceDto({
      serie: 'F001',
      clienteRuc: '20100070970',
      clienteRazonSocial: 'CLIENTE',
      moneda: 'USD',
      items: [{ descripcion: 'Servicio', cantidad: 1, precioUnitario: 100 }],
    });

    expect(dto.moneda).toBe('USD');
  });
});

describe('fecha de emisión como día calendario', () => {
  /**
   * El backend serializa `fecha_emision` con `toISOString()`, así que una venta
   * del 1 de noviembre en Lima llega como `2026-11-01T00:00:00.000Z`. Si esa
   * cadena llega con hora hasta `formatDateToPeru`, cae en `new Date(...)` y al
   * formatearla en UTC-5 retrocede al 31/10: la bandeja mostraba un día menos
   * que la trama QR del mismo comprobante.
   */
  it('no retrocede un día con la fecha que manda el backend', () => {
    const convertida = aInvoice(fila({ fecha_emision: '2026-11-01T00:00:00.000Z' }));

    expect(convertida.fechaEmision).toBe('2026-11-01');
  });

  it('se queda con el primer día del mes, que es el caso que fallaba', () => {
    const convertida = aInvoice(fila({ fecha_emision: '2026-12-01T00:00:00.000Z' }));

    expect(convertida.fechaEmision).toBe('2026-12-01');
  });

  it('acepta ya la forma corta sin tocarla', () => {
    const convertida = aInvoice(fila({ fecha_emision: '2026-11-01' }));

    expect(convertida.fechaEmision).toBe('2026-11-01');
  });
});

// ---------------------------------------------------------------------------
// 7 · Forma de pago y cronograma (factura al crédito)
// ---------------------------------------------------------------------------

describe('forma de pago y cronograma del detalle', () => {
  /** Detalle del backend con los campos de pago que ahora expone. */
  function detalle(
    extra: Partial<ComprobanteDetalleBackend> = {},
  ): ComprobanteDetalleBackend {
    return {
      ...fila({ serie: 'F001', correlativo: 56, numero: 'F001-00000056', monto_total: 1770 }),
      ruc_emisor: '20601234567',
      base_imponible: 1500,
      total_igv: 270,
      cdr: {
        codigo: '0',
        descripcion: 'La Factura numero F001-00000056, ha sido aceptada',
        fecha_respuesta: '2026-11-03',
        observaciones: [],
      },
      ...extra,
    };
  }

  it('conserva las dos cuotas que viajaron en el XML', () => {
    // El defecto real: la pantalla abría F001-00000056 como venta al contado
    // porque el front escribía 'Contado' y [] a mano para toda fila.
    const convertida = aInvoiceDetalle(
      detalle({
        forma_pago: 'Credito',
        cuotas: [
          { numero: 'Cuota001', monto: 885, vencimiento: '2026-12-03' },
          { numero: 'Cuota002', monto: 885, vencimiento: '2027-01-02' },
        ],
      }),
    );

    expect(convertida.formaPago).toBe('Credito');
    expect(convertida.cuotas).toHaveLength(2);
    expect(convertida.cuotas?.[0]?.monto).toBe(885);
    expect(convertida.cuotas?.[1]?.vencimiento).toBe('2027-01-02');
  });

  it('respeta el contado cuando el backend lo dice', () => {
    const convertida = aInvoiceDetalle(
      detalle({ forma_pago: 'Contado', cuotas: [] }),
    );

    expect(convertida.formaPago).toBe('Contado');
    expect(convertida.cuotas).toEqual([]);
  });

  it('sin dato de la forma de pago deja null, no "Contado"', () => {
    const convertida = aInvoiceDetalle(detalle({ forma_pago: null }));

    expect(convertida.formaPago).toBeNull();
  });

  it('las cuotas por defecto son un arreglo vacío, nunca undefined', () => {
    const convertida = aInvoiceDetalle(detalle());

    expect(convertida.cuotas).toEqual([]);
  });
});

/**
 * Origen y motivo de una nota en la ficha.
 *
 * Las columnas se guardaban y el detalle las pública desde `16fe7c8`, pero el
 * front no las mapeaba: la ficha de una nota ACEPTADA se abría sin decir sobre
 * qué documento se emitió ni por qué.
 */
describe('origen y motivo de la nota', () => {
  function nota(extra: Partial<ComprobanteDetalleBackend> = {}): ComprobanteDetalleBackend {
    return {
      ...fila({ tipo_comprobante: '07', serie: 'FC01', correlativo: 9, numero: 'FC01-00000009' }),
      ruc_emisor: '20601234567',
      base_imponible: 100,
      total_igv: 18,
      cdr: null,
      referenced_document_type: '01',
      referenced_series_correlative: 'F001-00000053',
      credit_debit_reason_code: '06',
      ...extra,
    };
  }

  it('expone el documento afectado y el motivo con su descripcion', () => {
    const convertida = aInvoiceDetalle(nota());

    expect(convertida.documentoAfectado).toBe('F001-00000053');
    expect(convertida.motivoNota?.codigo).toBe('06');
    // La columna guarda solo el codigo: sin resolver el Catalogo 09 la ficha
    // pintaba "(06 - )" con el hueco a la vista.
    expect(convertida.motivoNota?.descripcion).toBe('Devolución total');
  });

  it('una factura no arrastra origen ni motivo', () => {
    const convertida = aInvoiceDetalle(
      nota({
        tipo_comprobante: '01',
        serie: 'F001',
        numero: 'F001-00000056',
        referenced_document_type: null,
        referenced_series_correlative: null,
        credit_debit_reason_code: null,
      }),
    );

    expect(convertida.documentoAfectado).toBeUndefined();
    expect(convertida.motivoNota).toBeUndefined();
  });

  it('con un codigo fuera del catalogo muestra el codigo y no inventa texto', () => {
    const convertida = aInvoiceDetalle(nota({ credit_debit_reason_code: '99' }));

    expect(convertida.motivoNota?.codigo).toBe('99');
    expect(convertida.motivoNota?.descripcion).toBe('');
  });
});
