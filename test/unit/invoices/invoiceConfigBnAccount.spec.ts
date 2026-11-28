import { BadRequestException } from '@nestjs/common';
import { InvoiceConfigService } from '../../../src/modules/invoices/application/services/invoiceConfigService';

describe('cuenta de detracciones BN al guardar configuración', () => {
  const mensaje = 'cuenta_banco_nacion: debe contener 11 dígitos.';
  const crear = () => {
    const writer = { save: jest.fn().mockResolvedValue(undefined) };
    const service = new InvoiceConfigService({} as never, {} as never, undefined, writer as never);
    const leer = jest.spyOn(service, 'obtener').mockResolvedValue({ entorno: 'MOCK' } as never);
    return { service, writer, leer };
  };
  it.each(['12345ABC', '1234567890', '123456789012'])('rechaza %s antes de escribir o volver a leer', async cuenta_banco_nacion => {
    const { service, writer, leer } = crear();
    await expect(service.actualizar('empresa', { cuenta_banco_nacion })).rejects.toThrow(BadRequestException);
    await expect(service.actualizar('empresa', { cuenta_banco_nacion })).rejects.toThrow(mensaje);
    expect(writer.save).not.toHaveBeenCalled();
    expect(leer).not.toHaveBeenCalled();
  });
  it.each(['00019123456', '', null, undefined])('conserva el guardado de cuenta válida, vacía, null u omitida: %s', async cuenta => {
    const { service, writer } = crear();
    const body = cuenta === undefined ? { entorno: 'MOCK' } : { cuenta_banco_nacion: cuenta };
    await service.actualizar('empresa', body);
    expect(writer.save).toHaveBeenCalledWith('empresa', body);
  });
  it('no suplanta la validación existente de cuerpos y tipos inválidos', async () => {
    const { service, writer } = crear();
    writer.save.mockRejectedValue(new BadRequestException('CONFIG_INPUT_INVALID'));
    for (const body of [null, [], 'inválido', { cuenta_banco_nacion: 123 }]) {
      await expect(service.actualizar('empresa', body)).rejects.toThrow('CONFIG_INPUT_INVALID');
    }
  });
});
