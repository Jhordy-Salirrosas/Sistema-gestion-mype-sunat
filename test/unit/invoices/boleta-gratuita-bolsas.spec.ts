import { bloqueLinea } from '../../../src/modules/invoices/xmlNodesHelper';
import { createHash } from 'node:crypto';
import { UblGeneratorService } from '../../../src/modules/invoices/ublGeneratorService';
import { InvoiceJobConsumer } from '../../../src/modules/invoices/invoiceJobConsumer';
import { XsdValidatorService } from '../../../src/modules/invoices/xsdValidatorService';
import { InvoiceDownloadService } from '../../../src/modules/invoices/application/services/invoiceDownloadService';
import { traducirEmision } from '../../../src/modules/invoices/application/services/emitirComprobanteAdapter';
import { SignatureService } from '../../../src/modules/sunat/signature.service';
import { ejecutarSfs } from '../../../src/modules/invoices/application/services/sunatSfsRunner';
import { fakeIssuerCertificate } from '../../fixtures/fakeIssuerCertificate';
import { issuer8d, fiscal8d } from '../../fixtures/8dFiscalHarness';
import { referenciaGratuita, totalesGratuitos } from '../../../src/modules/invoices/freeOperationReference';
import { separarBolsasGratuitas } from '../../../src/modules/invoices/freeBagXml';
import hashes from '../../fixtures/boleta-gratuita-regression-hashes.json';
const generator = new UblGeneratorService();
const cert = fakeIssuerCertificate();
const signature = new SignatureService({ getCertificate: () => ({ certificatePem: cert.pem, privateKeyPem: cert.privateKeyPem }) } as never);
function workerXml(payload: object): string {
  const worker = Object.create(InvoiceJobConsumer.prototype);
  worker.ublGenerator = generator; worker.xsdValidator = new XsdValidatorService();
  return worker.xmlDelComprobante({ id: 'boleta-local', payload_ubl: payload });
}
it.each([
  ['31', [1], [1]], ['31', [2], [1]], ['32', [1], [1]], ['32', [2], [1]],
  ['31', [3,4], [1,2]], ['32', [2,3], [0,1]], ['11', [2], [1]],
] as const)('boleta gratuita %s cantidades %j bolsas %j: worker, descarga y hojas oficiales', async (aff, cantidades, bolsas) => {
  const dto = { tipo_comprobante:'03', serie:'B001', fecha_emision:'2026-11-13', forma_pago:'Contado',
    customer_identity_type:'1', customer_identity_number:'12345678', customer_legal_name:'Cliente ficticio',
    items:cantidades.map((cantidad,i)=>({codigo:`MAT-${i}`,descripcion:'Bien gratuito',unidad:'NIU',cantidad,
      valorUnitario:35,precioUnitario:0,afectacion:aff,cantidadBolsas:bolsas[i],icbper:bolsas[i]*.5})) };
  const { dto: translated } = traducirEmision(dto as never, issuer8d, 1);
  const payload = translated.payload_ubl as never; const before = JSON.stringify(payload);
  const xml = workerXml(payload); const expanded = separarBolsasGratuitas(payload).lineas!;
  const count = cantidades.reduce((s,q,i)=>s+(bolsas[i]>0 && bolsas[i]<q ? 2:1),0);
  expect(xml.match(/<cac:InvoiceLine>/g)).toHaveLength(count);
  expect(expanded.map(referenciaGratuita).reduce((s,v)=>s+v.base,0)).toBe(totalesGratuitos((payload as any).lineas).gratuito);
  expect(xml).toContain(`<cbc:PayableAmount currencyID="PEN">${(bolsas.reduce((s,v)=>s+v,0)*.5).toFixed(2)}</cbc:PayableAmount>`);
  expect(xml).toContain(`<cbc:TaxInclusiveAmount currencyID="PEN">${(bolsas.reduce((s,v)=>s+v,0)*.5).toFixed(2)}</cbc:TaxInclusiveAmount>`);
  expect(xml.match(/<cbc:ID>7152<\/cbc:ID>/g)).toHaveLength(1+bolsas.filter(b=>b>0).length);
  expect(xml).toContain('<cbc:Note languageLocaleID="1002">TRANSFERENCIA GRATUITA');
  expect(xml).toContain('<cbc:PerUnitAmount currencyID="PEN">0.50</cbc:PerUnitAmount>');
  expect(await ejecutarSfs(signature.signXml(xml).signedXml,'03')).toEqual({ completado:true, errores:[] });
  const download = Object.create(InvoiceDownloadService.prototype);
  download.ublGenerator=generator; download.signature=signature; download.logger={warn:jest.fn()};
  expect(download.regenerarXmlFirmado({id:'boleta-local',serie:'B001',correlativo:1,payload_ubl:payload})).toBe(signature.signXml(xml).signedXml);
  expect(JSON.stringify(payload)).toBe(before);
});
it.each(hashes)('boleta previa $aff bolsas $bags mixta $mixed conserva hash', ({ aff,bags,mixed,sha256 })=>{
  const payload=fiscal8d(aff,bags,'03',mixed).payload;
  expect(createHash('sha256').update(workerXml(payload)).digest('hex')).toBe(sha256);
});
it('la hoja 3236 sigue rechazando cantidad distinta cuando se elimina la partición',async()=>{
  const payload=fiscal8d('31',1,'03').payload;
  const xml=workerXml(payload).replace('<cbc:InvoicedQuantity unitCode="NIU">1</cbc:InvoicedQuantity>','<cbc:InvoicedQuantity unitCode="NIU">2</cbc:InvoicedQuantity>');
  expect((await ejecutarSfs(signature.signXml(xml).signedXml,'03')).errores.map(e=>e.codigo)).toContain('3236');
});

it('el contrato anterior de bloqueLinea conserva la ubicación certificada de factura',()=>{
 const linea=fiscal8d('10',2).payload.lineas![0];
 const xml=bloqueLinea(linea,'PEN');
 expect(xml).toContain('<cbc:BaseUnitMeasure unitCode="NIU">2</cbc:BaseUnitMeasure>\n        <cbc:PerUnitAmount');
 expect(workerXml(fiscal8d('10',2).payload)).toContain(xml);
});
it('la hoja oficial exige BaseUnitMeasure también en boleta gratuita (3237)',async()=>{
 const xml=workerXml(fiscal8d('31',1,'03').payload).replace('<cbc:BaseUnitMeasure unitCode="NIU">1</cbc:BaseUnitMeasure>','');
 expect((await ejecutarSfs(signature.signXml(xml).signedXml,'03')).errores.map(e=>e.codigo)).toContain('3237');
});
