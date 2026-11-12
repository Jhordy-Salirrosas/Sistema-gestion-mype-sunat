import { validateSync } from 'class-validator';
import { issuerConfigHarness } from '../../fixtures/issuerConfigHarness';
import { fakeIssuerCertificate } from '../../fixtures/fakeIssuerCertificate';
import { fakeIssuerContext } from '../../fixtures/issuerContext';
import { resolveIssuerIdentity, issuerSolUsername } from '../../../src/modules/sunat/issuerIdentity';
import { SignatureService } from '../../../src/modules/sunat/signature.service';
import { CertificateService } from '../../../src/modules/sunat/certificate.service';
import { validateIssuerInput } from '../../../src/modules/invoices/application/services/issuerConfigWriter';
import { CreateInvoiceDto } from '../../../src/modules/invoices/application/dto/createInvoiceDto';
import { InvoiceConfigService } from '../../../src/modules/invoices/application/services/invoiceConfigService';

const PIN = '20601234567';
const COMPANY_RUC = '20614142503';
const originalEnvironment = { ...process.env };
let h: ReturnType<typeof issuerConfigHarness>;
beforeEach(() => {
  process.env.ISSUER_CONFIG_ENCRYPTION_KEY = Buffer.alloc(32, 19).toString('base64');
  process.env.SUNAT_SOL_USER = 'MODDATOS';
  process.env.SUNAT_SOL_PASSWORD = 'obviously-fake-sol';
  delete process.env.CERT_BASE64;
  delete process.env.CERT_PASSWORD;
  h = issuerConfigHarness();
  h.company.ruc = COMPANY_RUC;
});
afterEach(() => { process.env = { ...originalEnvironment }; jest.restoreAllMocks(); });

it.each([undefined, null])('sin pin %s conserva exactamente el RUC de empresa', issuer_ruc => {
  expect(resolveIssuerIdentity({ ruc: COMPANY_RUC, issuer_ruc })).toEqual({ ruc: COMPANY_RUC, origen: 'company' });
});
it('el pin acepta once dígitos sin exigir módulo 11 y no altera la empresa', () => {
  const company = { ruc: COMPANY_RUC, issuer_ruc: PIN };
  expect(resolveIssuerIdentity(company)).toEqual({ ruc: PIN, origen: 'issuer_config' });
  expect(company.ruc).toBe(COMPANY_RUC);
});
it.each(['', ' ', '123', '206012345678', 'abcdefghijk', '２０６０１２３４５６７'])('rechaza pin persistido inválido %j', issuer_ruc => {
  expect(() => resolveIssuerIdentity({ ruc: COMPANY_RUC, issuer_ruc })).toThrow('ISSUER_RUC_INVALID');
});
it.each(['', ' ', '123', '206012345678', 'abcdefghijk', 20601234567, false])('writer rechaza formato inválido %j antes de abrir transacción', async issuer_ruc => {
  await expect(h.writer.save(h.company.id, { issuer_ruc })).rejects.toThrow();
  expect(h.db.$transaction).not.toHaveBeenCalled();
});
it('el DTO fiscal acepta el emisor fijado sin modificar la validación de otros campos', () => {
  const input = Object.assign(new CreateInvoiceDto(), { ruc_emisor: PIN });
  expect(validateSync(input).filter(e => e.property === 'ruc_emisor')).toEqual([]);
  input.ruc_emisor = 'invalid';
  expect(validateSync(input).find(e => e.property === 'ruc_emisor')).toBeDefined();
  expect(validateIssuerInput({ issuer_ruc: PIN })).toEqual({ issuer_ruc: PIN });
});
it.each(['MODDATOS', `${PIN}MODDATOS`])('compone SOL del despliegue con pin para %s', async user => {
  Object.assign(h.company, { issuer_ruc: PIN }); process.env.SUNAT_SOL_USER = user;
  expect(await h.resolver.resolve(h.company.id)).toMatchObject({ ruc: PIN, rucSource: 'issuer_config', source: 'deployment', sol: { username: `${PIN}MODDATOS` } });
});
it.each(['MODDATOS', `${PIN}MODDATOS`])('compone SOL persistido con pin para %s', async user => {
  await h.writer.save(h.company.id, { issuer_ruc: PIN, sol_user: user, sol_password: 'fake-company-password' });
  process.env.SUNAT_SOL_USER = `${COMPANY_RUC}OTRO`;
  expect(await h.resolver.resolve(h.company.id)).toMatchObject({ ruc: PIN, solSource: 'company', sol: { username: `${PIN}MODDATOS` } });
});
it('SOL de otro RUC se rechaza con pin y conserva la composición legada sin pin', async () => {
  expect(() => issuerSolUsername({ ruc: PIN, origen: 'issuer_config' }, `${COMPANY_RUC}MODDATOS`)).toThrow('ISSUER_SOL_RUC_MISMATCH');
  expect(issuerSolUsername({ ruc: PIN, origen: 'company' }, `${COMPANY_RUC}MODDATOS`)).toBe(`${PIN}${COMPANY_RUC}MODDATOS`);
  Object.assign(h.company, { issuer_ruc: PIN }); process.env.SUNAT_SOL_USER = `${COMPANY_RUC}MODDATOS`;
  await expect(h.resolver.resolve(h.company.id)).rejects.toThrow('ISSUER_SOL_RUC_MISMATCH');
});
it('guardar, omitir, resetear y retirar el pin conservan el RUC compartido y versionan bajo bloqueo', async () => {
  await h.writer.save(h.company.id, { issuer_ruc: PIN });
  const firstVersion = h.company.issuer_config_version;
  await h.writer.save(h.company.id, { entorno: 'BETA' });
  expect(h.company).toMatchObject({ issuer_ruc: PIN, ruc: COMPANY_RUC });
  expect(h.company.issuer_config_version).not.toBe(firstVersion);
  await h.writer.save(h.company.id, { action: 'reset' });
  expect(h.company).toMatchObject({ issuer_ruc: PIN, issuer_config_activated_at: null });
  expect((await h.resolver.resolve(h.company.id)).ruc).toBe(PIN);
  await h.writer.save(h.company.id, { issuer_ruc: null });
  expect(h.company).toMatchObject({ issuer_ruc: null, ruc: COMPANY_RUC });
  expect((await h.resolver.resolve(h.company.id)).ruc).toBe(COMPANY_RUC);
  expect(h.db.$queryRaw).toHaveBeenCalledTimes(4);
  expect(h.db.company.update.mock.calls.every(([call]) => !Object.hasOwn(call.data, 'ruc'))).toBe(true);
});
it('el pin no depende de la presencia de SOL y no se comparte entre empresas', async () => {
  delete process.env.SUNAT_SOL_USER;
  Object.assign(h.company, { issuer_ruc: PIN });
  const first = await h.resolver.resolve(h.company.id);
  const second = await h.resolver.fromCompany({ ...h.company, id: 'other', issuer_ruc: null }, h.db as never);
  expect(first).toMatchObject({ ruc: PIN, sol: null });
  expect(second).toMatchObject({ ruc: COMPANY_RUC, rucSource: 'company' });
});
it('GET distingue origen del RUC, SOL y certificado y publica el detalle del checklist', async () => {
  const reader = new InvoiceConfigService({ listar: async () => [] } as never, h.certificates as never, h.resolver, h.writer);
  expect(await reader.obtener(h.company.id)).toMatchObject({ ruc: COMPANY_RUC, origen_ruc: 'company' });
  await h.writer.save(h.company.id, { issuer_ruc: PIN });
  const config = await reader.obtener(h.company.id);
  expect(config).toMatchObject({ ruc: PIN, origen_ruc: 'issuer_config', origen_efectivo: 'company', origen_sol: 'deployment', origen_certificado: 'deployment' });
  expect(config.checklist).toContainEqual(expect.objectContaining({ clave: 'ruc_emisor', configurado: true, detalle: `RUC emisor: ${PIN} · Origen: configuración propia de M1` }));
});
it('valida el certificado efectivo también al cambiar solo el pin y rechaza antes de escribir', async () => {
  process.env.CERT_BASE64 = 'ZmFrZQ=='; process.env.CERT_PASSWORD = 'fake-password';
  await h.writer.save(h.company.id, { issuer_ruc: PIN });
  expect(h.certificates.validarYCargarCertificado).toHaveBeenLastCalledWith('ZmFrZQ==', 'fake-password', PIN);
  h.certificates.validarYCargarCertificado.mockImplementationOnce(() => { throw Error('RUC_NO_COINCIDE'); });
  const writes = h.db.company.update.mock.calls.length;
  await expect(h.writer.save(h.company.id, { issuer_ruc: COMPANY_RUC })).rejects.toThrow('CONFIG_CERT_INVALID');
  expect(h.db.company.update).toHaveBeenCalledTimes(writes);
  expect(h.company).toMatchObject({ issuer_ruc: PIN, ruc: COMPANY_RUC });
});
it('certificado y firma real de prueba aceptan el pin y rechazan el RUC compartido', () => {
  const fixture = fakeIssuerCertificate(PIN);
  const certificate = { base64: fixture.p12(), password: 'obviously-fake-password' };
  const certificates = new CertificateService();
  const pinned = fakeIssuerContext('fake-company', { ruc: PIN, certificate });
  expect(certificates.getCertificate(pinned).issuerRuc).toBe(PIN);
  const signatures = new SignatureService(certificates);
  const signed = signatures.signXml('<Invoice><ID>F001-1</ID></Invoice>', pinned).signedXml;
  expect(signatures.verifySignature(signed)).toBe(true);
  expect(() => certificates.getCertificate({ ...pinned, ruc: COMPANY_RUC })).toThrow('RUC no coincide');
});
