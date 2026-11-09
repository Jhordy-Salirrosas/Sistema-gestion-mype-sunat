import { IssuerConfigEncryption } from '../../src/modules/sunat/issuerConfigEncryption';
import { IssuerConfigResolver } from '../../src/modules/sunat/issuerConfigResolver';
import { IssuerConfigWriter } from '../../src/modules/invoices/application/services/issuerConfigWriter';

/** Transaction boundary double: the PostgreSQL suite separately proves rollback. */
export function issuerConfigHarness() {
  const company = {
    id: 'fake-company',
    ruc: '20000000001',
    legal_name: 'Obviously Fake Issuer',
    commercial_profile: null as string | null,
    issuer_config_activated_at: null as Date | null,
    issuer_config_version: null as string | null,
    issuer_environment: null as string | null,
    issuer_sol_configured: null as boolean | null,
    issuer_cert_configured: null as boolean | null,
    sol_user: 'FAKE_LEGACY',
    sol_pass_encrypted: 'fake-legacy-unmanaged',
    cert_storage_url: null as string | null,
    cert_pass_encrypted: null as string | null,
  };
  const objects = new Map<
    string,
    { id: string; company_id: string; encrypted_content: string }
  >();
  const db = {
    $queryRaw: jest.fn(async () => [{ id: company.id }]),
    company: {
      findUnique: jest.fn(async () => ({ ...company })),
      update: jest.fn(async ({ data }: { data: Partial<typeof company> }) =>
        Object.assign(company, data),
      ),
    },
    issuerCertificate: {
      create: jest.fn(
        async ({
          data,
        }: {
          data: { id: string; company_id: string; encrypted_content: string };
        }) => {
          objects.set(data.id, data);
          return data;
        },
      ),
      findFirst: jest.fn(
        async ({ where }: { where: { id: string; company_id: string } }) => {
          const object = objects.get(where.id);
          return object?.company_id === where.company_id ? object : null;
        },
      ),
    },
    $transaction: jest.fn(),
  };
  db.$transaction.mockImplementation(
    async (work: (tx: typeof db) => Promise<unknown>) => work(db),
  );
  const certificate = {
    certificatePem: 'obviously-fake-pem',
    privateKeyPem: 'obviously-fake-private-key',
    issuerRuc: company.ruc,
    validFrom: new Date('2020-01-01'),
    validTo: new Date('2099-01-01'),
    daysRemaining: 60,
  };
  const certificates = {
    validarYCargarCertificado: jest.fn(() => certificate),
    getCertificate: jest.fn(() => certificate),
    inspectCertificate: jest.fn(() => certificate),
  };
  const encryption = new IssuerConfigEncryption();
  const resolver = new IssuerConfigResolver(db as never, encryption);
  const writer = new IssuerConfigWriter(
    db as never,
    encryption,
    resolver,
    certificates as never,
  );
  return { company, db, certificates, encryption, resolver, writer, objects };
}
