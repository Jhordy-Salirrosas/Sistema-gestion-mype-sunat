import { traducirEmision } from '../../../src/modules/invoices/application/services/emitirComprobanteAdapter';
import { UblGeneratorService } from '../../../src/modules/invoices/ublGeneratorService';
import type { EmitirComprobanteDto } from '../../../src/modules/invoices/application/dto/emitirComprobanteDto';

const emisor = { ruc: '20100070970', razonSocial: 'PRUEBA' };
const dto = (codigo: '02' | '03'): EmitirComprobanteDto => ({
  tipo_comprobante: '01', serie: 'F001', customer_legal_name: 'PRUEBA',
  items: [{ descripcion: 'Servicio', cantidad: 1, valorUnitario: 1000, afectacion: '10' }],
  descuento_global: { codigo, monto: 100 },
});
describe('descuentos globales en emisión y UBL', () => {
  it.each([['02', 900, 162, 1062, 0], ['03', 1000, 180, 1080, 100]] as const)('integra código %s', (codigo, base, igv, total, otros) => {
    const r = traducirEmision(dto(codigo), emisor, 1);
    expect(r.importes).toMatchObject({ gravado: base, igv, total });
    const xml = new UblGeneratorService().generateInvoiceXml(r.dto.payload_ubl as never);
    expect(xml).toMatch(new RegExp(`<cbc:AllowanceChargeReasonCode[^>]*>${codigo}</cbc:AllowanceChargeReasonCode>`));
    expect(xml).toContain(`<cbc:AllowanceTotalAmount currencyID="PEN">${otros.toFixed(2)}</cbc:AllowanceTotalAmount>`);
    expect(xml).toContain(`<cbc:PayableAmount currencyID="PEN">${total.toFixed(2)}</cbc:PayableAmount>`);
    expect(xml.indexOf('<cac:AllowanceCharge>')).toBeLessThan(xml.indexOf('<cac:TaxTotal>'));
  });
  it('distribuye el descuento global entre líneas sujetas y no sujetas a detracción', () => {
    const datos = dto('02');
    datos.descuento_global!.monto = 200;
    datos.medio_pago_detraccion = '003';
    datos.items = [
      { descripcion: 'Flete', cantidad: 1, valorUnitario: 1000, afectacion: '10', codigoDetraccion: '012' },
      { descripcion: 'Mercadería', cantidad: 1, valorUnitario: 1000, afectacion: '10' },
    ];
    const r = traducirEmision(datos, emisor, 1);
    expect(r.importes.total).toBe(2124);
    expect(r.importes.detraccion).toBe(127.44);
  });
  it('conserva impuesto y total al combinar global 02, descuento 01 e ICBPER', () => {
    const datos = dto('02');
    datos.items[0].descuento = { codigo: '01', monto: 10 };
    datos.items[0].icbper = 0.5;
    datos.forma_pago = 'Credito';
    datos.fecha_emision = '2026-11-01';
    datos.cuotas = [{ monto: 1052.5, vencimiento: '2026-12-01' }];
    const r = traducirEmision(datos, emisor, 1);
    expect(r.importes.total).toBe(1052.5);
    const xml = new UblGeneratorService().generateInvoiceXml(r.dto.payload_ubl as never);
    expect(xml).toContain('<cbc:PayableAmount currencyID="PEN">1052.50</cbc:PayableAmount>');
  });
  it('no permite 04 ni global que exceda la base', () => {
    expect(() => traducirEmision({ ...dto('02'), descuento_global: { codigo: '04' as '02', monto: 1 } }, emisor, 1)).toThrow();
    expect(() => traducirEmision({ ...dto('02'), descuento_global: { codigo: '02', monto: 1001 } }, emisor, 1)).toThrow();
  });
});
