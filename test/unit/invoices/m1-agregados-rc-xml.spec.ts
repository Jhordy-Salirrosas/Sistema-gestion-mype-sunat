import { construirResumenDiario } from '../../../src/modules/invoices/application/services/summaryDocumentsBuilder';
import { fiscalResumen } from '../../../src/modules/invoices/application/services/summaryFiscal';
import { ejecutarSfs } from '../../../src/modules/invoices/application/services/sunatSfsRunner';
import { SignatureService } from '../../../src/modules/sunat/signature.service';
import { fakeIssuerCertificate } from '../../fixtures/fakeIssuerCertificate';
const header = { rucEmisor: '20000000001', razonSocialEmisor: 'Obviously Fake Issuer', correlativo: 1, fechaResumen: '2026-11-09', fechaGeneracion: '2026-11-09' };
const line = (afectacion: string, totalLinea = 118, igvLinea = 18) => ({ id: 1, descripcion: 'Producto', afectacion, totalLinea, igvLinea, cantidad: 1, valorUnitario: 100 });
const doc = (lines = [line('10')], total = 118) => ({ tipoComprobante: '03', serie: 'B001', correlativo: 1, fechaEmision: header.fechaResumen, estado: 'PENDIENTE', total, igv: 18, tipoDocCliente: '6', numDocCliente: '20100070970', fiscal: fiscalResumen({ lineas: lines }, total) });
function signed(xml: string) { const f = fakeIssuerCertificate(); return new SignatureService({ getCertificate: () => ({ certificatePem: f.pem, privateKeyPem: f.privateKeyPem }) } as never).signXml(xml).signedXml; }
it.each([
  ['gravado', () => doc()],
  ['mixto', () => doc([line('10'),line('20',100,0),line('30',100,0),line('40',100,0)],418)],
  ['exonerado', () => doc([line('20',100,0)],100)],
  ['inafecto', () => doc([line('30',100,0)],100)],
  ['exportación', () => doc([line('40',100,0)],100)],
  ['gratuito', () => doc([line('11',0,0)],0)],
  ['ICBPER', () => doc([{ ...line('10'), icbperLinea: .5 }],118.5)],
])('RC firmado %s pasa XSD y XSL oficiales locales', async (_name, make) => {
  const xml = signed(construirResumenDiario(header,[make()]));
  expect(await ejecutarSfs(xml, 'RC')).toEqual({ completado: true, errores: [] });
});
it.each(['07','08'])('RC y nota %s conservan orden, Catálogo 11 y referencia real', async tipoComprobante => {
  const note = { ...doc(), tipoComprobante, serie: tipoComprobante === '07' ? 'BC01' : 'BD01', documentoAfectado: 'B001-1' };
  const xml = construirResumenDiario(header,[doc(),note]);
  expect(xml.match(/<sac:SummaryDocumentsLine>[\s\S]*?<\/sac:SummaryDocumentsLine>/g)).toMatchSnapshot();
  expect(await ejecutarSfs(signed(xml), 'RC')).toEqual({ completado: true, errores: [] });
});
it('no infiere afectación ni inventa referencias o importes', () => {
  expect(() => fiscalResumen({},118)).toThrow('detalle fiscal');
  expect(() => fiscalResumen({ lineas: [line('XX')] },118)).toThrow('afectación');
  expect(() => fiscalResumen({ lineas: [line('10')] },119)).toThrow('no concuerda');
  expect(() => construirResumenDiario(header,[{...doc(),tipoComprobante:'07',serie:'BC01'}])).toThrow('referencia real');
});
it('RC conserva descuento global fiscal 02 y descuento no afecto 03', async () => {
  for (const codigo of ['02','03']) {
    const total = codigo === '02' ? 106.2 : 108;
    const d = { ...doc(), total, fiscal: fiscalResumen({ lineas:[line('10')], descuentoGlobal:{ codigo, monto:10 } },total) };
    expect(await ejecutarSfs(signed(construirResumenDiario(header,[d])), 'RC')).toEqual({completado:true,errores:[]});
  }
});

it('RC conserva descuento de línea no afecto sin declararlo como cargo', async () => {
  const l={...line('10'),descuentos:[{codigo:'01',monto:10}]};
  const d={...doc(),total:108,fiscal:fiscalResumen({lineas:[l]},108)};
  const xml=construirResumenDiario(header,[d]); expect(xml).not.toContain('AllowanceCharge');
  expect(await ejecutarSfs(signed(xml),'RC')).toEqual({completado:true,errores:[]});
});
