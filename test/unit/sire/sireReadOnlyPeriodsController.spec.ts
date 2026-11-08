import {
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import type { PrismaService } from '../../../src/database/prismaService';
import type { IUserRepositoryPort } from '../../../src/modules/auth/domain/ports/userRepositoryPort';
import type { SolCredentialCipherPort } from '../../../src/modules/auth/domain/ports/solCredentialCipherPort';
import type { QueueService } from '../../../src/modules/resilience/infrastructure/queue/queue.service';
import { SireReadOnlyPeriodsController } from '../../../src/modules/sire/infrastructure/controllers/sireReadOnlyPeriodsController';
import type { SireReadOnlyPeriodsClient } from '../../../src/modules/sire/infrastructure/sunat/sireReadOnlyPeriodsClient';

describe('SireReadOnlyPeriodsController', () => {
  const company = {
    id: 'company-id',
    ruc: '20100070970',
    isActive: true,
  };
  const users = {
    findCompanyById: jest.fn(),
  } as unknown as IUserRepositoryPort;
  const sireClient = {
    assertConfigured: jest.fn(),
  } as unknown as SireReadOnlyPeriodsClient;
  const prisma = {
    sirePeriodQuery: {
      create: jest.fn(),
      update: jest.fn(),
      findFirst: jest.fn(),
    },
  } as unknown as PrismaService;
  const queue = {
    enqueueSirePeriods: jest.fn(),
  } as unknown as QueueService;
  const credentialCipher = {
    encrypt: jest.fn(() => 'opaque-encrypted-credentials'),
    decrypt: jest.fn(),
  } as unknown as SolCredentialCipherPort;
  const controller = new SireReadOnlyPeriodsController(
    users,
    sireClient,
    prisma,
    queue,
    credentialCipher,
  );
  const dto = {
    bookCode: '140000' as const,
    solUser: 'FAKEUSER',
    solPassword: 'fake-sol-password',
  };
  const user = {
    sub: 'user-id',
    email: 'demo@example.test',
    companyId: 'company-id',
    role: 'ADMIN',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (users.findCompanyById as jest.Mock).mockResolvedValue(company);
    (prisma.sirePeriodQuery.create as jest.Mock).mockResolvedValue({});
    (queue.enqueueSirePeriods as jest.Mock).mockResolvedValue('job-id');
  });

  it('creates a pending job using tenant RUC and encrypts SOL credentials in the payload', async () => {
    const response = await controller.getPeriods(dto, user);

    expect(response).toMatchObject({ status: 'PENDING' });
    expect(response.messageId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
    expect(users.findCompanyById).toHaveBeenCalledWith(user.companyId);
    expect(sireClient.assertConfigured).toHaveBeenCalled();
    expect(credentialCipher.encrypt).toHaveBeenCalledWith(
      JSON.stringify({
        solUser: dto.solUser,
        solPassword: dto.solPassword,
      }),
    );
    expect(prisma.sirePeriodQuery.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        id: response.messageId,
        company_id: company.id,
        book_code: dto.bookCode,
      }),
    });

    const queuedPayload = (queue.enqueueSirePeriods as jest.Mock).mock
      .calls[0][0];
    expect(queuedPayload).toMatchObject({
      messageId: response.messageId,
      companyId: company.id,
      ruc: company.ruc,
      bookCode: dto.bookCode,
      encryptedSolCredentials: 'opaque-encrypted-credentials',
    });
    expect(queuedPayload.encryptedSolCredentials).not.toContain(
      dto.solPassword,
    );
    expect(queuedPayload.encryptedSolCredentials).not.toContain(dto.solUser);
  });

  it('rejects requests without an authenticated tenant', async () => {
    await expect(controller.getPeriods(dto, undefined)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(users.findCompanyById).not.toHaveBeenCalled();
  });

  it('rejects missing or inactive companies without enqueueing', async () => {
    (users.findCompanyById as jest.Mock).mockResolvedValueOnce(null);
    await expect(controller.getPeriods(dto, user)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(queue.enqueueSirePeriods).not.toHaveBeenCalled();
  });

  it('does not enqueue while the integration is disabled', async () => {
    (sireClient.assertConfigured as jest.Mock).mockImplementationOnce(() => {
      throw new ServiceUnavailableException('disabled');
    });

    await expect(controller.getPeriods(dto, user)).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
    expect(prisma.sirePeriodQuery.create).not.toHaveBeenCalled();
    expect(queue.enqueueSirePeriods).not.toHaveBeenCalled();
  });

  it('marks the request failed if queue publication fails', async () => {
    (queue.enqueueSirePeriods as jest.Mock).mockRejectedValueOnce(
      new ServiceUnavailableException(),
    );

    await expect(controller.getPeriods(dto, user)).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
    expect(prisma.sirePeriodQuery.update).toHaveBeenCalledWith({
      where: { id: expect.any(String) },
      data: expect.objectContaining({
        status: 'FAILED',
        error_code: 'QUEUE_ENQUEUE_FAILED',
      }),
    });
  });

  it('returns completed results only to the requesting tenant', async () => {
    (prisma.sirePeriodQuery.findFirst as jest.Mock).mockResolvedValue({
      id: 'c5a31a3d-460a-46e7-9a3e-9057a31d0098',
      company_id: user.companyId,
      book_code: '140000',
      status: 'COMPLETED',
      result: '{"periodos":["202601"]}',
      created_at: new Date('2026-11-08T12:00:00Z'),
      completed_at: new Date('2026-11-08T12:01:00Z'),
    });

    await expect(
      controller.getStatus('c5a31a3d-460a-46e7-9a3e-9057a31d0098', user),
    ).resolves.toMatchObject({
      status: 'COMPLETED',
      periods: { periodos: ['202601'] },
    });
    expect(prisma.sirePeriodQuery.findFirst).toHaveBeenCalledWith({
      where: {
        id: 'c5a31a3d-460a-46e7-9a3e-9057a31d0098',
        company_id: user.companyId,
      },
    });
  });

  it('does not reveal a request belonging to a different tenant', async () => {
    (prisma.sirePeriodQuery.findFirst as jest.Mock).mockResolvedValue(null);

    await expect(
      controller.getStatus('c5a31a3d-460a-46e7-9a3e-9057a31d0098', user),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
