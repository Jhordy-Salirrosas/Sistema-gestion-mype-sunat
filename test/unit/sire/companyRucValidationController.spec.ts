import { BadRequestException } from '@nestjs/common';
import { CompanyRucValidationController } from '../../../src/modules/sire/infrastructure/controllers/companyRucValidationController';
import type { RucConsultaService } from '../../../src/modules/sunat/rucConsultaService';

describe('CompanyRucValidationController', () => {
  let service: { consultar: jest.Mock };
  let controller: CompanyRucValidationController;

  beforeEach(() => {
    service = { consultar: jest.fn() };
    controller = new CompanyRucValidationController(
      service as unknown as RucConsultaService,
    );
  });

  it('devuelve los datos normalizados del RUC consultado', async () => {
    service.consultar.mockResolvedValue({
      ruc: '20601030013',
      razonSocial: 'REXTIE S.A.C.',
      nombreComercial: 'REXTIE',
      estadoContribuyente: 'ACTIVO',
      condicionDomicilio: 'HABIDO',
      direccionFiscal: 'AV. SIEMPRE VIVA 123',
      ubigeo: '150101',
      esAgenteRetencion: false,
      fechaConsulta: '2026-01-01T00:00:00.000Z',
      source: 'decolecta',
      cached: false,
    });

    await expect(controller.validar('20601030013')).resolves.toEqual({
      ruc: '20601030013',
      razonSocial: 'REXTIE S.A.C.',
      nombreComercial: 'REXTIE',
      estadoContribuyente: 'ACTIVO',
      condicionDomicilio: 'HABIDO',
      direccionFiscal: 'AV. SIEMPRE VIVA 123',
      ubigeo: '150101',
      esAgenteRetencion: false,
      fechaConsulta: '2026-01-01T00:00:00.000Z',
      source: 'decolecta',
      cached: false,
      direccion: 'AV. SIEMPRE VIVA 123',
      estado: 'ACTIVO',
      condicion: 'HABIDO',
    });
    expect(service.consultar).toHaveBeenCalledWith('20601030013');
  });

  it('returns the full response even when optional fields are null', async () => {
    service.consultar.mockResolvedValue({
      ruc: '20601030013',
      razonSocial: 'REXTIE S.A.C.',
      nombreComercial: null,
      estadoContribuyente: 'ACTIVO',
      condicionDomicilio: 'HABIDO',
      direccionFiscal: null,
      ubigeo: null,
      esAgenteRetencion: null,
      fechaConsulta: '2026-01-01T00:00:00.000Z',
      source: 'generico',
      cached: true,
    });

    await expect(controller.validar('20601030013')).resolves.toMatchObject({
      razonSocial: 'REXTIE S.A.C.',
      nombreComercial: null,
      direccion: null,
      estado: 'ACTIVO',
      condicion: 'HABIDO',
      ubigeo: null,
      esAgenteRetencion: null,
      source: 'generico',
      cached: true,
    });
  });

  it('rechaza RUC que no tengan exactamente 11 dígitos', async () => {
    await expect(controller.validar('123')).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await expect(controller.validar('2060103001A')).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(service.consultar).not.toHaveBeenCalled();
  });

  it('convierte los fallos del proveedor en un 400 amigable', async () => {
    service.consultar.mockRejectedValue(new Error('timeout'));

    await expect(controller.validar('20601030013')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('convierte un RUC no encontrado en un 400 amigable', async () => {
    service.consultar.mockRejectedValue(
      new BadRequestException('El proveedor no encontró el RUC consultado.'),
    );

    await expect(controller.validar('20601030013')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});
