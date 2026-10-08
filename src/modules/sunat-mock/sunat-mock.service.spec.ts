import { Test, TestingModule } from '@nestjs/testing';
import { SunatMockService } from './sunat-mock.service';

describe('SunatMockService', () => {
  let service: SunatMockService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [SunatMockService],
    }).compile();

    service = module.get<SunatMockService>(SunatMockService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
