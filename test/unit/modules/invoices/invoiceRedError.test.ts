/**
 * Criterio único para distinguir un fallo de envío de un rechazo de SUNAT.
 *
 * Lo que se protege
 *
 * `mapEstadoCdr` colapsa `FALLO_CRITICO` dentro de `RECHAZADO` para que la fila
 * salga en rojo, así que a los componentes les llega "RECHAZADO" en los dos
 * casos. El 3 de noviembre eso hizo que F001-00000052 se rotulara "Rechazado" y
 * "SUNAT todavía no respondió" a la vez, y que la Bitácora afirmara que SUNAT
 * había rechazado un documento que nunca le llegó.
 *
 * Como el criterio se usa desde el modal, la bitácora, el badge y la celda de la
 * grilla, tiene que ser el mismo en los cuatro: si cada uno improvisa su
 * heurística, acaban discrepando y la ficha vuelve a contradecirse.
 */
import { describe, expect, it } from 'vitest';
import { esErrorDeRed } from '@/modules/invoices/lib/invoiceRedError';
import type { ComprobanteDemo } from '@/modules/invoices/data/invoiceDemoSchema';

/** Comprobante mínimo para probar el criterio. */
function comprobante(extra: Partial<ComprobanteDemo> = {}): ComprobanteDemo {
  return {
    id: 'inv-52',
    tipo: '01',
    serie: 'F001',
    correlativo: 52,
    fechaEmision: '2026-11-03',
    clienteRuc: '20100070970',
    clienteTipoDoc: '6',
    clienteRazonSocial: 'FERRETERIA LOS ANDES S.A.C.',
    baseImponible: 805.08,
    igv: 144.92,
    totalNeto: 950,
    moneda: 'PEN',
    estado: 'RECHAZADO',
    estadoBackend: 'ERROR_RED',
    cdrCodigo: undefined,
    cdrDescripcion:
      'No llegó a SUNAT: el envío falló por un error de red y el comprobante no fue evaluado.',
    hashCpe: '',
    formaPago: 'Contado',
    cuotas: [],
    tipoOperacion: '0101',
    detraccion: 0,
    retencion: 0,
    items: [],
    ...extra,
  } as ComprobanteDemo;
}

describe('esErrorDeRed', () => {
  it('reconoce un ERROR_RED por el estado crudo del backend', () => {
    expect(esErrorDeRed(comprobante())).toBe(true);
  });

  it('NO trata como fallo de red un rechazo real de SUNAT', () => {
    // Un rechazo real: llegó a SUNAT y trae su código de CDR. La condición del
    // pedido era que estos sigan rotulándose "Rechazado".
    const rechazado = comprobante({
      estado: 'RECHAZADO',
      estadoBackend: 'RECHAZADO',
      cdrCodigo: '2992',
      cdrDescripcion: 'El comprobante fue rechazado por SUNAT',
    });

    expect(esErrorDeRed(rechazado)).toBe(false);
  });

  it('NO trata como fallo de red un rechazo sin CDR pero con código de fault', () => {
    // SOAP Fault: sin CDR, pero hay código de error de SUNAT. Es un veredicto.
    const fault = comprobante({
      estado: 'RECHAZADO',
      estadoBackend: 'RECHAZADO',
      cdrCodigo: undefined,
      ultimoErrorCodigo: '2992',
      cdrDescripcion: 'Código 2992: el XML no cumple el esquema',
    });

    expect(esErrorDeRed(fault)).toBe(false);
  });

  it('no toca un comprobante aceptado', () => {
    const aceptado = comprobante({
      estado: 'ACEPTADO',
      estadoBackend: 'ACEPTADO',
      cdrCodigo: '0',
      cdrDescripcion: 'La Factura numero F001-00000052, ha sido aceptada',
    });

    expect(esErrorDeRed(aceptado)).toBe(false);
  });

  it('sirve de respaldo si la fila llega sin el estado crudo', () => {
    const sinCrudo = comprobante({
      estado: 'RECHAZADO',
      estadoBackend: undefined,
    });

    expect(esErrorDeRed(sinCrudo)).toBe(true);
  });

  it('no confunde un rechazo real sin estado crudo con un fallo de red', () => {
    const realSinCrudo = comprobante({
      estadoBackend: undefined,
      cdrCodigo: '2017',
      cdrDescripcion: 'El comprobante fue rechazado por SUNAT',
    });

    expect(esErrorDeRed(realSinCrudo)).toBe(false);
  });
});
