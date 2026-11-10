import { calcularMetricas } from '../../../src/modules/invoices/application/services/invoiceMetricsService';

it('neto confirmado = facturas/boletas - NC + ND; F001-57 EN_COLA por 118 no lo infla', () => {
  const filas = [
    { tipoComprobante: '01', estado: 'ACEPTADO', total: 1000 },
    { tipoComprobante: '03', estado: 'OBSERVADO', total: 180 },
    { tipoComprobante: '07', estado: 'ACEPTADO', total: 100 },
    { tipoComprobante: '08', estado: 'ACEPTADO', total: 20 },
    { tipoComprobante: '01', estado: 'EN_COLA', total: 118 },
    { tipoComprobante: '01', estado: 'ERROR_RED', total: 118 },
    { tipoComprobante: '01', estado: 'RECHAZADO', total: 118 },
    { tipoComprobante: '01', estado: 'ANULADO', total: 118 },
  ];
  expect(calcularMetricas(filas, '2026-11')).toMatchObject({ total: 8, aceptados: 4, pendientes: 2, facturado: 1100, facturadoBruto: 1200, acreditado: 100, debitado: 20 });
});
it.each(['EN_COLA', 'ENVIADO', 'PENDIENTE', 'ERROR_RED', 'RECHAZADO', 'ANULADO'])('ningún tipo en %s afecta dinero, pero todos cuentan en total', estado => {
  const m = calcularMetricas(['01', '03', '07', '08'].map(tipoComprobante => ({ tipoComprobante, estado, total: 118 })), '2026-11');
  expect(m).toMatchObject({ total: 4, facturado: 0, facturadoBruto: 0, acreditado: 0, debitado: 0 });
});
