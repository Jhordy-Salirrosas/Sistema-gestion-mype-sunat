import { BadRequestException, ConflictException } from '@nestjs/common';
import { CreateAccountingAccountUseCase } from '../../../src/modules/accounting/application/use-cases/createAccountingAccountUseCase';

describe('CreateAccountingAccountUseCase', () => {
  it('crea una subcuenta con padre existente', async () => {
    const repository = {
      findAccounts: jest.fn().mockResolvedValue([{ code: '20111' }]),
      createAccount: jest.fn().mockImplementation((a) => Promise.resolve(a)),
    };
    const useCase = new CreateAccountingAccountUseCase(repository as never);
    const cuenta = await useCase.execute({ code: '2011101', name: 'Almacén principal', parentCode: '20111' });
    expect(cuenta.code).toBe('2011101');
    expect(cuenta.nature).toBe('Deudora');
  });

  it('rechaza códigos duplicados y padres inexistentes', async () => {
    const repository = { findAccounts: jest.fn().mockResolvedValue([{ code: '20111' }]), createAccount: jest.fn() };
    const useCase = new CreateAccountingAccountUseCase(repository as never);
    await expect(useCase.execute({ code: '20111', name: 'Duplicada' })).rejects.toBeInstanceOf(ConflictException);
    await expect(useCase.execute({ code: '2011101', name: 'Sin padre', parentCode: '99999' })).rejects.toBeInstanceOf(BadRequestException);
  });
});
