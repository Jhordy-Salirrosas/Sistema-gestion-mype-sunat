import { traducirEmision } from '../../../src/modules/invoices/application/services/emitirComprobanteAdapter';
import { calcularTotales } from '../../../src/modules/invoices/ublTotalesHelper';
import { UblGeneratorService, type InvoicePayload } from '../../../src/modules/invoices/ublGeneratorService';
import { InvoiceBridgeCoordinatorService } from '../../../src/modules/invoices/application/services/invoiceBridgeCoordinatorService';
import { issuer8d } from '../../fixtures/8dFiscalHarness';
const casos = [
  { nombre: 'exonerada', lineas: [['20', 1000]], total: 1000, retencion: 0 },
  { nombre: 'inafecta', lineas: [['30', 1500]], total: 1500, retencion: 0 },
  { nombre: 'exonerada e inafecta', lineas: [['20', 1000], ['30', 500]], total: 1500, retencion: 0 },
  { nombre: 'gratuita', lineas: [['31', 1000]], total: 0, retencion: 0 },
  { nombre: 'mixto conserva cálculo del paquete', lineas: [['10', 1000], ['20', 500]], total: 1680, retencion: 50.4 },
  { nombre: 'gravada pura conserva cálculo del paquete', lineas: [['10', 1000]], total: 1180, retencion: 35.4 },
];
const bridge = Object.create(InvoiceBridgeCoordinatorService.prototype) as InvoiceBridgeCoordinatorService;
it.each(casos)('$nombre: emisión, UBL y puente conservan los importes esperados', ({ lineas, total, retencion }) => {
  const r = traducirEmision({ tipo_comprobante: '01', serie: 'F001', fecha_emision: '2026-11-13', forma_pago: 'Contado', customer_identity_type: '6', customer_identity_number: '20100070970', customer_legal_name: 'Receptor ficticio', agente_retencion: true,
    items: lineas.map(([afectacion, valorUnitario]) => ({ descripcion: 'Bien ficticio', cantidad: 1, unidad: 'NIU', afectacion, valorUnitario })) } as never, issuer8d, 1);
  expect(r.importes).toMatchObject({ total, retencion, importePagar: total - retencion });
  const payload = r.dto.payload_ubl as unknown as InvoicePayload;
  // Una retención entrante positiva no debe sobrevivir si no hay operación gravada.
  const declarado = { ...payload, montoRetencion: retencion || 45 };
  const totales = calcularTotales(declarado);
  expect(totales).toMatchObject({ total, retencion, importePagar: total - retencion });
  expect(bridge.liquidarParaPuente([], declarado).retencion).toBe(retencion);
  const xml = new UblGeneratorService().generateInvoiceXml(declarado);
  if (retencion === 0) expect(xml).not.toContain('<cbc:ID>Retencion</cbc:ID>');
  else expect(xml).toContain(`<cbc:Amount currencyID="PEN">${retencion.toFixed(2)}</cbc:Amount>`);
});
it('totales sin detalle respetan la base gravada explícita cero', () => {
  expect(calcularTotales({ montoGravado: 0, montoIgv: 0, montoTotal: 1500, montoRetencion: 45 })).toMatchObject({ retencion: 0, importePagar: 1500 });
});
it.each(['20', '30', '31'])('el camino legado del puente sin desglose tributario excluye retención en %s', afectacion => {
  expect(bridge.liquidarParaPuente([{ quantity: 1, unit_value: 1500, igv_affectation_type: afectacion }], { montoRetencion: 45 } as InvoicePayload).retencion).toBe(0);
});
it('gratuita con ICBPER superior al umbral no genera retención', () => {
  const r = traducirEmision({ tipo_comprobante: '03', serie: 'B001', fecha_emision: '2026-11-13', forma_pago: 'Contado', customer_identity_type: '6', customer_identity_number: '20100070970', customer_legal_name: 'Receptor ficticio', agente_retencion: true,
    items: [{ descripcion: 'Bien gratuito ficticio', cantidad: 2000, unidad: 'NIU', afectacion: '31', valorUnitario: 1, precioUnitario: 0, cantidadBolsas: 2000, icbper: 1000 }] } as never, issuer8d, 1);
  expect(r.importes).toMatchObject({ gravado: 0, total: 1000, retencion: 0, importePagar: 1000 });
});
