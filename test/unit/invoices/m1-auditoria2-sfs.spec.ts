import { diagnosticarSfs } from '../../../src/modules/invoices/application/services/sunatSfsDiagnostics';
import { ejecutarSfs } from '../../../src/modules/invoices/application/services/sunatSfsRunner';
import { traducirEmision } from '../../../src/modules/invoices/application/services/emitirComprobanteAdapter';
import { UblGeneratorService } from '../../../src/modules/invoices/ublGeneratorService';
import { SignatureService } from '../../../src/modules/sunat/signature.service';
import { CertificateService, CertificateInspectionError } from '../../../src/modules/sunat/certificate.service';
import { fakeIssuerCertificate } from '../../fixtures/fakeIssuerCertificate';
import type { InvoicePayload } from '../../../src/modules/invoices/invoicePayload';

it('diagnostica disponibilidad real con prueba XSD, sin validar un documento', async () => {
  expect(await diagnosticarSfs()).toEqual({ disponible: true, causa: null, motor: 'SFS' });
});
it('distingue Python ausente y motor heredado sin filtrar rutas', async () => {
  const previous = process.env.SUNAT_SFS_PYTHON;
  const legacy = process.env.SUNAT_XSL_DIR;
  try {
    process.env.SUNAT_SFS_PYTHON = '/inexistente/secreto';
    expect(await diagnosticarSfs()).toEqual({ disponible: false, causa: 'SFS_PYTHON_AUSENTE', motor: 'SFS' });
    process.env.SUNAT_XSL_DIR = '/ruta/privada';
    expect(await diagnosticarSfs()).toEqual({ disponible: false, causa: 'MOTOR_HEREDADO_SELECCIONADO', motor: 'HEREDADO' });
  } finally {
    if (previous === undefined) delete process.env.SUNAT_SFS_PYTHON; else process.env.SUNAT_SFS_PYTHON = previous;
    if (legacy === undefined) delete process.env.SUNAT_XSL_DIR; else process.env.SUNAT_XSL_DIR = legacy;
  }
});
it('flujo común → generador → firma de prueba → SFS conserva anexo y domicilio', async () => {
  const fake = fakeIssuerCertificate();
  const issuer = { ruc: '20000000001', razonSocial: 'Obviously Fake Issuer', codigoLocalAnexo: '0001',
    direccion: 'Domicilio ficticio de prueba 123', ubigeo: '150101', departamento: 'LIMA', provincia: 'LIMA', distrito: 'LIMA' };
  const result = traducirEmision({ tipo_comprobante: '01', serie: 'F001', fecha_emision: '2026-11-08',
    customer_identity_type: '6', customer_identity_number: '20100070970', customer_legal_name: 'Cliente prueba', forma_pago: 'Contado',
    items: [{ codigo: 'P1', descripcion: 'Producto prueba', unidad: 'NIU', cantidad: 1, precioUnitario: 118, afectacion: '10' }],
  }, issuer, 1);
  const unsigned = new UblGeneratorService().generateInvoiceXml(result.dto.payload_ubl as unknown as InvoicePayload);
  expect(unsigned).toContain('<cbc:AddressTypeCode>0001</cbc:AddressTypeCode>');
  expect(unsigned).toContain(issuer.direccion);
  const xml = new SignatureService({ getCertificate: () => ({ certificatePem: fake.pem, privateKeyPem: fake.privateKeyPem }) } as never).signXml(unsigned).signedXml;
  const validation = await ejecutarSfs(xml, '01');
  expect(validation).toEqual({ completado: true, errores: [] });
});
it('inspección mantiene la comprobación de RUC y explica ambos sin secretos', () => {
  const fake = fakeIssuerCertificate();
  const context = { ruc: '20614142503', certificate: { base64: fake.p12(), password: 'obviously-fake-password' } };
  try { new CertificateService().inspectCertificate(context as never); throw new Error('no rechazó'); }
  catch (error) {
    expect(error).toBeInstanceOf(CertificateInspectionError);
    expect(error).toMatchObject({ causa: 'RUC_NO_COINCIDE', detalle: 'RUC no coincide: empresa 20614142503; certificado 20000000001' });
  }
});
it('clasifica contraseña incorrecta y formato inválido sin publicar errores de librería', () => {
  const fake = fakeIssuerCertificate();
  const service = new CertificateService();
  for (const [base64, password, causa] of [[fake.p12(), 'incorrecta', 'CONTRASENA_INCORRECTA'], ['no-es-pkcs12', 'incorrecta', 'FORMATO_INVALIDO']]) {
    expect(() => service.inspectCertificate({ ruc: '20000000001', certificate: { base64, password } } as never)).toThrow(CertificateInspectionError);
    try { service.inspectCertificate({ ruc: '20000000001', certificate: { base64, password } } as never); }
    catch (error) { expect(error).toMatchObject({ causa }); }
  }
  expect(service.inspectCertificate({ ruc: '20000000001', certificate: { base64: fake.p12(), password: 'obviously-fake-password' } } as never).identificador).toMatch(/^SHA256:[a-f0-9]{64}$/);
});
