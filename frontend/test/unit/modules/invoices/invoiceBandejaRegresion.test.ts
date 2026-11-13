import { describe, expect, it } from 'vitest';
import { aInvoice } from '@/modules/invoices/lib/invoiceMapper';
import { aComprobanteDemo } from '@/modules/invoices/lib/invoiceApiMapper';
import { calcularResumenFiscal } from '@/modules/invoices/lib/invoiceMetrics';
import { aplicarFiltros, porApartado } from '@/modules/invoices/lib/invoiceFilters';
import { construir } from '@/modules/invoices/data/invoiceDemoTypes';

describe('bandeja: datos guardados y métricas', () => {
  it('conserva referencia y estado del listado hasta la fila', () => {
    const nota = aInvoice({ id: 'n', tipo_comprobante: '07', serie: 'FC01', correlativo: 12, numero: 'FC01-00000012', fecha_emision: '2026-11-01', estado: 'ERROR_RED', monto_total: 118, moneda: 'PEN', cliente_documento: null, cliente_nombre: null, cdr_codigo: null, documento_afectado: 'F001-00000056' });
    const fila = aComprobanteDemo(nota);
    expect(fila.documentoAfectado).toBe('F001-00000056');
    expect(fila.estado).toBe('SIN_CONFIRMAR');
    expect(fila.estadoBackend).toBe('ERROR_RED');
  });
  it('excluye errores de red de importes y los cuenta en la tasa', () => {
    const base = { tipo: '01' as const, serie: 'F001', ruc: '20100070970', razonSocial: 'CLIENTE', fecha: '2026-11-01', base: 100 };
    const aceptados = Array.from({ length: 7 }, (_, i) => construir({ ...base, correlativo: i + 1, estado: 'ACEPTADO' }));
    const error = { ...construir({ ...base, correlativo: 56, estado: 'SIN_CONFIRMAR' }), estadoBackend:'ERROR_RED' };
    const resumen = calcularResumenFiscal([...aceptados, error]);
    expect(resumen.totalFacturado).toBe(826);
    expect(resumen.tasaExito).toBe(87.5);
    expect(resumen.erroresRed).toBe(1);
    expect(resumen.enCola).toBe(0);
    expect(aplicarFiltros([error], { busqueda: 'F001-0056', estado: 'TODOS', desde: '', hasta: '' })).toHaveLength(1);
  });
  it('mantiene el neto de una muestra mixta y filtra las notas por código', () => {
    const base = { serie: 'F001', ruc: '20100070970', razonSocial: 'CLIENTE', fecha: '2026-11-01', estado: 'ACEPTADO' as const };
    const lote = [
      construir({ ...base, tipo: '01', correlativo: 1, base: 1000 }),
      construir({ ...base, tipo: '07', serie: 'FD01', correlativo: 2, base: 100 }),
      construir({ ...base, tipo: '08', serie: 'FC01', correlativo: 3, base: 50 }),
    ];
    const resumen = calcularResumenFiscal(lote);
    expect(resumen.totalFacturado).toBe(1180);
    expect(resumen.acreditado).toBe(118);
    expect(resumen.debitado).toBe(59);
    expect(resumen.netoTotalCobrar).toBe(1121);
    expect(porApartado(lote, 'notas').map((c) => c.tipo)).toEqual(['07', '08']);
  });
});
