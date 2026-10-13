
import { Test, TestingModule } from '@nestjs/testing';
import { HealthController } from './health.controller';
import { PrismaService } from '../../prisma/prisma.service';

describe('HealthController', () => {
  let controller: HealthController;

  const mockPrismaService = {
    $queryRaw: jest.fn(),
    $queryRawUnsafe: jest.fn(),
    $connect: jest.fn(),
    $disconnect: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    controller = module.get<HealthController>(HealthController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
