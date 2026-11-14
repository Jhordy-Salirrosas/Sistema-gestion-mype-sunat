import { describe, expect, it } from '@jest/globals';
import { calcularRetencion, calcularTotales } from '../../../src/modules/invoices/ublTotalesHelper';
import { traducirEmision } from '../../../src/modules/invoices/application/services/emitirComprobanteAdapter';
import { UblGeneratorService } from '../../../src/modules/invoices/ublGeneratorService';
import { InvoiceJobConsumer } from '../../../src/modules/invoices/invoiceJobConsumer';
import { balanceAsiento, lineasAsientoVenta } from '../../../src/modules/invoices/application/services/accountingBridge';

describe('retención unificada del IGV', () => {
  it.each([[118, 0], [700, 0], [701, 21.03], [1180, 35.4], [1770, 53.1]])
    ('sobre S/ %s resulta S/ %s', (total, esperado) => {
      expect(calcularRetencion(total)).toBe(esperado);
      const totales = calcularTotales({ montoTotal: total, montoGravado: total, montoIgv: 0, montoRetencion: calcularRetencion(total) });
      expect(totales.retencion).toBe(esperado);
      expect(totales.importePagar).toBe(Math.round((total - esperado) * 100) / 100);
    });
});

it('valida y escribe el crédito por el neto después de la retención', () => {
  const r = traducirEmision({ tipo_comprobante: '01', serie: 'F001', customer_legal_name: 'Cliente',
    agente_retencion: true, forma_pago: 'Credito', fecha_emision: '2026-11-01',
    cuotas: [{ monto: 572.3, vencimiento: '2026-12-01' }, { monto: 572.3, vencimiento: '2027-01-01' }],
    items: [{ descripcion: 'Servicio', cantidad: 1, valorUnitario: 1000, afectacion: '10' }] },
  { ruc: '20100070970', razonSocial: 'Empresa' }, 1);
  expect(r.importes).toMatchObject({ total: 1180, retencion: 35.4, importePagar: 1144.6 });
  const xml = new UblGeneratorService().generateInvoiceXml(r.dto.payload_ubl as never);
  expect(xml).toContain('<cbc:Amount currencyID="PEN">1144.60</cbc:Amount>');
  expect(xml).toContain('<cbc:Amount currencyID="PEN">35.40</cbc:Amount>');
  const consumer = new InvoiceJobConsumer({} as never, {} as never, {} as never, {} as never, {} as never,
    {} as never, {} as never, {} as never, {} as never, {} as never, {} as never);
  const importes = (consumer as unknown as { liquidarParaPuente(items: unknown[], payload: unknown): Parameters<typeof lineasAsientoVenta>[0] })
    .liquidarParaPuente([], r.dto.payload_ubl);
  expect(importes.retencion).toBe(35.4);
  const asiento = lineasAsientoVenta(importes);
  expect(asiento).toEqual(expect.arrayContaining([expect.objectContaining({ accountCode: '40114', debitAmount: 35.4 })]));
  expect(balanceAsiento(asiento).cuadra).toBe(true);
});

it('conserva la detracción existente y excluye retención del neto y las cuotas', () => {
  const r = traducirEmision({ tipo_comprobante: '01', serie: 'F001', customer_legal_name: 'Cliente',
    agente_retencion: true, forma_pago: 'Credito', fecha_emision: '2026-11-01', cuenta_banco_nacion: '00123456789', medio_pago_detraccion: '003',
    cuotas: [{ monto: 566.4, vencimiento: '2026-12-01' }, { monto: 566.4, vencimiento: '2027-01-01' }],
    items: [{ descripcion: 'Flete', cantidad: 1, valorUnitario: 1000, afectacion: '10', codigoDetraccion: '027' }] },
  { ruc: '20100070970', razonSocial: 'Empresa' }, 1);
  expect(r.importes).toMatchObject({ total: 1180, detraccion: 47.2, retencion: 0, importePagar: 1132.8 });
  const xml = new UblGeneratorService().generateInvoiceXml(r.dto.payload_ubl as never);
  expect(xml).toContain('<cbc:Amount currencyID="PEN">1132.80</cbc:Amount>');
});
