import { BadRequestException } from '@nestjs/common';
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
    jest.spyOn(global, 'fetch').mockImplementation(() => ok({ dni: '70787221', nombres: 'OLIVER ALEXIS', apellido_paterno: 'SALDAÑA', apellido_materno: 'YLQUIMICHE' }));
    await expect(service.consultar('70787221')).resolves.toMatchObject({ nombreCompleto: 'OLIVER ALEXIS SALDAÑA YLQUIMICHE', source: 'decolecta' });
  });

  it('rechaza DNI no encontrado y respuesta de otro DNI', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValueOnce({ ok: false, status: 404 } as Response);
    await expect(service.consultar('12345678')).rejects.toBeInstanceOf(BadRequestException);
    jest.spyOn(global, 'fetch').mockImplementation(() => ok({ dni: '00000000', nombres: 'X' }));
    await expect(service.consultar('12345678')).rejects.toThrow('no corresponde');
  });
});
