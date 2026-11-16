import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { SireAccountingMappingItemDto } from '../../../src/modules/sire/application/dto/sireAccountingMappingDto';

async function validar(payload: Record<string, unknown>) {
  return validate(plainToInstance(SireAccountingMappingItemDto, payload));
}

describe('SireAccountingMappingItemDto', () => {
  it('accepts a valid mapping', async () => {
    await expect(
      validar({ tipoOperacion: 'VENTAS', cuentaContable: '701' }),
    ).resolves.toHaveLength(0);
  });

  it('accepts operation names with underscores', async () => {
    await expect(
      validar({ tipoOperacion: 'BASE_IMPONIBLE', cuentaContable: '701' }),
    ).resolves.toHaveLength(0);
  });

  it('rejects a missing operation', async () => {
    const errors = await validar({ cuentaContable: '701' });

    expect(errors).not.toHaveLength(0);
  });

  it('rejects an operation with invalid characters', async () => {
    const errors = await validar({
      tipoOperacion: 'VENTAS GRAVADAS',
      cuentaContable: '701',
    });

    expect(errors).not.toHaveLength(0);
  });

  it('rejects an operation longer than 40 characters', async () => {
    const errors = await validar({
      tipoOperacion: 'A'.repeat(41),
      cuentaContable: '701',
    });

    expect(errors).not.toHaveLength(0);
  });

  it('rejects a missing account', async () => {
    const errors = await validar({ tipoOperacion: 'VENTAS' });

    expect(errors).not.toHaveLength(0);
  });

  it('rejects a non numeric account', async () => {
    const errors = await validar({
      tipoOperacion: 'VENTAS',
      cuentaContable: '701-A',
    });

    expect(errors).not.toHaveLength(0);
  });

  it('rejects an account longer than 20 characters', async () => {
    const errors = await validar({
      tipoOperacion: 'VENTAS',
      cuentaContable: '7'.repeat(21),
    });

    expect(errors).not.toHaveLength(0);
  });
});
