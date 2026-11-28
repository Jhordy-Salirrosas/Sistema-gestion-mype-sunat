import { borradorAPayloadEmision } from '@/modules/invoices/lib/invoiceEmitPayload';
import { calcularFlujo } from '@/modules/invoices/lib/invoiceFlujoPago';
import { pagoSegunDeposito } from '@/modules/invoices/lib/invoicePagoPresentacion';
import { expect,it } from 'vitest';
import { borradorConLinea as borradorInicial } from '../../../fixtures/invoiceEmissionProduct';
it.each([[730.17,73.02,0,73,657.17],[735,73.5,0,74,661],[730.17,73.02,10,73,647.17],[118,0,0,0,118]])('conserva total %s con depósito redondeado %s', (total,detraccion,retencion,bn,directo) => {
 const p = pagoSegunDeposito(total,detraccion,retencion);
 expect(p).toEqual({ depositoBn: bn, pagoDirecto: directo });
 expect(Math.round((p.depositoBn+p.pagoDirecto+retencion)*100)).toBe(Math.round(total*100));
});
it('la presentación no altera el neto fiscal ni el payload/cuotas', () => {
 const base = borradorInicial('01','2026-11-10');
 const b = { ...base, formaPago: 'Credito' as const, medioPagoDetraccion: '001' as const, items: [{ ...base.items[0], valorUnitario: 730.17/1.18, precioUnitario: 730.17, codigoDetraccion: '009' }], cuotas: [{ monto: 657.15, vencimiento: '2026-12-10' }] };
 const antes = borradorAPayloadEmision(b);
 expect(calcularFlujo(b).neto).toBe(657.15);
 expect(pagoSegunDeposito(730.17,73.02).pagoDirecto).toBe(657.17);
 expect(borradorAPayloadEmision(b)).toEqual(antes);
 expect(antes.cuotas?.[0].monto).toBe(657.15);
});
