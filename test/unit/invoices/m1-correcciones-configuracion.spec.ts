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
    getCertificate: jest.fn(() => {
      if (dias === null) throw new Error('clave secreta inválida');
      return {
        validTo: new Date('2027-01-31T12:00:00Z'),
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
        archivo: 'certificado-20100070970.p12 (custodia empresa)',
        configurado,
        estado,
        vence_el: '2027-01-31',
        dias_restantes: dias,
        origen: 'company',
      });
      expect(
        config.checklist.find((p) => p.clave === 'certificado_x509')
          ?.configurado,
      ).toBe(configurado);
      expect(config.listo_para_emitir).toBe(configurado);
      expect(certificado.getCertificate).toHaveBeenCalledWith(contexto);
    },
  );

  it.each(['company', 'deployment'])(
    'un certificado no utilizable de %s deja los datos desconocidos en null',
    async (certificateSource) => {
      const { servicio } = montar(null, { certificateSource });
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
    expect(config.certificado.archivo).toBe(
      'certificado-20100070970.p12 (custodia despliegue)',
    );
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
