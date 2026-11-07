import 'reflect-metadata';
import { readFileSync } from 'node:fs';
import { validateSync } from 'class-validator';
import { EmitirComprobanteDto } from '../../../src/modules/invoices/application/dto/emitirComprobanteDto';
import { traducirEmision } from '../../../src/modules/invoices/application/services/emitirComprobanteAdapter';
import { CreateInvoiceUseCase } from '../../../src/modules/invoices/application/use-cases/createInvoiceUseCase';
import { CATALOGO_59_MEDIOS_PAGO } from '../../../src/modules/invoices/domain/rules/medioPagoDetraccion';
import { UblGeneratorService } from '../../../src/modules/invoices/ublGeneratorService';
import { emisorMedioPago, formularioMedioPago, payloadMedioPago } from './ta63MedioPagoFixtures';

const generador = new UblGeneratorService();
const invalidos: unknown[] = ['1001', '014', '000', 'DEPÓSITO EN CUENTA', '', ' 001', '001 ', 1, null, {}, 'toString'];

describe('TA-63 · contrato opcional del Catálogo 59', () => {
  it('conserva las 22 entradas completas y sus descripciones documentadas', () => {
    const documento = readFileSync('specs/M1-TA63-CATALOGO59-CONTRATO.md', 'utf8');
    expect(Object.keys(CATALOGO_59_MEDIOS_PAGO).sort()).toEqual([
      '001', '002', '003', '004', '005', '006', '007', '008', '009', '010', '011', '012', '013',
      '101', '102', '103', '104', '105', '106', '107', '108', '999',
    ]);
    for (const [codigo, descripcion] of Object.entries(CATALOGO_59_MEDIOS_PAGO)) {
      expect(documento).toContain(`| \`${codigo}\` | ${descripcion} |`);
    }
  });

  it.each(Object.keys(CATALOGO_59_MEDIOS_PAGO))('lleva %s del formulario hasta el XML', (codigo) => {
    const dto = Object.assign(new EmitirComprobanteDto(), formularioMedioPago(), { medio_pago_detraccion: codigo });
    expect(validateSync(dto).filter((e) => e.property === 'medio_pago_detraccion')).toEqual([]);
    const traducido = traducirEmision(dto, emisorMedioPago, 1);
    const payload = JSON.parse(JSON.stringify(traducido.dto.payload_ubl));
    expect(payload.medioPagoDetraccion).toBe(codigo);
    const xml = generador.generateInvoiceXml(payload);
    expect(xml).toContain(`<cbc:PaymentMeansCode>${codigo}</cbc:PaymentMeansCode>`);
    expect(xml).toContain('<cbc:ID>Detraccion</cbc:ID>');
    expect(xml).toContain('<cbc:ID>00019123456</cbc:ID>');
    expect(xml.indexOf('<cac:PaymentMeans>')).toBeLessThan(xml.indexOf('<cac:PaymentTerms>'));
  });

  it('ausencia conserva 999 y no agrega un medio al JSON histórico', () => {
    const payload = JSON.parse(JSON.stringify(payloadMedioPago()));
    expect(payload).not.toHaveProperty('medioPagoDetraccion');
    expect(generador.generateInvoiceXml(payload)).toContain('<cbc:PaymentMeansCode>999</cbc:PaymentMeansCode>');
  });

  it.each(invalidos)('rechaza medio inválido %j en DTO, adaptador y payload directo', (valor) => {
    const dto = Object.assign(new EmitirComprobanteDto(), formularioMedioPago(), { medio_pago_detraccion: valor });
    expect(validateSync(dto).some((e) => e.property === 'medio_pago_detraccion')).toBe(true);
    expect(() => traducirEmision(dto, emisorMedioPago, 1)).toThrow(/Catálogo 59/);
    const payload = Object.assign(payloadMedioPago(), { medioPagoDetraccion: valor });
    expect(() => generador.generateInvoiceXml(payload)).toThrow(/Catálogo 59/);
  });

  it.each([100, 1000])('rechaza selección sin detracción efectiva, total base %s', (valorUnitario) => {
    const dto = formularioMedioPago();
    dto.medio_pago_detraccion = '001';
    dto.items[0].valorUnitario = valorUnitario;
    if (valorUnitario === 1000) delete dto.items[0].codigoDetraccion;
    expect(() => traducirEmision(dto, emisorMedioPago, 1)).toThrow(/sin detracción efectiva/);
  });

  it.each([
    { tipoOperacion: '0101' }, { montoDetraccion: 0 },
  ])('rechaza payload inconsistente con selección: %j', (cambio) => {
    expect(() => generador.generateInvoiceXml({ ...payloadMedioPago(), ...cambio, medioPagoDetraccion: '001' }))
      .toThrow(/sin detracción efectiva/);
  });

  it('conserva contado, crédito, neto y cuotas al cambiar solo el medio', () => {
    const payload = payloadMedioPago();
    for (const formaPago of ['Contado', 'Credito'] as const) {
      const base = { ...payload, formaPago, cuotas: formaPago === 'Credito'
        ? [{ numero: 'Cuota001', monto: 1038.4, vencimiento: '2026-12-01' }] : [] };
      const previo = generador.generateInvoiceXml(base);
      const seleccionado = generador.generateInvoiceXml({ ...base, medioPagoDetraccion: '001' });
      expect(seleccionado).toBe(previo.replace('<cbc:PaymentMeansCode>999', '<cbc:PaymentMeansCode>001'));
    }
  });

  it('sin detracción ni selección conserva el XML sin PaymentMeans', () => {
    const dto = formularioMedioPago();
    delete dto.items[0].codigoDetraccion;
    const payload = traducirEmision(dto, emisorMedioPago, 1).dto.payload_ubl;
    expect(generador.generateInvoiceXml(payload as unknown as ReturnType<typeof payloadMedioPago>))
      .not.toContain('<cac:PaymentMeans>');
  });

  it.each(['1001', '014', null, '001'])('alta directa rechaza %j antes de reservar y persistir', async (medio) => {
    const repo = { saveWithTransactionalOutbox: jest.fn() };
    const series = { reservarCorrelativo: jest.fn() };
    const caso = new CreateInvoiceUseCase(repo, series as never);
    const payload = { ...payloadMedioPago(), medioPagoDetraccion: medio,
      ...(medio === '001' ? { montoDetraccion: 0 } : {}) };
    const dto = { ...traducirEmision(formularioMedioPago(), emisorMedioPago, 1).dto, payload_ubl: payload };
    await expect(caso.execute(dto, 'empresa')).rejects.toThrow(/Catálogo 59|sin detracción efectiva/);
    expect(series.reservarCorrelativo).not.toHaveBeenCalled();
    expect(repo.saveWithTransactionalOutbox).not.toHaveBeenCalled();
  });
});
