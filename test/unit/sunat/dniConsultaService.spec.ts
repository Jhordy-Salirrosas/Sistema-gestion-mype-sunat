import { BadRequestException } from '@nestjs/common';
import { ClientSafeHttpException } from '../../../src/common/exceptions/clientSafeHttpException';
import { DniConsultaService } from '../../../src/modules/sunat/dniConsultaService';

const config = { get: jest.fn((key: string, def?: unknown) => key === 'DECOLECTA_API_TOKEN' ? 'token' : def) } as any;
const service = new DniConsultaService(config);
const ok = (body: unknown) => Promise.resolve({ ok: true, status: 200, json: async () => body } as Response);

describe('DniConsultaService', () => {
  afterEach(() => jest.restoreAllMocks());

  it('valida 8 dígitos', async () => {
    await expect(service.consultar('123')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('normaliza nombres y apellidos', async () => {
    jest.spyOn(global, 'fetch').mockImplementation(() => ok({ first_name: 'OLIVER ALEXIS', first_last_name: 'SALDAÑA', second_last_name: 'YLQUIMICHE', full_name: 'SALDAÑA YLQUIMICHE OLIVER ALEXIS', document_number: '70787221' }));
    await expect(service.consultar('70787221')).resolves.toMatchObject({ nombreCompleto: 'SALDAÑA YLQUIMICHE OLIVER ALEXIS', source: 'decolecta' });
  });

  it('rechaza DNI no encontrado y respuesta de otro DNI', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValueOnce({ ok: false, status: 404 } as Response);
    await expect(service.consultar('12345678')).rejects.toBeInstanceOf(BadRequestException);
    jest.spyOn(global, 'fetch').mockImplementation(() => ok({ dni: '00000000', nombres: 'X' }));
    await expect(service.consultar('12345678')).rejects.toThrow('no corresponde');
  });

  it('falla sin token, con red caída o proveedor 500', async () => {
    const sinToken = new DniConsultaService({ get: jest.fn(() => undefined) } as any);
    await expect(sinToken.consultar('12345678')).rejects.toBeInstanceOf(ClientSafeHttpException);
    jest.spyOn(global, 'fetch').mockRejectedValueOnce(new Error('sin red'));
    await expect(service.consultar('12345678')).rejects.toBeInstanceOf(ClientSafeHttpException);
    jest.spyOn(global, 'fetch').mockResolvedValueOnce({ ok: false, status: 500 } as Response);
    await expect(service.consultar('12345678')).rejects.toBeInstanceOf(ClientSafeHttpException);
    jest.spyOn(global, 'fetch').mockResolvedValueOnce({ ok: false, status: 401 } as Response);
    await expect(service.consultar('12345678')).rejects.toThrow('token');
    jest.spyOn(global, 'fetch').mockResolvedValueOnce({ ok: false, status: 429 } as Response);
    await expect(service.consultar('12345678')).rejects.toThrow('límite');
  });

  it('usa URL sin placeholder y rechaza respuesta vacía o sin nombre', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValueOnce({ ok: true, status: 200, json: async () => null } as Response);
    await expect(service.consultar('12345678')).rejects.toThrow('inválida');
    jest.spyOn(global, 'fetch').mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ dni: '12345678', nombres: '' }) } as Response);
    await expect(service.consultar('12345678')).rejects.toThrow('nombre');
    const configSinTemplate = { get: jest.fn((key: string, def?: unknown) => key === 'DECOLECTA_API_TOKEN' ? 't' : key === 'DECOLECTA_DNI_API_URL' ? 'https://api.test/dni' : def) } as any;
    const sinTemplate = new DniConsultaService(configSinTemplate);
    jest.spyOn(global, 'fetch').mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ dni: '12345678', nombre_completo: 'NOMBRE' }) } as Response);
    await expect(sinTemplate.consultar('12345678')).resolves.toMatchObject({ nombreCompleto: 'NOMBRE' });
  });
});
