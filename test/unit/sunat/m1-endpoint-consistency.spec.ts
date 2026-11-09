import { deploymentContext } from '../../../src/modules/sunat/issuerConfigResolver';
import { normalizarEntorno, resolveEndpoint, endpointCoherente } from '../../../src/modules/sunat/soap/sunatBillTypes';
import { SUNAT_BILL_SERVICE_URLS } from '../../../src/modules/sunat/soap/soap.constants';
import { SunatBillService } from '../../../src/modules/sunat/sunat-bill.service';
import { SunatStatusConsultaService } from '../../../src/modules/sunat/statusConsultaService';
import { fakeIssuerContext } from '../../fixtures/issuerContext';

const original = { ...process.env };
beforeEach(() => { process.env = { ...original }; delete process.env.SUNAT_BILL_SERVICE_URL; delete process.env.SUNAT_CONSULT_SERVICE_URL; delete process.env.SUNAT_BILL_SERVICE_URL_PRODUCCION; delete process.env.SUNAT_BILL_SERVICE_URL_BETA; });
afterEach(() => { process.env = original; });
it.each(['BETA', ' beta ', 'PRODUCTION', 'PRODUCCION', 'produccion', 'MOCK', 'unknown', undefined])('normaliza entorno %s de manera única', (value) => {
  if (value === undefined) delete process.env.SUNAT_ENV; else process.env.SUNAT_ENV = value;
  const c = deploymentContext('empresa', '20000000001');
  expect(c.environment).toBe(normalizarEntorno(value));
  expect(c.endpoint).toBe(resolveEndpoint());
  expect(c.environment === 'BETA' ? c.endpoint : null).toBe(c.environment === 'BETA' ? SUNAT_BILL_SERVICE_URLS.beta : null);
});
it.each([
 ['BETA', SUNAT_BILL_SERVICE_URLS.beta, true], ['PRODUCCION', SUNAT_BILL_SERVICE_URLS.produccion, true],
 ['BETA', SUNAT_BILL_SERVICE_URLS.produccion, false], ['PRODUCCION', SUNAT_BILL_SERVICE_URLS.beta, false],
 ['MOCK', 'http://localhost:1234/billService', true], ['MOCK', SUNAT_BILL_SERVICE_URLS.beta, false],
 ['BETA', 'http://e-beta.sunat.gob.pe/billService', false], ['BETA', 'https://otro.invalid/billService', false],
 ['BETA', 'https://u:p@e-beta.sunat.gob.pe/billService', false], ['BETA', 'https://e-beta.sunat.gob.pe/billService?q=secreto', false],
 [null, SUNAT_BILL_SERVICE_URLS.beta, false], ['BETA', '', false],
] as const)('coherencia %s %s = %s', (env, endpoint, expected) => expect(endpointCoherente(env, endpoint)).toBe(expected));
it('bloquea el despacho cuando BETA resuelve producción sin efectuar transporte', async () => {
 const sendBill = jest.fn();
 const service = new SunatBillService({} as never, { sendBill } as never);
 const context = fakeIssuerContext('empresa', { environment: 'BETA', endpoint: SUNAT_BILL_SERVICE_URLS.produccion });
 await expect(service.sendAndProcess({ companyId: 'empresa', context, rucEmisor: context.ruc } as never)).rejects.toThrow('ISSUER_ENDPOINT_ENV_MISMATCH');
 expect(sendBill).not.toHaveBeenCalled();
});
it('la consulta incoherente es INCIERTO y tampoco transporta credenciales', async () => {
 const getStatusCdr = jest.fn();
 const context = fakeIssuerContext('empresa', { environment: 'BETA', consultEndpoint: SUNAT_BILL_SERVICE_URLS.produccion });
 const service = new SunatStatusConsultaService({} as never, { invoice: { findUnique: async () => ({ company_id: 'empresa' }) } } as never, { getStatusCdr } as never, { resolve: async () => context } as never);
 expect(await service.consultar({ companyId: 'empresa', invoiceId: 'id', rucEmisor: context.ruc, serie: 'F001', correlativo: 60, tipoComprobante: '01' })).toEqual({ tipo: 'INCIERTO', motivo: 'ISSUER_ENDPOINT_ENV_MISMATCH' });
 expect(getStatusCdr).not.toHaveBeenCalled();
});
it('una empresa activada sin entorno tampoco hereda BETA ni declara MOCK', async () => {
  delete process.env.SUNAT_ENV;
  const { IssuerConfigResolver } = await import('../../../src/modules/sunat/issuerConfigResolver');
  const r = await new IssuerConfigResolver({} as never, {} as never).fromCompany({
    id: 'empresa', ruc: '20000000001', issuer_config_activated_at: new Date(), issuer_config_version: 'v1', issuer_environment: null,
    sol_user: '', sol_pass_encrypted: '', cert_storage_url: null, cert_pass_encrypted: null,
  }, {} as never);
  expect(r.environment).toBeNull();
  expect(r.endpoint).toBe('');
});
it.each([true, false])('MOCK persistido no hereda un destino SUNAT remoto; loopback=%s', async (local) => {
 process.env.SUNAT_ENV = 'BETA';
 if (local) process.env.SUNAT_BILL_SERVICE_URL = 'http://127.0.0.1:1/billService';
 const { IssuerConfigResolver } = await import('../../../src/modules/sunat/issuerConfigResolver');
 const r = await new IssuerConfigResolver({} as never, {} as never).fromCompany({
   id: 'empresa', ruc: '20000000001', issuer_config_activated_at: new Date(), issuer_config_version: 'v1', issuer_environment: 'MOCK',
   sol_user: '', sol_pass_encrypted: '', cert_storage_url: null, cert_pass_encrypted: null,
 }, {} as never);
 expect(r.endpoint).toBe(local ? 'http://127.0.0.1:1/billService' : '');
 expect(r.consultEndpoint).toBe(local ? 'http://127.0.0.1:1/billConsultService' : '');
});
