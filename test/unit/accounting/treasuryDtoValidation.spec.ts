import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { PayExpenseDto } from '../../../src/modules/expenses/application/dto/payExpenseDto';
import { CreateCollectionDto } from '../../../src/modules/collections/application/dto/createCollectionDto';

/**
 * Los formularios mandan los campos opcionales vacíos como `''`. Con
 * `@IsOptional()` eso no basta: `''` no es `null` ni `undefined` y falla la
 * validación de UUID, con un 400 que el usuario no puede explicar.
 */
describe('Campos opcionales vacíos en los DTO de tesorería', () => {
  const validar = async <T extends object>(clase: new () => T, datos: Record<string, unknown>) => {
    const instancia = plainToInstance(clase, datos);
    const errores = await validate(instancia as object, { whitelist: true, forbidNonWhitelisted: true });
    return { instancia: instancia as Record<string, any>, errores };
  };

  it('acepta treasuryAccountId vacío en el pago de un gasto', async () => {
    const { instancia, errores } = await validar(PayExpenseDto, {
      amount: 118,
      treasuryAccountId: '',
    });
    expect(errores).toHaveLength(0);
    expect(instancia.treasuryAccountId).toBeUndefined();
  });

  it('acepta treasuryAccountId vacío en un cobro', async () => {
    const { instancia, errores } = await validar(CreateCollectionDto, {
      customerName: 'Cliente SAC',
      amount: 100,
      treasuryAccountId: '   ',
    });
    expect(errores).toHaveLength(0);
    expect(instancia.treasuryAccountId).toBeUndefined();
  });

  it('sigue rechazando un identificador que no es UUID', async () => {
    const { errores } = await validar(PayExpenseDto, {
      amount: 118,
      treasuryAccountId: 'no-es-uuid',
    });
    expect(errores.length).toBeGreaterThan(0);
  });

  it('acepta un UUID válido', async () => {
    const { instancia, errores } = await validar(PayExpenseDto, {
      amount: 118,
      treasuryAccountId: '3f1a9d2e-1c4b-4f6a-9d3e-2b8c7a5e4d10',
    });
    expect(errores).toHaveLength(0);
    expect(instancia.treasuryAccountId).toBe('3f1a9d2e-1c4b-4f6a-9d3e-2b8c7a5e4d10');
  });
});
