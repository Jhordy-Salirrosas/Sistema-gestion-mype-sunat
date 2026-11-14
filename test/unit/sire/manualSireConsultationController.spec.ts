import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  UnauthorizedException,
  ValidationPipe,
} from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate, type ValidationError } from 'class-validator';
import { ManualSireConsultationDto } from '../../../src/modules/sire/application/dto/manualSireConsultationDto';
import { SimulateManualSireConsultationUseCase } from '../../../src/modules/sire/application/use-cases/simulateManualSireConsultationUseCase';
import { ManualSireConsultationController } from '../../../src/modules/sire/infrastructure/controllers/manualSireConsultationController';
import type { IUserRepositoryPort } from '../../../src/modules/auth/domain/ports/userRepositoryPort';

describe('ManualSireConsultationController', () => {
  const simulator = {
    execute: jest.fn().mockReturnValue({ mode: 'SIMULATED' }),
  } as unknown as SimulateManualSireConsultationUseCase;

  const users = {
    findCompanyById: jest.fn(),
  } as unknown as IUserRepositoryPort;

  const controller = new ManualSireConsultationController(simulator, users);

  const session = {
    sub: 'user-id',
    email: 'demo@example.test',
    companyId: 'company-id',
    role: 'ADMIN',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (users.findCompanyById as jest.Mock).mockResolvedValue({
      id: 'company-id',
      ruc: '20100070970',
      isActive: true,
    });
  });

  it('requires an authenticated company and never forwards the SOL password', async () => {
    const dto = {
      ruc: '20100070970',
      period: '202611',
      solPassword: 'fake-sol-password',
    };

    await expect(controller.consult(dto, session)).resolves.toEqual({
      mode: 'SIMULATED',
    });
    expect(simulator.execute).toHaveBeenCalledWith({
      ruc: dto.ruc,
      period: dto.period,
    });
    expect(JSON.stringify(simulator.execute.mock.calls)).not.toContain(
      dto.solPassword,
    );
    await expect(controller.consult(dto, undefined)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('rejects a RUC that does not belong to the session company', async () => {
    const dto = {
      ruc: '20601030013',
      period: '202611',
      solPassword: 'fake-sol-password',
    };

    await expect(controller.consult(dto, session)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(simulator.execute).not.toHaveBeenCalled();
  });

  it('rejects a request when the session company cannot be resolved', async () => {
    (users.findCompanyById as jest.Mock).mockResolvedValue(null);

    const dto = {
      ruc: '20100070970',
      period: '202611',
      solPassword: 'fake-sol-password',
    };

    await expect(controller.consult(dto, session)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(simulator.execute).not.toHaveBeenCalled();
  });
});

describe('ManualSireConsultationDto', () => {
  const validInput = {
    ruc: '20100070970',
    period: '202611',
    solPassword: 'fake-sol-password',
  };

  it('accepts a valid RUC, period and non-empty password', async () => {
    const dto = plainToInstance(ManualSireConsultationDto, validInput);
    await expect(validate(dto)).resolves.toHaveLength(0);
  });

  it.each([
    { ruc: '2010', period: '202611', solPassword: 'fake' },
    { ruc: '20100070970', period: '202613', solPassword: 'fake' },
    { ruc: '20100070970', period: '202611', solPassword: '' },
    { ruc: '20100070970', period: '202611', solPassword: 'x'.repeat(129) },
  ])('rejects invalid input without echoing its secret', async (input) => {
    const dto = plainToInstance(ManualSireConsultationDto, input);
    const errors = await validate(dto, {
      validationError: { target: false, value: false },
    });
    const pipe = new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      validationError: { target: false, value: false },
      exceptionFactory: (validationErrors: ValidationError[]) =>
        new BadRequestException(
          validationErrors.map((error) => ({
            field: error.property,
            rule: Object.keys(error.constraints ?? {})[0],
            message: Object.values(error.constraints ?? {})[0],
          })),
        ),
    });

    expect(errors.length).toBeGreaterThan(0);
    try {
      await pipe.transform(input, {
        type: 'body',
        metatype: ManualSireConsultationDto,
      });
      throw new Error('Expected request validation to fail.');
    } catch (error) {
      expect(error).toBeInstanceOf(BadRequestException);
      if (error instanceof BadRequestException) {
        const response = JSON.stringify(error.getResponse());
        expect(response).not.toContain('"target"');
        expect(response).not.toContain('"value"');
        if (input.solPassword) {
          expect(response).not.toContain(input.solPassword);
        }
      }
    }
  });
});
