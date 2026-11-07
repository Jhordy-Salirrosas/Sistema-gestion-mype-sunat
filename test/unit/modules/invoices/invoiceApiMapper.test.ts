import { describe, it, expect } from 'vitest';
/**
 * Adaptador del listado del backend al modelo de la grilla (TA-29).
 *
 * Lo que se prueba aquí es lo que puede mentir: que los montos vengan del
 * backend cuando existen, que los estados intermedios no se pinten como
 * aceptados y que un comprobante sin CDR no se anuncie como validado.
 */
import {
  aComprobanteDemo,
  aPayloadCreacion,
} from '@/modules/invoices/lib/invoiceApiMapper';
import type { ComprobanteDemo } from '@/modules/invoices/data/invoiceDemoSchema';
import type { InvoiceListado } from '@/modules/invoices/types/invoice.types';

function fila(overrides: Partial<InvoiceListado> = {}): InvoiceListado {
  return {
    id: 'inv-1',
    tipo_comprobante: '01',
    serie: 'F001',
    correlativo: 7,
    numero: 'F001-00000007',
    fecha_emision: '2026-10-30T15:00:00.000Z',
    estado: 'ACEPTADO',
    monto_total: 118,
    moneda: 'PEN',
    cliente_documento: '20100070970',
    cliente_nombre: 'CLIENTE DE PRUEBA',
    cdr_codigo: '0',
    ...overrides,
  };
}

describe('invoiceApiMapper', () => {
  it('usa la base y el IGV reales cuando el backend los envía', () => {
    const comprobante = aComprobanteDemo(
      fila({ base_imponible: 100, total_igv: 18 }),
    );

    expect(comprobante.baseImponible).toBe(100);
    expect(comprobante.igv).toBe(18);
    expect(comprobante.totalNeto).toBe(118);
    expect(comprobante.estado).toBe('ACEPTADO');
  });

  it('deriva el 18% solo si el backend no manda los montos', () => {
    const comprobante = aComprobanteDemo(fila({ monto_total: 1180 }));

    expect(comprobante.baseImponible).toBe(1000);
    expect(comprobante.igv).toBe(180);
  });

  it('trata los estados intermedios como "en cola", no como aceptados', () => {
    for (const estado of ['PENDIENTE', 'EN_COLA', 'PROCESANDO', 'ENVIADO']) {
      expect(aComprobanteDemo(fila({ estado })).estado).toBe('EN_COLA');
    }
    expect(aComprobanteDemo(fila({ estado: 'ERROR_RED' })).estado).toBe('SIN_CONFIRMAR');
    expect(aComprobanteDemo(fila({ estado: 'ANULADO' })).estado).toBe('RECHAZADO');
  });

  it('no anuncia un CDR cuando el comprobante todavía no lo tiene', () => {
    const comprobante = aComprobanteDemo(fila({ cdr_codigo: null }));

    expect(comprobante.cdrCodigo).toBeUndefined();
    expect(comprobante.cdrDescripcion).toMatch(/Sin CDR/);
  });

  it('conserva el documento afectado de las notas de crédito', () => {
    const comprobante = aComprobanteDemo(
      fila({ tipo_comprobante: '07', documento_afectado: 'F001-00000001' }),
    );

    expect(comprobante.tipo).toBe('07');
    expect(comprobante.documentoAfectado).toBe('F001-00000001');
  });
});

describe('aPayloadCreacion', () => {
  const emisor = { ruc: '20601012341', razonSocial: 'MYPE DEMO S.A.C.' };

  function comprobante(overrides: Partial<ComprobanteDemo> = {}): ComprobanteDemo {
    return {
      id: 'F001-7',
      tipo: '01',
      serie: 'F001',
      correlativo: 7,
      clienteRuc: '20100070970',
      clienteTipoDoc: '6',
      clienteRazonSocial: 'CLIENTE DE PRUEBA',
      fechaEmision: '2026-10-30',
      moneda: 'PEN',
      baseImponible: 100,
      igv: 18,
      detraccion: 0,
      retencion: 0,
      totalNeto: 118,
      estado: 'EN_COLA',
      tipoOperacion: '0101',
      formaPago: 'Contado',
      cuotas: [],
      cdrDescripcion: 'Sin CDR',
      hashCpe: '',
      items: [
        {
          codigo: 'P1',
          descripcion: 'Producto',
          unidad: 'NIU',
          cantidad: 2,
          valorUnitario: 50,
          afectacion: 'GRAVADA',
        },
      ],
      ...overrides,
    };
  }

  it('arma el DTO del backend con el emisor de la sesión', () => {
    const payload = aPayloadCreacion(comprobante(), emisor);

    expect(payload.ruc_emisor).toBe(emisor.ruc);
    expect(payload.serie).toBe('F001');
    expect(payload.correlativo).toBe(7);
    expect(payload.tipo_comprobante).toBe('01');
    expect(payload.monto_total).toBe(118);
    expect(payload.fecha_emision).toBe('2026-10-30');
    expect(payload.payload_ubl).toMatchObject({
      rucEmisor: emisor.ruc,
      razonSocialEmisor: emisor.razonSocial,
      montoGravado: 100,
      montoIgv: 18,
      montoTotal: 118,
    });
  });

  it('calcula el IGV de cada línea a partir del valor unitario', () => {
    const payload = aPayloadCreacion(comprobante(), emisor);
    const lineas = payload.payload_ubl.lineas as Array<Record<string, number | string>>;

    expect(lineas[0]).toMatchObject({
      cantidad: 2,
      valorUnitario: 50,
      totalLinea: 118,
      igvLinea: 18,
    });
    expect(lineas[0].precioUnitario).toBe(59);
  });

  it('manda el total bruto aunque el neto descuente detracción', () => {
    const payload = aPayloadCreacion(
      comprobante({ detraccion: 11.8, totalNeto: 106.2 }),
      emisor,
    );

    expect(payload.monto_total).toBe(118);
    expect(payload.payload_ubl).toMatchObject({ montoDetraccion: 11.8 });
  });

  it('incluye el documento afectado en las notas de crédito', () => {
    const payload = aPayloadCreacion(
      comprobante({ tipo: '07', serie: 'FC01', documentoAfectado: 'F001-1' }),
      emisor,
    );

    expect(payload.payload_ubl).toMatchObject({ documentoAfectado: 'F001-1' });
  });
});
