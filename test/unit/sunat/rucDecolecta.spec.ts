import { BadRequestException, ServiceUnavailableException } from '@nestjs/common';
import { RucConsultaService } from '../../../src/modules/sunat/rucConsultaService';

const prisma = () => ({ padronRucCache: { findUnique: jest.fn().mockResolvedValue(null), upsert: jest.fn(async ({ create }: any) => create) } });
const config = (values: Record<string, any>) => ({ get: jest.fn((key: string, fallback?: any) => values[key] ?? fallback) });
const respuesta = (body: unknown, status = 200) => ({ ok: status >= 200 && status < 300, status, json: jest.fn().mockResolvedValue(body) }) as unknown as Response;

describe('RucConsultaService - Decolecta', () => {
  const originalFetch = global.fetch;
  afterEach(() => { global.fetch = originalFetch; jest.restoreAllMocks(); });

  it('consulta Decolecta con Bearer y normaliza su respuesta', async () => {
    const fetchMock = jest.fn().mockResolvedValue(respuesta({ razon_social: 'REXTIE S.A.C.', numero_documento: '20601030013', estado: 'ACTIVO', condicion: 'HABIDO', direccion: 'Av. Lima', ubigeo: '150131', es_agente_retencion: false }));
    global.fetch = fetchMock as never;
    const db = prisma();
    const service = new RucConsultaService(db as never, config({ DECOLECTA_API_TOKEN: 'tok', SUNAT_RUC_CACHE_TTL_SECONDS: 86400 }) as never);
    const r = await service.consultar('20601030013');
    expect(r).toMatchObject({ ruc: '20601030013', razonSocial: 'REXTIE S.A.C.', estadoContribuyente: 'ACTIVO', condicionDomicilio: 'HABIDO', source: 'decolecta' });
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
    db.padronRucCache.findUnique.mockResolvedValue({ ruc: '20601030013', razon_social: 'Cache', estado_contribuyente: 'ACTIVO', condicion_domicilio: 'HABIDO', ubigeo: null, direccion_fiscal: null, es_agente_retencion: null, consulted_at: new Date(), source: 'decolecta' });
    const fetchMock = jest.fn();
    global.fetch = fetchMock as never;
    const service = new RucConsultaService(db as never, config({ DECOLECTA_API_TOKEN: 'tok' }) as never);
    await expect(service.consultar('20601030013')).resolves.toMatchObject({ cached: true, razonSocial: 'Cache' });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
