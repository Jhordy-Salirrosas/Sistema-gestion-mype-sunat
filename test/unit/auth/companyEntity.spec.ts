import { CompanyEntity } from '../../../src/modules/auth/domain/entities/companyEntity';

describe('CompanyEntity', () => {
  it('debería instanciar correctamente con sus propiedades de dominio', () => {
    const now = new Date();
    const company = new CompanyEntity({
      id: 'comp-123',
      ruc: '20601234567',
      legalName: 'MYPE IMPORTACIONES S.A.C.',
      tradeName: 'MYPE IMPORT',
      solUser: 'MODDATOS',
      solPassEncrypted: 'enc-pass-123',
      certStorageUrl: 'https://storage.supabase.com/certs/cert.pfx',
      certPassEncrypted: 'enc-cert-pass',
      sireClientIdEnc: 'sire-id-enc',
      sireClientSecretEnc: 'sire-secret-enc',
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });

    expect(company.id).toBe('comp-123');
    expect(company.ruc).toBe('20601234567');
    expect(company.legalName).toBe('MYPE IMPORTACIONES S.A.C.');
    expect(company.tradeName).toBe('MYPE IMPORT');
    expect(company.solUser).toBe('MODDATOS');
    expect(company.solPassEncrypted).toBe('enc-pass-123');
    expect(company.certStorageUrl).toBe('https://storage.supabase.com/certs/cert.pfx');
    expect(company.certPassEncrypted).toBe('enc-cert-pass');
    expect(company.sireClientIdEnc).toBe('sire-id-enc');
    expect(company.sireClientSecretEnc).toBe('sire-secret-enc');
    expect(company.isActive).toBe(true);
    expect(company.isActiveCompany()).toBe(true);
    expect(company.createdAt).toBe(now);
    expect(company.updatedAt).toBe(now);
  });

  it('debería retornar null para campos opcionales no proporcionados', () => {
    const company = new CompanyEntity({
      id: 'comp-456',
      ruc: '20609876543',
      legalName: 'SERVICIOS COMERCIALES S.A.',
      solUser: 'MODDATOS',
      solPassEncrypted: 'enc-pass',
      isActive: false,
    });

    expect(company.tradeName).toBeNull();
    expect(company.certStorageUrl).toBeNull();
    expect(company.certPassEncrypted).toBeNull();
    expect(company.sireClientIdEnc).toBeNull();
    expect(company.sireClientSecretEnc).toBeNull();
    expect(company.isActive).toBe(false);
    expect(company.isActiveCompany()).toBe(false);
  });
});
