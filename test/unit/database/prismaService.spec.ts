import { PrismaService } from '../../../src/database/prismaService';

describe('PrismaService', () => {
  let service: PrismaService;

  beforeEach(() => {
    service = new PrismaService();
  });

  it('debería estar definido y listo para instanciarse', () => {
    expect(service).toBeDefined();
  });
});
