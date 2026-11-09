import {
  BadRequestException,
  UnauthorizedException,
  ValidationPipe,
} from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate, type ValidationError } from 'class-validator';
import { ManualSireConsultationDto } from '../../../src/modules/sire/application/dto/manualSireConsultationDto';
import { SimulateManualSireConsultationUseCase } from '../../../src/modules/sire/application/use-cases/simulateManualSireConsultationUseCase';
import { ManualSireConsultationController } from '../../../src/modules/sire/infrastructure/controllers/manualSireConsultationController';

describe('ManualSireConsultationController', () => {
  const simulator = {
    execute: jest.fn().mockReturnValue({ mode: 'SIMULATED' }),
  } as unknown as SimulateManualSireConsultationUseCase;
  const controller = new ManualSireConsultationController(simulator);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('requires an authenticated company and never forwards the SOL password', () => {
    const dto = {
      ruc: '20100070970',
      period: '202611',
      solPassword: 'fake-sol-password',
    };

    expect(
      controller.consult(dto, {
        sub: 'user-id',
        email: 'demo@example.test',
        companyId: 'company-id',
        role: 'ADMIN',
      }),
    ).toEqual({ mode: 'SIMULATED' });
    expect(simulator.execute).toHaveBeenCalledWith({
      ruc: dto.ruc,
      period: dto.period,
    });
    expect(JSON.stringify(simulator.execute.mock.calls)).not.toContain(
      dto.solPassword,
    );
    expect(() => controller.consult(dto, undefined)).toThrow(
      UnauthorizedException,
    );
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
