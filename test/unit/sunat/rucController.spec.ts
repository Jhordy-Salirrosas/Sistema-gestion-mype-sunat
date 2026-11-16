import { RucController } from '../../../src/modules/sunat/rucController';

describe('RucController', () => {
  it('delega RUC y DNI', () => {
    const ruc = { consultar: jest.fn().mockReturnValue('ruc') } as any;
    const dni = { consultar: jest.fn().mockReturnValue('dni') } as any;
    const controller = new RucController(ruc, dni);
    expect(controller.consultar('20100070970')).toBe('ruc');
    expect(controller.consultarDni('12345678')).toBe('dni');
    expect(ruc.consultar).toHaveBeenCalledWith('20100070970');
    expect(dni.consultar).toHaveBeenCalledWith('12345678');
  });
});
