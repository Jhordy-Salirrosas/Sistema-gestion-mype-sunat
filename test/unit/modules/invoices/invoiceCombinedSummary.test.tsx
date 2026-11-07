import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { InvoiceCombinedSummary } from '@/modules/invoices/components/InvoiceCombinedSummary';
import { calcularResumenFiscal } from '@/modules/invoices/lib/invoiceMetrics';
import { construir } from '@/modules/invoices/data/invoiceDemoTypes';

const base = { ruc: '20100070970', razonSocial: 'CLIENTE', fecha: '2026-11-01', estado: 'ACEPTADO' as const, correlativo: 1 };
const documentos = [
  construir({ ...base, tipo: '01', serie: 'F001', base: 1000 }),
  construir({ ...base, tipo: '03', serie: 'B001', base: 200 }),
  construir({ ...base, tipo: '07', serie: 'FC01', base: 100 }),
  construir({ ...base, tipo: '08', serie: 'FD01', base: 50 }),
];
afterEach(cleanup);
describe('resumen combinado', () => {
  it('muestra ambos importes separados y conserva facturas/boletas − crédito + débito', () => {
    const resumen = calcularResumenFiscal(documentos);
    expect(resumen.totalFacturado).toBe(1416);
    expect(resumen.acreditado).toBe(118);
    expect(resumen.debitado).toBe(59);
    expect(resumen.netoTotalCobrar).toBe(1357);
    expect(resumen.netoTotalCobrar).toBe(resumen.totalFacturado - resumen.acreditado + resumen.debitado);
    render(<InvoiceCombinedSummary resumen={resumen} />);
    expect(screen.getByText(/Notas de crédito S\/ 118.00 · Notas de débito S\/ 59.00 · Neto S\/ 1,357.00/)).toBeTruthy();
  });
  it('muestra siempre el débito aunque sea cero', () => {
    render(<InvoiceCombinedSummary resumen={calcularResumenFiscal(documentos.slice(0, 3))} />);
    expect(screen.getByText(/Notas de crédito S\/ 118.00 · Notas de débito S\/ 0.00 · Neto S\/ 1,298.00/)).toBeTruthy();
  });
  it('mantiene ambos rótulos sin documentos', () => {
    render(<InvoiceCombinedSummary resumen={calcularResumenFiscal([])} />);
    expect(screen.getByText(/Notas de crédito S\/ 0.00 · Notas de débito S\/ 0.00 · Neto S\/ 0.00/)).toBeTruthy();
  });
});
