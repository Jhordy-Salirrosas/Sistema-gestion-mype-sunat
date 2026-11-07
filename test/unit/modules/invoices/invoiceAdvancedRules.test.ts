import { describe, expect, it } from 'vitest';
import {
  calcularResumenFiscal,
} from '@/modules/invoices/lib/invoiceMetrics';
import {
  COMPROBANTES_DEMO,
} from './fixtures/comprobantesDemo';
import { construir } from '@/modules/invoices/data/invoiceDemoTypes';

describe('calcularResumenFiscal', () => {
  it('excluye los comprobantes rechazados del total facturado', () => {
    const resumen = calcularResumenFiscal(COMPROBANTES_DEMO);
    const rechazados = COMPROBANTES_DEMO.filter(
      (c) => c.estado === 'RECHAZADO',
    );

    expect(rechazados.length).toBe(2);
    expect(resumen.rechazados).toBe(2);

    // Si los rechazados se excluyen, el resumen debe coincidir con el cálculo
    // sobre el subconjunto de comprobantes válidos.
    const soloValidos = calcularResumenFiscal(
      COMPROBANTES_DEMO.filter((c) => c.estado !== 'RECHAZADO'),
    );
    expect(resumen.baseTotal).toBe(soloValidos.baseTotal);

    const basesRechazadas = rechazados.reduce(
      (acc, c) => acc + c.baseImponible,
      0,
    );
    expect(basesRechazadas).toBe(1895);
  });

  it('resta las notas de crédito en lugar de sumarlas', () => {
    const soloFactura = [
      construir({
        tipo: '01', serie: 'F001', correlativo: 1, ruc: '20100070970',
        razonSocial: 'CLIENTE', fecha: '2026-10-16', base: 1000,
        estado: 'ACEPTADO',
      }),
    ];
    const conNota = [
      ...soloFactura,
      construir({
        tipo: '07', serie: 'FC01', correlativo: 1, ruc: '20100070970',
        razonSocial: 'CLIENTE', fecha: '2026-10-16', base: 200,
        estado: 'ACEPTADO',
      }),
    ];

    expect(calcularResumenFiscal(soloFactura).baseTotal).toBe(1000);
    expect(calcularResumenFiscal(conNota).baseTotal).toBe(800);
    expect(calcularResumenFiscal(conNota).igvTotal).toBe(144);
  });

  it('suma las notas de débito a la venta del periodo', () => {
    const base = [
      construir({
        tipo: '01', serie: 'F001', correlativo: 1, ruc: '20100070970',
        razonSocial: 'CLIENTE', fecha: '2026-10-16', base: 1000,
        estado: 'ACEPTADO',
      }),
    ];
    const conDebito = [
      ...base,
      construir({
        tipo: '08', serie: 'FD01', correlativo: 1, ruc: '20100070970',
        razonSocial: 'CLIENTE', fecha: '2026-10-16', base: 450,
        estado: 'ACEPTADO',
      }),
    ];

    expect(calcularResumenFiscal(conDebito).baseTotal).toBe(1450);
  });

  it('expone observados y netoTotalCobrar', () => {
    const resumen = calcularResumenFiscal(COMPROBANTES_DEMO);

    expect(resumen.observados).toBe(1);
    expect(typeof resumen.netoTotalCobrar).toBe('number');
    expect(resumen.netoTotalCobrar).toBeCloseTo(COMPROBANTES_DEMO.filter((c) => ['ACEPTADO', 'OBSERVADO'].includes(c.estado) && ['01', '03', '07', '08'].includes(c.tipo)).reduce((sum, c) => sum + (c.tipo === '07' ? -c.totalNeto : c.totalNeto), 0), 2);
  });
});

describe('error SUNAT 2022 (auto-facturación)', () => {
  it('ningún comprobante tiene como cliente al propio emisor', () => {
    const autoFacturas = COMPROBANTES_DEMO.filter(
      (c) =>
        c.clienteRuc === '20601234567' &&
        (c.tipo === '01' || c.tipo === '03' || c.tipo === '07' ||
          c.tipo === '08'),
    );

    expect(autoFacturas).toHaveLength(0);
  });
});
