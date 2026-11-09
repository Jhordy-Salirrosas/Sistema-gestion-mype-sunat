/**
 * `borradorAPayloadEmision`: el traductor único del formulario al backend (M1).
 *
 * POR QUÉ ESTAS PRUEBAS EXISTEN AHORA
 *
 * Este módulo se escribió para que la bandeja y la página `/invoices/emision`
 * mandaran exactamente lo mismo, pero NO tenía ni una prueba propia: solo se
 * ejercitaba de rebote al montar el modal. Al unificar se descubrió que la
 * página seguía armando su payload a mano, así que lo que había en verde era
 * una sola de las dos implementaciones.
 *
 * Cada bloque cubre un dato que se perdió alguna vez en la traducción.
 */
import { describe, expect, it } from 'vitest';
import { borradorAPayloadEmision, problemaDeCronograma } from '@/modules/invoices/lib/invoiceEmitPayload';
import { borradorInicial } from '@/modules/invoices/lib/invoiceEmitDraft';
import { repartirEnCuotas } from '@/modules/invoices/lib/invoiceDetraccion';
import type { ItemBorrador } from '@/modules/invoices/lib/invoiceItems';

const factura = (parcial: Record<string, unknown> = {}) => ({
  ...borradorInicial('01', '2026-11-03'),
  clienteDoc: '20100070970',
  clienteRazonSocial: 'FERRETERÍA LOS ANDES S.A.C.',
  ...parcial,
});

describe('borradorAPayloadEmision · cabecera', () => {
  it('traduce tipo, serie, cliente y fecha', () => {
    const p = borradorAPayloadEmision(factura());

    expect(p.tipo_comprobante).toBe('01');
    expect(p.serie).toBe('F001');
    expect(p.customer_identity_type).toBe('6');
    expect(p.customer_identity_number).toBe('20100070970');
    expect(p.customer_legal_name).toBe('FERRETERÍA LOS ANDES S.A.C.');
    // D9: la fecha elegida tiene que viajar; si falta, el backend fecha con su
    // propio reloj (UTC) y desde las 19:00 de Lima es el día siguiente.
    expect(p.fecha_emision).toBe('2026-11-03');
  });

  it('limpia el documento del cliente de guiones y espacios', () => {
    const p = borradorAPayloadEmision(factura({ clienteDoc: '20-100 070 970' }));
    expect(p.customer_identity_number).toBe('20100070970');
  });

  it('recorta la razón social', () => {
    const p = borradorAPayloadEmision(factura({ clienteRazonSocial: '  ACME  ' }));
    expect(p.customer_legal_name).toBe('ACME');
  });

  it('una boleta lleva DNI con tipo 1', () => {
    const p = borradorAPayloadEmision(
      borradorInicial('03', '2026-11-03') as never,
    );
    expect(p.customer_identity_type).toBe('1');
    expect(p.serie).toBe('B001');
  });
});

describe('borradorAPayloadEmision · líneas', () => {
  const linea = (parcial: Partial<ItemBorrador> = {}): ItemBorrador => ({
    clave: 'k',
    codigo: 'SRV-001',
    descripcion: 'Servicio',
    unidad: 'NIU',
    cantidad: 1,
    valorUnitario: 100,
    afectacion: 'GRAVADA',
    icbper: 0,
    ...parcial,
  });

  it('traduce la afectación de la línea al código del Catálogo 07', () => {
    // El defecto que esto previene: mandar siempre '10' hacía que elegir
    // "Exonerada" en la grilla emitiera un comprobante gravado.
    const p = borradorAPayloadEmision(
      factura({
        items: [
          linea({ afectacion: 'GRAVADA' }),
          linea({ afectacion: 'EXONERADA' }),
          linea({ afectacion: 'INAFECTA' }),
        ],
      }),
    );

    expect(p.items.map((i) => i.afectacion)).toEqual(['10', '20', '30']);
  });

  it('la detracción viaja POR LÍNEA, no en la cabecera', () => {
    const p = borradorAPayloadEmision(
      factura({
        items: [
          linea({ codigo: 'FLT-1', codigoDetraccion: '027' }),
          linea({ codigo: 'TOR-1' }),
        ],
      }),
    );

    expect(p.items[0].codigoDetraccion).toBe('027');
    expect(p.items[1].codigoDetraccion).toBeUndefined();
    // No existe un campo de detracción en la cabecera del contrato.
    expect(p).not.toHaveProperty('codigo_detraccion');
  });

  it('el ICBPER solo viaja si es mayor que cero', () => {
    const p = borradorAPayloadEmision(
      factura({
        items: [
          linea({ codigo: 'ICBPER', icbper: 1 }),
          linea({ codigo: 'OTRO', icbper: 0 }),
        ],
      }),
    );

    expect(p.items[0].icbper).toBe(1);
    expect(p.items[1].icbper).toBeUndefined();
  });

  it('no manda código vacío', () => {
    const p = borradorAPayloadEmision(
      factura({ items: [linea({ codigo: '   ' })] }),
    );
    expect(p.items[0].codigo).toBeUndefined();
  });
});

describe('borradorAPayloadEmision · forma de pago y cuotas', () => {
  it('al contado no viajan cuotas', () => {
    const p = borradorAPayloadEmision(factura({ formaPago: 'Contado' }));
    expect(p.forma_pago).toBe('Contado');
    expect(p.cuotas).toBeUndefined();
  });

  it('al crédito viajan las cuotas con importe redondeado a céntimos', () => {
    const cuotas = repartirEnCuotas(11.8, 2, '2026-11-03').map((c) => ({
      monto: c.monto,
      vencimiento: c.vencimiento,
    }));

    const p = borradorAPayloadEmision(
      factura({ formaPago: 'Credito', cuotas }),
    );

    expect(p.cuotas).toHaveLength(2);
    // Sin el redondeo en el traductor, 11.80 entre 2 puede viajar como
    // 5.9000000000000004 y la regla 3319 (suma exacta) lo rechaza.
    for (const c of p.cuotas ?? []) {
      expect(c.monto).toBe(Math.round(c.monto * 100) / 100);
      expect(String(c.monto).length).toBeLessThanOrEqual(5);
    }
  });
});

describe('borradorAPayloadEmision · notas 07/08', () => {
  it('la nota lleva documento afectado y motivo', () => {
    const p = borradorAPayloadEmision(
      borradorInicial('07', '2026-11-03') as never,
    );

    expect(p.documento_afectado).toBeDefined();
    expect(p.codigo_motivo_nota).toBe('01');
    expect(p.descripcion_motivo_nota).toBeTruthy();
  });

  it('una factura NO lleva campos de nota', () => {
    const p = borradorAPayloadEmision(factura());
    expect(p).not.toHaveProperty('documento_afectado');
    expect(p).not.toHaveProperty('codigo_motivo_nota');
    expect(p).not.toHaveProperty('descripcion_motivo_nota');
  });

  it('la nota nunca declara agente de retención', () => {
    // "el agente de retención pertenece al cliente, no al comprobante"; y una
    // nota no la genera.
    const p = borradorAPayloadEmision({
      ...borradorInicial('07', '2026-11-03'),
      agenteRetencion: true,
    });
    expect(p.agente_retencion).toBe(false);
  });
});

describe('problemaDeCronograma', () => {
  it('al contado no hay cronograma que revisar', () => {
    expect(problemaDeCronograma(factura())).toBeNull();
  });

  it('un crédito sin cuotas se detiene antes de enviar', () => {
    expect(
      problemaDeCronograma(factura({ formaPago: 'Credito', cuotas: [] })),
    ).toContain('al menos una cuota');
  });

  it('un crédito con cuotas posteriores a la emisión no da problema', () => {
    const cuotas = repartirEnCuotas(118, 2, '2026-11-03').map((c) => ({
      monto: c.monto,
      vencimiento: c.vencimiento,
    }));

    expect(
      problemaDeCronograma(factura({ formaPago: 'Credito', cuotas })),
    ).toBeNull();
  });

  it('una cuota que vence el mismo día de la emisión se rechaza (regla 3267)', () => {
    const mensaje = problemaDeCronograma(
      factura({
        formaPago: 'Credito',
        cuotas: [{ monto: 118, vencimiento: '2026-11-03' }],
      }),
    );

    expect(mensaje).toBeTruthy();
    expect(mensaje).toContain('2026-11-03');
  });
});

// El catálogo conserva su base sugerida; seleccionar inicializa también el precio final.
import { itemDesdeProducto } from '@/modules/invoices/lib/invoiceItems';
it.each([['10', 118], ['20', 100], ['30', 100]])('seleccionar → no editar → crear conserva precio final (%s)', (afectacion, precio) => {
  const selected = itemDesdeProducto({ sku: 'P1', descripcion: 'Producto', unidad: 'NIU', valorUnitario: 100, afectacion }, 'k');
  const payload = borradorAPayloadEmision(factura({ items: [selected] }));
  expect(payload.items[0]).toMatchObject({ codigo: 'P1', cantidad: 1, precioUnitario: precio, afectacion });
});
import { productosDesdeStocks } from '@/modules/invoices/services/inventoryProductsApi';
it.each(['12', '16', '21', '31', '37', '40'])('catálogo → selección → payload conserva código fiscal %s', codigo => {
  const product = productosDesdeStocks({ balances: [{ sku: 'P1', description: 'Prueba', sunatUnitCode: 'KGM', averageUnitCost: 100, taxAffectation: codigo }] })[0];
  const selected = itemDesdeProducto(product, 'k');
  const payload = borradorAPayloadEmision(factura({ items: [selected] }));
  expect(payload.items[0].afectacion).toBe(codigo);
  expect(payload.items[0].unidad).toBe('KGM');
});
it('no fabrica afectación ni unidad cuando falta configuración del producto', () => {
  expect(() => itemDesdeProducto({ sku: 'P1', descripcion: 'Prueba', unidad: '', valorUnitario: 100, afectacion: '10' }, 'k')).toThrow(/Unidad/);
  expect(() => itemDesdeProducto({ sku: 'P1', descripcion: 'Prueba', unidad: 'NIU', valorUnitario: 100, afectacion: null }, 'k')).toThrow(/afectación/);
});
