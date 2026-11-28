vi.mock('@/modules/invoices/services/inventoryProductsApi', () => ({ cargarProductosAlmacen: vi.fn(async () => [{sku:'SERV',descripcion:'Servicio',unidad:'NIU',valorUnitario:1000,precioUnitario:1180,afectacion:'10',stock:100,vendible:true}]) }));
import { montoDetraccionPara,validarCronograma } from '@/modules/invoices/lib/invoiceDetraccion';
import { borradorAPayloadEmision,problemaDeCronograma } from '@/modules/invoices/lib/invoiceEmitPayload';
import { calcularFlujo } from '@/modules/invoices/lib/invoiceFlujoPago';
import { calcularDetraccion,calcularRetencion } from '@/modules/invoices/lib/invoiceRetentions';
import { cleanup } from '@testing-library/react';
import { afterEach,expect,it,vi } from 'vitest';
import { borradorConLinea as borradorInicial } from '../../../fixtures/invoiceEmissionProduct';

vi.mock('@/lib/axios', () => ({ apiClient: { get: vi.fn(async () => ({ data: [] })) } }));

afterEach(cleanup);
const base = borradorInicial('01', '2026-11-06');
const items = [{ ...base.items[0], valorUnitario: 1000, codigoDetraccion: '027' }];

it('comprobante al crédito con SPOT excluye retención y usa céntimos en las cuotas', async () => {
  const borrador = { ...base, items, codigoDetraccion: '027', agenteRetencion: true, formaPago: 'Credito' as const };
  const flujo = calcularFlujo(borrador);
  expect(calcularDetraccion(1180, 0.04)).toBe(47.2);
  expect(calcularRetencion(1180, true)).toBe(35.4);
  expect(flujo).toMatchObject({ importeTotal: 1180, detraccion: 47.2, neto: 1132.8 });
  expect(validarCronograma([{ monto: 566.4, vencimiento: '2026-12-06' }, { monto: 566.4, vencimiento: '2027-01-06' }], flujo.neto, borrador.fecha).cuadra).toBe(true);
});

it('SPOT sin retención conserva 47.20 en el comprobante y 1132.80 de neto', async () => {
  const flujo = calcularFlujo({ ...base, items, codigoDetraccion: '027', agenteRetencion: false });
  expect(flujo).toMatchObject({ importeTotal: 1180, detraccion: 47.2, neto: 1132.8 });
  expect(montoDetraccionPara(1180, '027')).toBe(47.2);
});

it('usa solo líneas sujetas y acepta al enviar cuotas que suman el neto real', async () => {
  const borrador = { ...base, codigoDetraccion: '', agenteRetencion: true, formaPago: 'Credito' as const,
    items: [{ ...base.items[0], valorUnitario: 500, codigoDetraccion: '027' },
      { ...base.items[0], clave: 'segunda', valorUnitario: 500, codigoDetraccion: undefined }],
    cuotas: [{ monto: 578.2, vencimiento: '2026-12-06' }, { monto: 578.2, vencimiento: '2027-01-06' }] };
  expect(calcularFlujo(borrador)).toMatchObject({ importeTotal: 1180, detraccion: 23.6, neto: 1156.4 });
  expect(problemaDeCronograma(borrador)).toBeNull();
  expect(borradorAPayloadEmision(borrador).items.map((item) => item.codigoDetraccion)).toEqual(['027', undefined]);
});
