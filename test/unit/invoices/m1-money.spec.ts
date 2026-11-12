import { redondearMoneda, multiplicarMoneda, dividirMoneda, dividirUnitario, formatoMoneda, formatoUnitario } from '../../../src/modules/invoices/money';
import { bloqueImpuestos } from '../../../src/modules/invoices/ublTaxBlocks';
import { DOMParser } from '@xmldom/xmldom';

it('usa HALF_UP decimal también en fronteras que Math.round no representa bien', () => {
  expect(redondearMoneda(1.005)).toBe(1.01);
  expect(redondearMoneda(-1.005)).toBe(-1.01);
  expect(multiplicarMoneda(3, 0.335)).toBe(1.01);
  expect(dividirMoneda(30, 1.18)).toBe(25.42);
  expect(dividirUnitario(10, 1.18)).toBe(8.4745762712);
  expect(formatoMoneda(1.005)).toBe('1.01');
  expect(formatoUnitario(10)).toBe('10.00');
  expect(formatoUnitario(0.335)).toBe('0.335');
});
it('cada TaxTotal de cabecera coincide con sus subtotales y no duplica el ICBPER', () => {
  const blocks = bloqueImpuestos({ gravado: 100, exonerado: 20, inafecto: 10, exportado: 0, igv: 18, icbper: 1.5 } as never, 'PEN', 0.18);
  const doc = new DOMParser().parseFromString(`<root xmlns:cac="urn:cac" xmlns:cbc="urn:cbc">${blocks.join('')}</root>`, 'text/xml');
  const totals = Array.from(doc.documentElement.childNodes).filter((n) => n.nodeType === 1);
  const amounts = totals.map((n) => Number(n.firstChild?.nextSibling?.textContent));
  // No se depende del espacio ni del orden de atributos para sumar los importes.
  const values = totals.map((n) => {
    const children = Array.from(n.childNodes).filter((c) => c.nodeType === 1);
    const declared = Number(children[0].textContent);
    const subtotal = children.slice(1).reduce((sum, c) => sum + Number(Array.from(c.childNodes).find((x) => x.nodeName === 'cbc:TaxAmount')?.textContent), 0);
    expect(declared).toBe(subtotal);
    return declared;
  });
  expect(values.reduce((a,b) => a+b,0)).toBe(19.5);
  expect(amounts).toHaveLength(1);
});
it('no trunca cantidades fraccionarias de bolsas en las rutas UBL históricas', async () => {
  const { calcularIcbper, lineaBolsaIcBper } = await import('../../../src/modules/invoices/ublIcbperLine');
  expect(() => calcularIcbper(1.5)).toThrow(/entera/);
  expect(() => lineaBolsaIcBper(1, { cantidad: 1.5 })).toThrow(/entera/);
});
it('métricas consulta el tenant y conserva la liquidación decimal de grupos', async () => {
  const { InvoiceMetricsService } = await import('../../../src/modules/invoices/application/services/invoiceMetricsService');
  const groupBy = jest.fn().mockResolvedValue([{ tipo_comprobante: '01', estado: 'ACEPTADO', _sum: { monto_total: 10.05 }, _count: { _all: 3 } }]);
  const service = new InvoiceMetricsService({ invoice: { groupBy } } as never);
  const r = await service.metricas('empresa', '2026-11');
  expect(r.facturado).toBe(10.05);
  expect(r.aceptados).toBe(3);
  expect(groupBy).toHaveBeenCalledWith(expect.objectContaining({ where: { company_id: 'empresa', fecha_emision: { gte: new Date('2026-11-01T00:00:00Z'), lt: new Date('2026-12-01T00:00:00Z') } } }));
  expect((await service.metricas('empresa')).periodo).toMatch(/^\d{4}-\d{2}$/);
});
