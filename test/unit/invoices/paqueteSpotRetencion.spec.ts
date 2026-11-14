import { createHash } from 'node:crypto';
import hashes from '../../fixtures/m1-paquete-regimenes-hashes.json';
import { calcularTotales } from '../../../src/modules/invoices/ublTotalesHelper';
import { traducirEmision } from '../../../src/modules/invoices/application/services/emitirComprobanteAdapter';
import { UblGeneratorService, type InvoicePayload } from '../../../src/modules/invoices/ublGeneratorService';
import { issuer8d } from '../../fixtures/8dFiscalHarness';
const formulario = (agente = true, codigo?: string) => ({ tipo_comprobante: '01', serie: 'F001', fecha_emision: '2026-11-13', forma_pago: 'Contado', medio_pago_detraccion: codigo ? '003' : undefined, customer_identity_type: '6', customer_identity_number: '20100070970', customer_legal_name: 'Receptor ficticio', agente_retencion: agente, items: [{ descripcion: 'Servicio ficticio', unidad: 'NIU', cantidad: 1, valorUnitario: 1000, afectacion: '10', codigoDetraccion: codigo }] });
it('el servidor calcula retención cero si hay SPOT efectivo, incluso con indicador de maestro activo', () => {
  const r = traducirEmision(formulario(true, '012') as never, issuer8d, 1);
  expect(r.importes).toMatchObject({ total: 1180, detraccion: 141.6, retencion: 0, importePagar: 1038.4 });
  const payload = r.dto.payload_ubl as unknown as InvoicePayload;
  expect(payload.montoRetencion).toBeUndefined();
  const xml = new UblGeneratorService().generateInvoiceXml(payload);
  expect(xml).toContain('2006'); expect(xml).not.toContain('<cbc:ID>Retencion</cbc:ID>');
});
it('la ruta de payload fiscal también elimina la retención declarada junto al SPOT', () => {
  const base = { montoGravado: 1000, montoIgv: 180, montoTotal: 1180, codigoDetraccion: '012', montoRetencion: 35.4 };
  expect(calcularTotales(base)).toMatchObject({ detraccion: 141.6, retencion: 0, importePagar: 1038.4 });
  expect(calcularTotales({ ...base, montoDetraccion: 0 })).toMatchObject({ detraccion: 0, retencion: 35.4, importePagar: 1144.6 });
});
it.each([[false, '012', 141.6, 0, 1038.4], [true, undefined, 0, 35.4, 1144.6]] as const)('preserva el régimen único agente=%s código=%s', (agente, codigo, detraccion, retencion, importePagar) => {
  const r = traducirEmision(formulario(agente, codigo) as never, issuer8d, 1);
  expect(r.importes).toMatchObject({ total: 1180, detraccion, retencion, importePagar });
});

it.each(hashes)('régimen único agente=$agente conserva bytes del adaptador y XML de ddaec671', ({agente, sha256}) => {
 const r = traducirEmision(formulario(agente, agente ? undefined : '012') as never, issuer8d, 1);
 const xml = new UblGeneratorService().generateInvoiceXml(r.dto.payload_ubl as unknown as InvoicePayload);
 expect(createHash('sha256').update(JSON.stringify(r) + xml).digest('hex')).toBe(sha256);
});
