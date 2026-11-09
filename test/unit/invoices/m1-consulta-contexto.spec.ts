import AdmZip from 'adm-zip';
import { Logger } from '@nestjs/common';
import { IssuerConfigEncryption } from '../../../src/modules/sunat/issuerConfigEncryption';
import { IssuerConfigResolver } from '../../../src/modules/sunat/issuerConfigResolver';
import { SunatStatusConsultaService } from '../../../src/modules/sunat/statusConsultaService';
import { InvoiceSunatConsultController } from '../../../src/modules/invoices/infrastructure/controllers/invoiceSunatConsultController';

const previous = { ...process.env };
beforeEach(() => {
  process.env.SUNAT_ENV = 'produccion'; delete process.env.SUNAT_BILL_SERVICE_URL; delete process.env.SUNAT_CONSULT_SERVICE_URL;
  process.env.SUNAT_SOL_USER = 'FAKE_ENV_USER'; process.env.SUNAT_SOL_PASSWORD = 'fake-env-password';
  process.env.CERT_BASE64 = 'fake-env-certificate'; process.env.CERT_PASSWORD = 'fake-cert-password';
});
afterEach(() => { process.env = { ...previous }; jest.restoreAllMocks(); });
function harness() {
  const company = { id: 'empresa', ruc: '20614142503', issuer_config_activated_at: null as Date | null,
    issuer_config_version: null, issuer_environment: null, issuer_sol_configured: true,
    sol_user: 'FAKE_LEGACY_USER', sol_pass_encrypted: 'fake-legacy-plaintext', cert_storage_url: null, cert_pass_encrypted: null };
  const invoice = { id: 'factura', company_id: company.id, ruc_emisor: company.ruc, tipo_comprobante: '01', serie: 'F001', correlativo: 60, estado: 'ENVIADO' };
  const db = { company: { findUnique: jest.fn(async () => company) }, issuerCertificate: { findFirst: jest.fn() },
    invoice: { findFirst: jest.fn(async () => invoice), findUnique: jest.fn(async () => invoice) }, auditLog: { create: jest.fn(async () => ({})) } };
  const encryption = new IssuerConfigEncryption(); const decrypt = jest.spyOn(encryption, 'decrypt');
  const resolver = new IssuerConfigResolver(db as never, encryption);
  const soap = { getStatusCdr: jest.fn(async () => ({ responseCode: '0127', applicationResponse: null as string | null, tiempoRespuestaMs: 10 })) };
  const persistence = { persist: jest.fn(async () => undefined) };
  const service = new SunatStatusConsultaService(persistence as never, db as never, soap as never, resolver);
  const controller = new InvoiceSunatConsultController(db as never, service);
  return { company, invoice, db, decrypt, resolver, soap, persistence, service, controller };
}
it('empresa no activada con legado plano usa respaldo sin descifrar ni inspeccionar certificado', async () => {
  const h = harness();
  expect(await h.controller.consultar('empresa', 'factura')).toEqual({ tipo: 'NO_ENCONTRADO' });
  expect(h.decrypt).not.toHaveBeenCalled(); expect(h.db.issuerCertificate.findFirst).not.toHaveBeenCalled();
  expect(h.soap.getStatusCdr).toHaveBeenCalledWith(expect.objectContaining({ credentials: { username: '20614142503FAKE_ENV_USER', password: 'fake-env-password' } }), expect.anything());
});
it('RUC de factura distinto al contexto queda controlado sin llegar al SOAP', async () => {
  const h = harness(); h.invoice.ruc_emisor = '20601234567';
  const result = await h.controller.consultar('empresa', 'factura');
  expect(result).toMatchObject({ tipo: 'INCIERTO', motivo: expect.stringContaining('ISSUER_IDENTITY_MISMATCH') });
  expect(result).toMatchObject({ motivo: expect.stringContaining('RUC del comprobante 20601234567; RUC de la empresa 20614142503') });
  expect(h.soap.getStatusCdr).not.toHaveBeenCalled();
});
it('configuración activada con legado indescifrable queda controlada y registra excepción', async () => {
  const h = harness(); h.company.issuer_config_activated_at = new Date();
  const log = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  expect(await h.controller.consultar('empresa', 'factura')).toMatchObject({ tipo: 'INCIERTO', motivo: expect.stringContaining('ISSUER_CONFIG_DECRYPTION_FAILED') });
  expect(h.soap.getStatusCdr).not.toHaveBeenCalled();
  expect(log).toHaveBeenCalledWith(expect.stringContaining('BadRequestException: ISSUER_CONFIG_DECRYPTION_FAILED'));
});
it('fallo de carga de comprobante devuelve INCIERTO útil y log sanitizado', async () => {
  const h = harness(); const log = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  h.db.invoice.findFirst.mockRejectedValue(new Error('database unavailable password=fake-env-password'));
  await expect(h.controller.consultar('empresa', 'factura')).resolves.toMatchObject({ tipo: 'INCIERTO', motivo: expect.stringContaining('No se pudo preparar la consulta SUNAT') });
  expect(log).toHaveBeenCalledWith(expect.stringContaining('Error: database unavailable'));
  expect(JSON.stringify(log.mock.calls)).not.toContain('fake-env-password'); expect(h.soap.getStatusCdr).not.toHaveBeenCalled();
});
it('recupera CDR feliz con resolver real, respaldo y cliente SOAP simulado', async () => {
  const h = harness(); const zip = new AdmZip();
  zip.addFile('R-fake.xml', Buffer.from('<ApplicationResponse xmlns="urn:oasis:names:specification:ubl:schema:xsd:ApplicationResponse-2" xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2" xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"><cac:DocumentResponse><cac:Response><cbc:ReferenceID>F001-60</cbc:ReferenceID><cbc:ResponseCode>0</cbc:ResponseCode><cbc:Description>Aceptado de prueba</cbc:Description></cac:Response></cac:DocumentResponse></ApplicationResponse>'));
  h.soap.getStatusCdr.mockResolvedValue({ responseCode: '0', applicationResponse: zip.toBuffer().toString('base64'), tiempoRespuestaMs: 10 });
  expect(await h.controller.consultar('empresa', 'factura')).toMatchObject({ tipo: 'RECUPERADO', estado: 'ACEPTADO', codigo: '0', mensaje: 'Aceptado de prueba' });
  expect(h.decrypt).not.toHaveBeenCalled(); expect(h.persistence.persist).toHaveBeenCalledTimes(1);
});

it('fallo real de carga del contexto se controla antes del transporte y deja nombre/mensaje', async () => {
  const h = harness(); const log = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  h.db.company.findUnique.mockRejectedValue(new Error('context storage unavailable'));
  expect(await h.controller.consultar('empresa', 'factura')).toMatchObject({ tipo: 'INCIERTO', motivo: expect.stringContaining('context storage unavailable') });
  expect(log).toHaveBeenCalledWith(expect.stringContaining('(contexto): Error: context storage unavailable'));
  expect(h.soap.getStatusCdr).not.toHaveBeenCalled(); expect(h.decrypt).not.toHaveBeenCalled();
});
it('el log y la respuesta omiten credenciales de empresa que no vienen del entorno', async () => {
  const h = harness(); const log = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  const context = await h.resolver.resolve('empresa');
  jest.spyOn(h.resolver, 'resolve').mockResolvedValue({ ...context, sol: { username: 'FAKE_COMPANY_USER', password: 'fake-company-password' } });
  h.soap.getStatusCdr.mockRejectedValue(new Error('SOAP failed FAKE_COMPANY_USER fake-company-password https://fake:secret@invalid.test/service'));
  const result = await h.controller.consultar('empresa', 'factura');
  expect(result).toMatchObject({ tipo: 'INCIERTO' });
  const output = JSON.stringify([result, log.mock.calls]);
  for (const secret of ['FAKE_COMPANY_USER', 'fake-company-password', 'fake:secret']) expect(output).not.toContain(secret);
  expect(output).toContain('Error: SOAP failed');
});
