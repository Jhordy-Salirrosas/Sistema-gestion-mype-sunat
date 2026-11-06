import type { IssuerContext } from '../../src/modules/sunat/issuerConfigResolver';
/** Deliberately false credentials; transport tests always use doubles or loopback. */
export const fakeIssuerContext = (
  companyId = 'fake-company',
  overrides: Partial<IssuerContext> = {},
): IssuerContext =>
  Object.freeze({
    companyId,
    ruc: '20000000001',
    version: 'fake-v1',
    source: 'company',
    environment: 'MOCK',
    endpoint: 'http://127.0.0.1:1/billService',
    consultEndpoint: 'http://127.0.0.1:1/billConsultService',
    timeoutMs: 50,
    sol: Object.freeze({
      username: '20000000001FAKE_USER',
      password: 'obviously-fake-company-password',
    }),
    certificate: null,
    ...overrides,
  });
