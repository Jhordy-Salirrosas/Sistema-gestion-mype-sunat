import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { SireConfiguracionRequestDto } from '../../../src/modules/sire/application/dto/sireConfigurationDto';

async function errores(dto: object): Promise<string[]> {
  const instancia = plainToInstance(SireConfiguracionRequestDto, dto);
  const resultado = await validate(instancia, {
    whitelist: true,
    forbidNonWhitelisted: true,
  });
  return resultado.flatMap((error) =>
    Object.values(error.constraints ?? {}),
  );
}

describe('SireConfiguracionRequestDto', () => {
  it('accepts an empty body so the client can save only what it has', async () => {
    await expect(errores({})).resolves.toEqual([]);
  });

  it('accepts the four credentials', async () => {
    await expect(
      errores({
        clientId: 'client-id',
        clientSecret: 'client-secret',
        solUser: 'FAKEUSER',
        solPassword: 'fake-sol-password',
      }),
    ).resolves.toEqual([]);
  });

  it('rejects a credential that is not a text', async () => {
    const mensajes = await errores({ clientId: 123 });

    expect(mensajes.length).toBeGreaterThan(0);
  });

  it('rejects a credential that is empty', async () => {
    await expect(errores({ clientSecret: '' })).resolves.not.toEqual([]);
  });

  it('rejects a sol user with spaces', async () => {
    await expect(errores({ solUser: 'FAKE USER' })).resolves.not.toEqual([]);
  });

  it('rejects a credential that is longer than the column', async () => {
    await expect(
      errores({ solPassword: 'a'.repeat(129) }),
    ).resolves.not.toEqual([]);
    await expect(
      errores({ clientSecret: 'a'.repeat(401) }),
    ).resolves.not.toEqual([]);
  });

  it('rejects a property that is not part of the contract', async () => {
    await expect(errores({ ruc: '20601030013' })).resolves.not.toEqual([]);
  });
});
