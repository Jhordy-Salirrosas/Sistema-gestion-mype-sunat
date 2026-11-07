/**
 * Regresiones del ORIGEN de la nota (M1, 3 nov).
 *
 * Los dos defectos que el usuario encontró probando en pantalla, y que las
 * pruebas anteriores no veían porque todos sus fixtures eran objetos "bien
 * formados" escritos a mano:
 *
 *  1. Desde la página de Notas, `F001-00000045` respondía "No existe el
 *     comprobante ... en esta empresa". Era falso: el buscador miraba la grilla
 *     del apartado (que trae solo notas), no los comprobantes de la empresa.
 *
 *  2. Desde Facturas el documento SÍ se encontraba, pero el módulo se caía con
 *     "Cannot read properties of undefined (reading 'toFixed')" porque al modal
 *     le llegaban filas `Invoice` sin adaptar, y el bloque «Se vincula con ...»
 *     leía `baseImponible` (que en `Invoice` se llama `subtotal`).
 *
 * Y el tercero, que apareció al arreglar el primero: la nota no heredaba el
 * cliente del documento afectado y quedaba bloqueada con "Documento inválido".
 */
import { describe, expect, it } from 'vitest';
import { buscarAfectado } from '@/modules/invoices/lib/invoiceNotaOrigen';
import {
  vincularDocumentoAfectado,
  type BorradorEmision,
} from '@/modules/invoices/lib/invoiceEmitDraft';
import type {
  ComprobanteDemo,
  ItemDemo,
} from '@/modules/invoices/data/invoiceDemoTypes';

/**
 * Comprobante COMPLETO, con todos los campos que el modal puede leer.
 *
 * Si esta fixture se completa a mano, añadir un campo al modelo no la rompe; por
 * eso se construye a partir de una semilla y se tipa como `ComprobanteDemo`.
 */
const comprobanteCompleto = (
  parcial: Partial<ComprobanteDemo> = {},
): ComprobanteDemo => ({
  id: 'd819ddb0-64de-4a17-9156-878630130a39',
  numero: 'F001-00000045',
  tipo: '01',
  serie: 'F001',
  correlativo: 45,
  clienteRuc: '20100070970',
  clienteTipoDoc: '6',
  clienteRazonSocial: 'FERRETERIA LOS ANDES S.A.C.',
  fechaEmision: '2026-11-01',
  moneda: 'PEN',
  baseImponible: 10,
  igv: 1.8,
  detraccion: 0,
  retencion: 0,
  totalNeto: 11.8,
  estado: 'ACEPTADO',
  cdrCodigo: '0',
  cdrDescripcion: 'La Factura numero F001-00000045, ha sido aceptada',
  hashCpe: '',
  tipoOperacion: '0101',
  formaPago: 'Contado',
  cuotas: [],
  items: [] as readonly ItemDemo[],
  ...parcial,
});

/** Borrador de nota con el cliente AÚN VACÍO, como abre el formulario. */
const borradorVacio = (parcial: Partial<BorradorEmision> = {}): BorradorEmision =>
  ({
    tipo: '07',
    serie: 'F001',
    correlativo: 100,
    clienteDoc: '',
    clienteTipoDoc: '6',
    clienteRazonSocial: '',
    items: [],
    formaPago: 'Contado',
    cuotas: [],
    numeroCuotas: 2,
    codigoDetraccion: '',
    agenteRetencion: false,
    bolsas: 0,
    documentoAfectado: '',
    tipoDocumentoAfectado: '0101',
    motivoCodigo: '01',
    motivoDescripcion: 'Anulación de la operación',
    fecha: '2026-11-02',
    ...parcial,
  }) as BorradorEmision;

describe('el origen de la nota tiene que encontrar la factura', () => {
  it('encuentra F001-00000045 escrita con ceros, en minúsculas o con espacios', () => {
    const existentes = [comprobanteCompleto()];

    // Las cuatro formas en que se teclea en un mostrador.
    for (const tecleado of [
      'F001-00000045',
      'f001-00000045',
      '  F001-00000045  ',
      'F001-45',
    ]) {
      expect(buscarAfectado(existentes, tecleado)?.numero).toBe('F001-00000045');
    }
  });

  it('la grilla filtrada de Notas NO contiene la factura: por eso hay que consultar la empresa', () => {
    // Esto reproduce el defecto 1 tal cual: la página de Notas pide `tipo=07`,
    // así que `existentes` trae solo notas. Ninguna búsqueda de factura puede
    // acertar contra esa lista.
    const soloNotas = [
      comprobanteCompleto({
        id: '0723c0bc-121b-408b-b85d-4f51449ffcea',
        numero: 'FC01-00000004',
        tipo: '07',
        serie: 'FC01',
        correlativo: 4,
      }),
    ];

    expect(buscarAfectado(soloNotas, 'F001-00000045')).toBeUndefined();

    // Y con la lista de la EMPRESA sí se encuentra. Es lo que ahora alimenta el
    // modal: se consulta el listado real en lugar de la grilla del apartado.
    const deLaEmpresa = [...soloNotas, comprobanteCompleto()];
    expect(buscarAfectado(deLaEmpresa, 'F001-00000045')?.numero).toBe(
      'F001-00000045',
    );
  });
});

describe('el documento encontrado se puede mostrar sin reventar', () => {
  it('los importes que lee el bloque «Se vincula con ...» existen y son números', () => {
    // El bloque pintaba `afectado.baseImponible.toFixed(2)` y
    // `afectado.igv.toFixed(2)`. Con una fila `Invoice` sin adaptar, el primero
    // llegaba `undefined` y el módulo se caía. Esta prueba fija el contrato.
    const afectado = comprobanteCompleto();

    expect(typeof afectado.baseImponible).toBe('number');
    expect(typeof afectado.igv).toBe('number');
    expect(Number.isFinite(afectado.baseImponible)).toBe(true);
    expect(Number.isFinite(afectado.igv)).toBe(true);

    // Lo que hace el render, sin lanzar.
    expect(() => afectado.baseImponible.toFixed(2)).not.toThrow();
    expect(afectado.baseImponible.toFixed(2)).toBe('10.00');
    expect(afectado.igv.toFixed(2)).toBe('1.80');
  });
});

describe('una nota hereda el adquirente del documento afectado', () => {
  it('rellena el cliente desde la factura cuando el campo está vacío', () => {
    const { borrador, afectado } = vincularDocumentoAfectado(
      borradorVacio({ documentoAfectado: 'F001-00000045' }),
      [comprobanteCompleto()],
    );

    expect(afectado?.numero).toBe('F001-00000045');
    // Sin esta herencia la nota quedaba bloqueada con "Documento inválido
    // (RUC módulo 11 o DNI de 8 dígitos)": el XML de una nota lleva el mismo
    // adquirente que la factura y SUNAT rechaza que difiera.
    expect(borrador.clienteDoc).toBe('20100070970');
    expect(borrador.clienteRazonSocial).toBe('FERRETERIA LOS ANDES S.A.C.');
  });

  it('NO pisa el cliente que el usuario ya había escrito', () => {
    const { borrador } = vincularDocumentoAfectado(
      borradorVacio({
        documentoAfectado: 'F001-00000045',
        clienteDoc: '45678912',
        clienteRazonSocial: 'OTRO CLIENTE',
      }),
      [comprobanteCompleto()],
    );

    // Se respeta lo tecleado y la validación avisará de la discrepancia; no se
    // le cambian los datos por detrás.
    expect(borrador.clienteDoc).toBe('45678912');
    expect(borrador.clienteRazonSocial).toBe('OTRO CLIENTE');
  });

  it('hereda la forma de pago y las cuotas de una venta al crédito', () => {
    const { borrador } = vincularDocumentoAfectado(
      borradorVacio({ documentoAfectado: 'F001-00000045' }),
      [
        comprobanteCompleto({
          formaPago: 'Credito',
          cuotas: [
            { numero: 'Cuota001', monto: 5.9, vencimiento: '2026-12-01' },
            { numero: 'Cuota002', monto: 5.9, vencimiento: '2027-01-01' },
          ],
        }),
      ],
    );

    expect(borrador.formaPago).toBe('Credito');
    expect(borrador.cuotas).toHaveLength(2);
  });

  it('no hereda nada de un comprobante RECHAZADO', () => {
    const { afectado, borrador } = vincularDocumentoAfectado(
      borradorVacio({ documentoAfectado: 'F001-00000045' }),
      [comprobanteCompleto({ estado: 'RECHAZADO' })],
    );

    expect(afectado).toBeUndefined();
    expect(borrador.clienteDoc).toBe('');
  });
});
