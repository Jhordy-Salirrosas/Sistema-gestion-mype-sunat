import { SummaryGate } from '../../../src/modules/invoices/application/services/summaryGate';
import { construirComunicacionBaja } from '../../../src/modules/invoices/application/services/summaryDocumentsBuilder';
import { ejecutarSfs } from '../../../src/modules/invoices/application/services/sunatSfsRunner';
import { SignatureService } from '../../../src/modules/sunat/signature.service';
import { fakeIssuerCertificate } from '../../fixtures/fakeIssuerCertificate';
const header = { rucEmisor: '20000000001', razonSocialEmisor: 'Obviously Fake Issuer', correlativo: 1, fechaResumen: '2026-11-09', fechaGeneracion: '2026-11-09' };
const invoice = { tipoComprobante: '01', serie: 'F001', correlativo: 1, fechaEmision: '2026-11-09', estado: 'ACEPTADO', total: 118, igv: 18, tipoDocCliente: '6', numDocCliente: '20100070970', motivoBaja: 'Anulación de la operación' };
it('RA firmado generado pasa XSD y hoja oficial SFS locales', async () => {
  const fake = fakeIssuerCertificate();
  const xml = new SignatureService({ getCertificate: () => ({ certificatePem: fake.pem, privateKeyPem: fake.privateKeyPem }) } as never).signXml(construirComunicacionBaja(header, [invoice])).signedXml;
  expect(await ejecutarSfs(xml, 'RA')).toEqual({ completado: true, errores: [] });
});
it('RA conserva secuencia, ordinales y motivos por miembro', () => {
  const xml = construirComunicacionBaja(header, [invoice, { ...invoice, correlativo: 2, motivoBaja: 'Error & corrección' }]);
  expect(xml.match(/<sac:VoidedDocumentsLine>[\s\S]*?<\/sac:VoidedDocumentsLine>/g)).toMatchSnapshot();
});

it.each([
  ['MOCK', 'https://e-beta.sunat.gob.pe/billService'],
  ['BETA', 'http://127.0.0.1/billService'],
  [null, 'https://e-beta.sunat.gob.pe/billService'],
])('compuerta rechaza entorno/destino incoherentes %s', async (environment, endpoint) => {
  await expect(new SummaryGate().validar('<VoidedDocuments/>', 'RA', { environment, endpoint } as never, 'RA-20261109-001')).rejects.toThrow('SUMMARY_ENDPOINT_ENV_MISMATCH');
});
