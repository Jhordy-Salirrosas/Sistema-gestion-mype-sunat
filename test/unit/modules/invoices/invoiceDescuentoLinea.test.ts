import { describe, expect, it } from 'vitest';
import { calcularItem, itemVacio, totalizarItems, validarItems } from '@/modules/invoices/lib/invoiceItems';
import { borradorAPayloadEmision } from '@/modules/invoices/lib/invoiceEmitPayload';
import { borradorInicial } from '@/modules/invoices/lib/invoiceEmitDraft';

describe('descuento por línea', () => {
  const item = { ...itemVacio('1'), descripcion: 'Servicio', cantidad: 1, valorUnitario: 100 };
  it.each([['00', 90, 16.2, 106.2], ['01', 100, 18, 108]] as const)('calcula código %s y lo conserva en payload', (codigo, base, igv, total) => {
    const linea = { ...item, descuento: { codigo, monto: 10 } };
    expect(calcularItem(linea)).toMatchObject({ base, igv, total });
    expect(totalizarItems([linea]).total).toBe(total);
    const b = { ...borradorInicial('01', '2026-11-01'), items: [linea] };
    expect(borradorAPayloadEmision(b).items[0].descuento).toEqual({ codigo, monto: 10 });
  });
  it('rechaza descuento excesivo y muestra null al no registrarlo', () => {
    expect(validarItems([{ ...item, descuento: { codigo: '00', monto: 101 } }])).toHaveLength(1);
    const b = { ...borradorInicial('01', '2026-11-01'), items: [item] };
    expect(borradorAPayloadEmision(b).items[0].descuento).toBeNull();
  });
});
