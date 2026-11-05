import { traducirEmision } from '../../../src/modules/invoices/application/services/emitirComprobanteAdapter';
import { UblGeneratorService } from '../../../src/modules/invoices/ublGeneratorService';
import type { EmitirComprobanteDto } from '../../../src/modules/invoices/application/dto/emitirComprobanteDto';

const emisor = { ruc: '20100070970', razonSocial: 'PRUEBA' };
const dto = (codigo: '00' | '01'): EmitirComprobanteDto => ({
  tipo_comprobante: '01', serie: 'F001', customer_legal_name: 'PRUEBA',
  items: [{ descripcion: 'Servicio', cantidad: 1, valorUnitario: 100, afectacion: '10', descuento: { codigo, monto: 10 } }],
});

describe('descuentos de línea', () => {
  it.each([['00', 90, 16.2, 106.2], ['01', 100, 18, 108]] as const)('código %s calcula base, IGV, total y XML', (codigo, base, igv, total) => {
    const resultado = traducirEmision(dto(codigo), emisor, 1);
    expect(resultado.importes.gravado).toBe(base);
    expect(resultado.importes.igv).toBe(igv);
    expect(resultado.importes.total).toBe(total);
    const xml = new UblGeneratorService().generateInvoiceXml(resultado.dto.payload_ubl as never);
    expect(xml).toContain(`<cbc:AllowanceChargeReasonCode>${codigo}</cbc:AllowanceChargeReasonCode>`);
    expect(xml).toContain(`<cbc:LineExtensionAmount currencyID="PEN">${base.toFixed(2)}</cbc:LineExtensionAmount>`);
    expect(xml).toContain(`<cbc:PayableAmount currencyID="PEN">${total.toFixed(2)}</cbc:PayableAmount>`);
  });
  it('rechaza un descuento mayor al valor', () => {
    const datos = dto('00');
    datos.items[0].descuento!.monto = 101;
    expect(() => traducirEmision(datos, emisor, 1)).toThrow(/Descuento inválido/);
  });
});
