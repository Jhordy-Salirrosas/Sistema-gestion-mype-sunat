import { UblGeneratorService, type InvoicePayload } from '../../../src/modules/invoices/ublGeneratorService';
import { aCdr, condicionesDePago } from '../../../src/modules/invoices/application/services/invoiceQueryMapper';
import { bloqueEmisor } from '../../../src/modules/invoices/xmlPartiesHelper';

function payload(): InvoicePayload {
  return { rucEmisor: '20000000001', razonSocialEmisor: 'EMISOR DE PRUEBA', tipoComprobante: '01', serie: 'F099', numero: 70,
    fechaEmision: '2026-11-08', tipoMoneda: 'PEN', tipoOperacion: '0101', formaPago: 'Contado', montoGravado: 100, montoIgv: 18, montoTotal: 118,
    lineas: [{ id: 1, descripcion: 'Producto registrado', unidad: 'NIU', cantidad: 1, valorUnitario: 100, precioUnitario: 118, afectacion: '10', igvLinea: 18, totalLinea: 118 }] };
}
const generator = new UblGeneratorService();
it.each(['rucEmisor', 'razonSocialEmisor', 'tipoComprobante', 'serie', 'fechaEmision', 'tipoMoneda', 'tipoOperacion', 'formaPago'] as const)('no sintetiza %s ausente', (campo) => {
 const p = payload(); delete (p as any)[campo];
 expect(() => generator.generateInvoiceXml(p)).toThrow(/ausente/);
});
it.each([undefined, 0, -1, 1.5, NaN])('rechaza correlativo %s en vez de sustituir 1', (numero) => {
 expect(() => generator.generateInvoiceXml({ ...payload(), numero: numero! })).toThrow(/Correlativo/);
});
it('sin líneas no produce Servicio prestado', () => {
 const p = payload(); delete p.lineas;
 expect(() => generator.generateInvoiceXml(p)).toThrow(/líneas reales/);
});
it('solo emite IssueTime cuando la hora consta', () => {
 expect(generator.generateInvoiceXml(payload())).not.toContain('IssueTime');
 expect(generator.generateInvoiceXml({ ...payload(), horaEmision: '15:17:00' })).toContain('<cbc:IssueTime>15:17:00</cbc:IssueTime>');
});
it('no presume ubigeo ni establecimiento y preserva los datos explícitos', () => {
 const sin = bloqueEmisor({ ruc: '20000000001', razonSocial: 'EMISOR' });
 expect(sin).not.toContain('150101'); expect(sin).not.toContain('AddressTypeCode');
 const con = bloqueEmisor({ ruc: '20000000001', razonSocial: 'EMISOR', ubigeo: '130101', codigoLocalAnexo: '0002', direccion: 'Dirección registrada' });
 expect(con).toContain('>130101</cbc:ID>'); expect(con).toContain('>0002</cbc:AddressTypeCode>');
});
it.each(['documentoAfectado', 'codigoMotivoNota', 'descripcionMotivoNota'] as const)('una nota requiere %s real', (campo) => {
 const p = { ...payload(), tipoComprobante: '07', serie: 'FC01', documentoAfectado: 'F099-70', codigoMotivoNota: '01', descripcionMotivoNota: 'Anulación registrada' };
 delete (p as any)[campo]; expect(() => generator.generateInvoiceXml(p)).toThrow(/motivo/);
});
it('no crea textos de observaciones ni cuotas al leer JSON incompleto', () => {
 expect(aCdr({ observaciones: [{}] })?.observaciones).toEqual([{ codigo: null, texto: null }]);
 expect(condicionesDePago({ formaPago: 'Credito', cuotas: [{ numero: '', monto: Infinity, vencimiento: 1 }, null] }).cuotas).toEqual([{ numero: null, monto: null, vencimiento: null }]);
});
it('conserva establecimiento conocido aun cuando no consta una dirección y no inventa ubigeo si falta', () => {
 expect(bloqueEmisor({ ruc: '20000000001', razonSocial: 'EMISOR', ubigeo: '130101', codigoLocalAnexo: '0002' })).toContain('>0002</cbc:AddressTypeCode>');
 const xml = bloqueEmisor({ ruc: '20000000001', razonSocial: 'EMISOR', direccion: 'Dirección registrada' });
 expect(xml).not.toContain('150101');
});
