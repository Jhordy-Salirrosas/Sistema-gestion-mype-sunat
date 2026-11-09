import { InvoiceConfigService } from '../../../src/modules/invoices/application/services/invoiceConfigService';

function montar(dias: number | null, context: Record<string, unknown> = {}) {
  const contexto = {
    environment: 'BETA',
    source: 'company',
    certificateSource: 'company',
    ruc: '20100070970',
    sol: { username: 'usuario', password: 'secreto' },
    certificate: { base64: 'privado', password: 'secreto' },
    endpoint: 'https://sunat.test/billService',
    consultEndpoint: 'https://sunat.test/billConsultService',
    ...context,
  };
  const resolver = { resolve: jest.fn().mockResolvedValue(contexto) };
  const series = {
    listar: jest
      .fn()
      .mockResolvedValue([
        { is_active: true, document_type: '01', series: 'F001' },
      ]),
  };
  const certificado = {
    inspectCertificate: jest.fn(() => {
      if (dias === null) throw new Error('clave secreta inválida');
      return {
        validFrom: new Date(Date.now() - 86400000),
        validTo: new Date(Date.now() + dias * 86400000),
        daysRemaining: dias,
        issuerRuc: '20100070970',
      };
    }),
  };
  return {
    servicio: new InvoiceConfigService(
      series as never,
      certificado as never,
      resolver as never,
    ),
    certificado,
    resolver,
    series,
    contexto,
  };
}

describe('M1 estado estructurado del certificado', () => {
  beforeEach(() => { jest.useFakeTimers(); jest.setSystemTime(new Date('2026-11-08T12:00:00Z')); });
  afterEach(() => jest.useRealTimers());
  it.each([
    [31, 'VIGENTE', true],
    [30, 'POR_VENCER', true],
    [0, 'POR_VENCER', true],
    [-1, 'VENCIDO', false],
  ] as const)(
    'con %s días informa %s y disponibilidad %s',
    async (dias, estado, configurado) => {
      const { servicio, certificado, contexto } = montar(dias);
      const config = await servicio.obtener('empresa');
      expect(config.certificado).toEqual({
        archivo: null,
        configurado,
        estado,
        vence_el: new Date(Date.now() + dias * 86400000).toISOString().slice(0, 10),
        dias_restantes: dias,
        origen: 'company',
      });
      expect(
        config.checklist.find((p) => p.clave === 'certificado_x509')
          ?.configurado,
      ).toBe(configurado);
      expect(config.listo_para_emitir).toBe(false);
      expect(certificado.inspectCertificate).toHaveBeenCalledWith(contexto);
    },
  );

  it.each(['company', 'deployment'])(
    'un certificado no utilizable de %s deja los datos desconocidos en null',
    async (certificateSource) => {
      const { servicio } = montar(null, { certificateSource, certificate: null });
      const config = await servicio.obtener('empresa');
      expect(config.certificado).toEqual({
        archivo: null,
        configurado: false,
        estado: 'NO_CONFIGURADO',
        vence_el: null,
        dias_restantes: null,
        origen: certificateSource,
      });
      expect(config.listo_para_emitir).toBe(false);
      expect(JSON.stringify(config)).not.toContain('clave secreta');
    },
  );

  it('identifica la custodia de despliegue sin publicar material criptográfico', async () => {
    const { servicio } = montar(40, { certificateSource: 'deployment' });
    const config = await servicio.obtener('empresa');
    expect(config.certificado.archivo).toBeNull();
    expect(config.certificado.origen).toBe('deployment');
    expect(JSON.stringify(config)).not.toContain('privado');
    expect(JSON.stringify(config)).not.toContain('secreto');
  });

  it.each(['MAYORISTA', 'MINORISTA', null])(
    'publica perfil comercial %s resuelto para la empresa',
    async (commercialProfile) => {
      const { servicio, resolver } = montar(40, { commercialProfile });
      expect((await servicio.obtener('empresa')).perfil_comercial).toBe(
        commercialProfile,
      );
      expect(resolver.resolve).toHaveBeenCalledWith('empresa');
    },
  );
});

it('distingue certificado presente inválido de certificado ausente y no revela el error sensible', async () => {
  const { servicio } = montar(null);
  const c = await servicio.obtener('empresa');
  expect(c.certificado.estado).toBe('INVALIDO');
  expect(JSON.stringify(c)).not.toContain('secreta');
});
it('el tipo predeterminado nace solo del perfil comercial', async () => {
  for (const [commercialProfile, expected] of [['MAYORISTA', '01'], ['MINORISTA', '03'], [null, null]] as const) {
    expect((await montar(60, { commercialProfile }).servicio.obtener('empresa')).tipo_comprobante_predeterminado).toBe(expected);
  }
});
it('sin entorno ni endpoints sirve null y no anuncia disponibilidad', async () => {
  const { servicio } = montar(60, { environment: null, endpoint: '', consultEndpoint: '' });
  const c = await servicio.obtener('empresa');
  expect(c.entorno).toBeNull();
  expect(c.endpoint_bill_service).toBeNull();
  expect(c.endpoint_consult_service).toBeNull();
  expect(c.listo_para_emitir).toBe(false);
});
it('oculta usuario, contraseña y parámetros de una URL mal configurada y declara incoherencia', async () => {
  const { servicio } = montar(60, { endpoint: 'https://usuario:secreto@e-factura.sunat.gob.pe/billService?token=privado#privado' });
  const c = await servicio.obtener('empresa');
  expect(c.endpoint_bill_service).toBe('https://e-factura.sunat.gob.pe/billService');
  expect(c.checklist.find((p) => p.clave === 'endpoints')?.configurado).toBe(false);
  expect(JSON.stringify(c)).not.toContain('privado');
});
it('un certificado vencido hace una hora es VENCIDO aunque ceil de días resulte cero', async () => {
  const { servicio, certificado } = montar(0);
  certificado.inspectCertificate.mockReturnValue({ validFrom: new Date(Date.now() - 86400000), validTo: new Date(Date.now() - 3600000), daysRemaining: 999, issuerRuc: '20100070970' });
  const c = await servicio.obtener('empresa');
  expect(c.certificado.estado).toBe('VENCIDO');
  expect(c.certificado.dias_restantes).toBe(0);
});
it('un certificado futuro no figura como vigente', async () => {
  const { servicio, certificado } = montar(60);
  certificado.inspectCertificate.mockReturnValue({ validFrom: new Date(Date.now() + 86400000), validTo: new Date(Date.now() + 60 * 86400000), daysRemaining: 999, issuerRuc: '20100070970' });
  const c = await servicio.obtener('empresa');
  expect(c.certificado.estado).toBe('AUN_NO_VIGENTE');
  expect(c.certificado.dias_restantes).toBe(60);
});
