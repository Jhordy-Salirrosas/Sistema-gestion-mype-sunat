import { expect, it } from 'vitest';
import { lineasParaNota } from '@/modules/invoices/lib/invoiceLineasOrigen';
import { borradorAPayloadEmision } from '@/modules/invoices/lib/invoiceEmitPayload';
import { borradorInicial } from '@/modules/invoices/lib/invoiceEmitDraft';
it.each(['10', '12', '21', '31', '37', '40'])('nota conserva código %s y precio según la afectación sin alterar el valor referencial', afectacion => {
  const items = lineasParaNota([{ codigo: 'HIST', descripcion: 'Histórico', unidad: 'NIU', cantidad: 1,
    valor_unitario: 84.7458, precio_unitario: 100.0001, afectacion }]);
  expect(items).not.toBeNull();
  const payload = borradorAPayloadEmision({ ...borradorInicial('07', '2026-11-09'), items: items! });
  expect(payload.items[0]).toMatchObject({ afectacion, precioUnitario: afectacion === '10' ? 100.0001 : afectacion === '12' || afectacion === '21' || afectacion === '31' || afectacion === '37' ? 0 : 84.7458, unidad: 'NIU' });
});
it('una referencia histórica sin precio registrado queda incompleta', () => {
  expect(lineasParaNota([{ codigo: 'H', descripcion: 'Histórico', unidad: 'NIU', cantidad: 1,
    valor_unitario: 100, precio_unitario: null, afectacion: '10' }])).toBeNull();
});
