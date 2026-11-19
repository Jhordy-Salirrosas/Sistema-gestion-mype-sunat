import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { UpdateCompanyConfigurationDto } from '../../../src/modules/sire/application/dto/companyConfigurationDto';

async function validar(payload: Record<string, unknown>) {
  return validate(plainToInstance(UpdateCompanyConfigurationDto, payload));
}

describe('UpdateCompanyConfigurationDto', () => {
  it('accepts a complete valid payload', async () => {
    await expect(
      validar({
        businessName: 'Demo SAC',
        tradeName: 'Demo Comercial',
        direccion: 'AV. SIEMPRE VIVA 123',
        estado: 'ACTIVO',
        condicion: 'HABIDO',
        ubigeo: '150101',
        esAgenteRetencion: true,
        series: ['F001', 'B001'],
      }),
    ).resolves.toHaveLength(0);
  });

  it('accepts an empty payload (all fields are optional)', async () => {
    await expect(validar({})).resolves.toHaveLength(0);
  });

  it('rejects a blank business name', async () => {
    const errors = await validar({ businessName: '' });

    expect(errors).not.toHaveLength(0);
  });

  it('rejects a business name longer than 200 characters', async () => {
    const errors = await validar({ businessName: 'x'.repeat(201) });

    expect(errors).not.toHaveLength(0);
  });

  it('rejects a blank trade name', async () => {
    const errors = await validar({ tradeName: '' });

    expect(errors).not.toHaveLength(0);
  });

  it('rejects a trade name longer than 200 characters', async () => {
    const errors = await validar({ tradeName: 'x'.repeat(201) });

    expect(errors).not.toHaveLength(0);
  });

  it('rejects blank address, estado and condicion', async () => {
    await expect(validar({ direccion: '' })).resolves.not.toHaveLength(0);
    await expect(validar({ estado: '' })).resolves.not.toHaveLength(0);
    await expect(validar({ condicion: '' })).resolves.not.toHaveLength(0);
  });

  it('rejects values that are too long for address, estado and condicion', async () => {
    await expect(
      validar({ direccion: 'x'.repeat(301) }),
    ).resolves.not.toHaveLength(0);
    await expect(
      validar({ estado: 'x'.repeat(51) }),
    ).resolves.not.toHaveLength(0);
    await expect(
      validar({ condicion: 'x'.repeat(51) }),
    ).resolves.not.toHaveLength(0);
  });

  it('rejects an ubigeo that is not six digits', async () => {
    await expect(validar({ ubigeo: '15010' })).resolves.not.toHaveLength(0);
    await expect(validar({ ubigeo: '15010A' })).resolves.not.toHaveLength(0);
  });

  it('rejects a non-boolean retention agent flag', async () => {
    await expect(
      validar({ esAgenteRetencion: 'true' }),
    ).resolves.not.toHaveLength(0);
  });

  it('rejects a series list that is not an array', async () => {
    const errors = await validar({ series: 'F001' });

    expect(errors).not.toHaveLength(0);
  });

  it('rejects series with invalid characters', async () => {
    const errors = await validar({ series: ['F001', 'F 001'] });

    expect(errors).not.toHaveLength(0);
  });

  it('rejects series longer than 10 characters', async () => {
    const errors = await validar({ series: ['F00123456789'] });

    expect(errors).not.toHaveLength(0);
  });

  it('rejects repeated series', async () => {
    const errors = await validar({ series: ['F001', 'F001'] });

    expect(errors).not.toHaveLength(0);
  });

  it('rejects more than 50 series', async () => {
    const series = Array.from({ length: 51 }, (_, index) => `F${index}`);

    const errors = await validar({ series });

    expect(errors).not.toHaveLength(0);
  });

  it('rejects non-string series items', async () => {
    const errors = await validar({ series: [123] });

    expect(errors).not.toHaveLength(0);
  });
});
