import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { construir } from '@/modules/invoices/data/invoiceDemoTypes';
import { calcularResumenFiscal } from '@/modules/invoices/lib/invoiceMetrics';
import { aplicarFiltros } from '@/modules/invoices/lib/invoiceFilters';
import { InvoiceCombinedSummary } from '@/modules/invoices/components/InvoiceCombinedSummary';
import { InvoiceKpiCards } from '@/modules/invoices/components/InvoiceKpiCards';

const semilla = { serie: 'F001', ruc: '20100070970', razonSocial: 'CLIENTE', fecha: '2026-11-01', base: 100 };
const factura = { ...construir({ ...semilla, tipo: '01', correlativo: 56, estado: 'ACEPTADO' }), totalNeto: 5942.48 };
const nota = { ...construir({ ...semilla, tipo: '07', serie: 'FC01', correlativo: 12, estado: 'ACEPTADO' }), totalNeto: 1271.02 };
const error = { ...construir({ ...semilla, tipo: '01', correlativo: 52, estado: 'SIN_CONFIRMAR' }), totalNeto: 950 };

describe('residuos de bandeja', () => {
  it('cuenta por separado errores y rechazos en el KPI combinado', () => {
    const rechazado = { ...error, estado: 'RECHAZADO' as const };
    const { container } = render(<InvoiceKpiCards resumen={calcularResumenFiscal([error, rechazado])} />);
    const card = container.querySelector('[data-kpi="rechazados"]')!;
    expect(within(card as HTMLElement).getByText('2')).toBeDefined();
    expect(within(card as HTMLElement).getByText(/Rechazos SUNAT: 0.*Origen no confirmado: 1.*Errores de red: 1/)).toBeDefined();
  });
  it('muestra el bruto, acreditado y neto de facturas y notas aceptadas', () => {
    render(<InvoiceCombinedSummary resumen={calcularResumenFiscal([factura, nota, error])} />);
    expect(screen.getByText(/5,942\.48.*1,271\.02.*4,671\.46/)).toBeDefined();
  });
  it('busca correlativo con ceros sin confundirlo con otros números', () => {
    const filtrar = (busqueda: string) => aplicarFiltros([factura, error], { busqueda, estado: 'TODOS', desde: '', hasta: '' });
    for (const termino of ['0056', '00000056', '56', 'F001-0056', 'F001-00000056']) expect(filtrar(termino)).toEqual([factura]);
    expect(filtrar('0057')).toHaveLength(0);
  });
});
