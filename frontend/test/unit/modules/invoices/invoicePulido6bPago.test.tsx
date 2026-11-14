import { render, screen } from '@testing-library/react';
import { InvoiceEmitResumen } from '@/modules/invoices/components/InvoiceEmitResumen';
import { it, expect } from 'vitest';
import { pagoSegunDeposito } from '@/modules/invoices/lib/invoicePagoPresentacion';
import { borradorConLinea as borradorInicial } from '../../../fixtures/invoiceEmissionProduct';
import { calcularFlujo } from '@/modules/invoices/lib/invoiceFlujoPago';
import { borradorAPayloadEmision } from '@/modules/invoices/lib/invoiceEmitPayload';
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

it('resumen muestra el pago bancario coherente y mantiene el neto fiscal de cuotas', () => {
 const base=borradorInicial('01','2026-11-10');
 const b={ ...base, formaPago:'Credito' as const, items:[{ ...base.items[0],valorUnitario:730.17/1.18,precioUnitario:730.17,codigoDetraccion:'009' }], cuotas:[{ monto:657.15,vencimiento:'2026-12-10' }] };
 render(<InvoiceEmitResumen borrador={b} />);
 expect(screen.getByText('Pago directo al proveedor S/ 657.17')).toBeTruthy();
 expect(screen.getByText('Depósito en el Banco de la Nación S/ 73.00')).toBeTruthy();
 expect(screen.getByText('Neto pendiente S/ 657.15')).toBeTruthy();
});
