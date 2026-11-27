import { BadRequestException, ServiceUnavailableException } from '@nestjs/common';
import { RucConsultaService } from '../../../src/modules/sunat/rucConsultaService';

const prisma = () => ({ padronRucCache: { findUnique: jest.fn().mockResolvedValue(null), upsert: jest.fn(async ({ create }: any) => create) } });
const config = (values: Record<string, any>) => ({ get: jest.fn((key: string, fallback?: any) => values[key] ?? fallback) });
const respuesta = (body: unknown, status = 200) => ({ ok: status >= 200 && status < 300, status, json: jest.fn().mockResolvedValue(body) }) as unknown as Response;

describe('RucConsultaService - Decolecta', () => {
  const originalFetch = global.fetch;
  afterEach(() => { global.fetch = originalFetch; jest.restoreAllMocks(); });

  it('consulta Decolecta con Bearer y normaliza su respuesta', async () => {
    const fetchMock = jest.fn().mockResolvedValue(respuesta({ razon_social: 'REXTIE S.A.C.', nombre_comercial: 'REXTIE', numero_documento: '20601030013', estado: 'ACTIVO', condicion: 'HABIDO', direccion: 'Av. Lima', ubigeo: '150131', es_agente_retencion: false }));
    global.fetch = fetchMock as never;
    const db = prisma();
    const service = new RucConsultaService(db as never, config({ DECOLECTA_API_TOKEN: 'tok', SUNAT_RUC_CACHE_TTL_SECONDS: 86400 }) as never);
    const r = await service.consultar('20601030013');
    expect(r).toMatchObject({ ruc: '20601030013', razonSocial: 'REXTIE S.A.C.', nombreComercial: 'REXTIE', estadoContribuyente: 'ACTIVO', condicionDomicilio: 'HABIDO', source: 'decolecta' });
    expect(String(fetchMock.mock.calls[0][0])).toContain('api.decolecta.com/v1/sunat/ruc');
    expect((fetchMock.mock.calls[0][1] as any).headers.Authorization).toBe('Bearer tok');
  });

  it('exige token y traduce 422 a RUC no encontrado', async () => {
    const service = new RucConsultaService(prisma() as never, config({ SUNAT_RUC_PROVIDER: 'decolecta' }) as never);
    await expect(service.consultar('20601030013')).rejects.toBeInstanceOf(ServiceUnavailableException);

    global.fetch = jest.fn().mockResolvedValue(respuesta({ message: 'ruc no valido' }, 422)) as never;
    const conToken = new RucConsultaService(prisma() as never, config({ SUNAT_RUC_PROVIDER: 'decolecta', DECOLECTA_API_TOKEN: 'tok' }) as never);
    await expect(conToken.consultar('20601030013')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('usa caché vigente sin llamar al proveedor', async () => {
    const db = prisma();
    db.padronRucCache.findUnique.mockResolvedValue({ ruc: '20601030013', razon_social: 'Cache', nombre_comercial: 'Comercial Cache', estado_contribuyente: 'ACTIVO', condicion_domicilio: 'HABIDO', ubigeo: null, direccion_fiscal: null, es_agente_retencion: null, consulted_at: new Date(), source: 'decolecta' });
    const fetchMock = jest.fn();
    global.fetch = fetchMock as never;
    const service = new RucConsultaService(db as never, config({ DECOLECTA_API_TOKEN: 'tok' }) as never);
    await expect(service.consultar('20601030013')).resolves.toMatchObject({ cached: true, razonSocial: 'Cache', nombreComercial: 'Comercial Cache' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('traduce caída de red, error HTTP y JSON inválido a 503', async () => {
    const service = () => new RucConsultaService(prisma() as never, config({ DECOLECTA_API_TOKEN: 'tok' }) as never);
    global.fetch = jest.fn().mockRejectedValue(new Error('sin red')) as never;
    await expect(service().consultar('20601030013')).rejects.toBeInstanceOf(ServiceUnavailableException);
    global.fetch = jest.fn().mockResolvedValue(respuesta({}, 500)) as never;
    await expect(service().consultar('20601030013')).rejects.toBeInstanceOf(ServiceUnavailableException);
    global.fetch = jest.fn().mockResolvedValue({ ok: true, status: 200, json: jest.fn().mockRejectedValue(new Error('json')) }) as never;
    await expect(service().consultar('20601030013')).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('devuelve datos mock y evita el proveedor cuando MOCK_DECOLECTA=true', async () => {
    const original = process.env.MOCK_DECOLECTA;
    process.env.MOCK_DECOLECTA = 'true';
    try {
      const fetchMock = jest.fn();
      global.fetch = fetchMock as never;
      const db = prisma();
      const service = new RucConsultaService(
        db as never,
        config({ DECOLECTA_API_TOKEN: 'tok' }) as never,
      );

      const response = await service.consultar('20601030013');

      expect(response).toMatchObject({
        ruc: '20601030013',
        razonSocial: 'EMPRESA DEMO S.A.C.',
        estadoContribuyente: 'ACTIVO',
        condicionDomicilio: 'HABIDO',
        source: 'mock',
        cached: false,
      });
      expect(fetchMock).not.toHaveBeenCalled();
      expect(db.padronRucCache.findUnique).not.toHaveBeenCalled();
    } finally {
      if (original === undefined) delete process.env.MOCK_DECOLECTA;
      else process.env.MOCK_DECOLECTA = original;
    }
  });

  it('rechaza un RUC inválido antes de consultar al proveedor', async () => {
    const fetchMock = jest.fn();
    global.fetch = fetchMock as never;
    const service = new RucConsultaService(prisma() as never, config({ DECOLECTA_API_TOKEN: 'tok' }) as never);

    await expect(service.consultar('123')).rejects.toBeInstanceOf(BadRequestException);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('consulta el proveedor genérico con API key y URL con plantilla', async () => {
    const fetchMock = jest.fn().mockResolvedValue(
      respuesta({ ruc: '20601030013', razonSocial: 'GENERICO SAC', estado: 'ACTIVO', condicion: 'HABIDO' }),
    );
    global.fetch = fetchMock as never;
    const service = new RucConsultaService(
      prisma() as never,
      config({
        SUNAT_RUC_PROVIDER: 'generico',
        SUNAT_RUC_SERVICE_URL: 'https://api.test/ruc/{ruc}',
        SUNAT_RUC_SERVICE_API_KEY: 'api-key',
      }) as never,
    );

    await expect(service.consultar('20601030013')).resolves.toMatchObject({
      razonSocial: 'GENERICO SAC',
      source: 'generico',
    });
    expect(String(fetchMock.mock.calls[0][0])).toBe('https://api.test/ruc/20601030013');
    expect((fetchMock.mock.calls[0][1] as any).headers['X-API-Key']).toBe('api-key');
  });

  it('consulta el proveedor genérico sin plantilla ni API key', async () => {
    const fetchMock = jest.fn().mockResolvedValue(
      respuesta({ ruc: '20601030013', razonSocial: 'GENERICO SAC', estado: 'ACTIVO', condicion: 'HABIDO' }),
    );
    global.fetch = fetchMock as never;
    const service = new RucConsultaService(
      prisma() as never,
      config({
        SUNAT_RUC_PROVIDER: 'generic',
        SUNAT_RUC_SERVICE_URL: 'https://api.test/ruc/',
      }) as never,
    );

    await expect(service.consultar('20601030013')).resolves.toMatchObject({
      source: 'generico',
    });
    expect(String(fetchMock.mock.calls[0][0])).toBe('https://api.test/ruc/20601030013');
    expect((fetchMock.mock.calls[0][1] as any).headers['X-API-Key']).toBeUndefined();
  });

  it('exige la URL del proveedor genérico', async () => {
    const service = new RucConsultaService(
      prisma() as never,
      config({ SUNAT_RUC_PROVIDER: 'generico' }) as never,
    );

    await expect(service.consultar('20601030013')).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('rechaza una URL de proveedor con protocolo no permitido', async () => {
    const service = new RucConsultaService(
      prisma() as never,
      config({ DECOLECTA_API_URL: 'ftp://api.test/ruc/{ruc}', DECOLECTA_API_TOKEN: 'tok' }) as never,
    );

    await expect(service.consultar('20601030013')).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('rechaza respuestas que no son un objeto', async () => {
    global.fetch = jest.fn().mockResolvedValue(respuesta(null)) as never;
    const service = new RucConsultaService(prisma() as never, config({ DECOLECTA_API_TOKEN: 'tok' }) as never);

    await expect(service.consultar('20601030013')).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('rechaza una respuesta que no corresponde al RUC consultado', async () => {
    global.fetch = jest.fn().mockResolvedValue(
      respuesta({ ruc: '20100070970', razonSocial: 'OTRA SAC', estado: 'ACTIVO', condicion: 'HABIDO' }),
    ) as never;
    const service = new RucConsultaService(prisma() as never, config({ DECOLECTA_API_TOKEN: 'tok' }) as never);

    await expect(service.consultar('20601030013')).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('rechaza respuestas sin los campos obligatorios', async () => {
    global.fetch = jest.fn().mockResolvedValue(
      respuesta({ ruc: '20601030013', estado: 'ACTIVO', condicion: 'HABIDO' }),
    ) as never;
    const service = new RucConsultaService(prisma() as never, config({ DECOLECTA_API_TOKEN: 'tok' }) as never);

    await expect(service.consultar('20601030013')).rejects.toBeInstanceOf(ServiceUnavailableException);
  });
});
