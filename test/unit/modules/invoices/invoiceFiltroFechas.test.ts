import { describe, expect, it } from 'vitest';
import { aplicarFiltros } from '@/modules/invoices/lib/invoiceFilters';
import { construir } from '@/modules/invoices/data/invoiceDemoTypes';

const documento = (fecha: string, correlativo: number) => construir({ tipo: '01', serie: 'F001', correlativo, ruc: '20100070970', razonSocial: 'Cliente', fecha, base: 100, estado: 'ACEPTADO' });
const docs = [documento('2026-10-14', 1), documento('2026-10-15', 2), documento('2026-10-16', 3)];
describe('rango de fechas de la bandeja', () => {
  it('incluye los extremos y excluye fechas fuera del rango', () => {
    expect(aplicarFiltros(docs, { busqueda: '', estado: 'TODOS', desde: '2026-10-15', hasta: '2026-10-16' }).map((d) => d.correlativo)).toEqual([2, 3]);
  });
  it('acepta un solo extremo y no encuentra fechas con rango invertido', () => {
    expect(aplicarFiltros(docs, { busqueda: '', estado: 'TODOS', desde: '', hasta: '2026-10-14' })).toHaveLength(1);
    expect(aplicarFiltros(docs, { busqueda: '', estado: 'TODOS', desde: '2026-10-16', hasta: '2026-10-15' })).toHaveLength(0);
  });
});
