import { Test, TestingModule } from '@nestjs/testing';
import { HttpException, HttpStatus } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';

// Mock @supabase/supabase-js so we never hit a real database
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        limit: jest.fn(() => Promise.resolve({ data: [], error: null })),
      })),
    })),
  })),
}));

describe('AppController', () => {
  let appController: AppController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [AppService],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  afterEach(() => {
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_KEY;
  });

  describe('checkSupabaseConnection', () => {
    it('should throw 500 when credentials are missing', async () => {
      delete process.env.SUPABASE_URL;
      delete process.env.SUPABASE_KEY;

      await expect(appController.checkSupabaseConnection()).rejects.toThrow(
        HttpException,
      );

      try {
        await appController.checkSupabaseConnection();
      } catch (e: any) {
        expect(e.getStatus()).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
        expect(e.message).toContain('Faltan credenciales');
      }
    });

    it('should return 200 OK when Supabase connection succeeds', async () => {
      process.env.SUPABASE_URL = 'https://fake.supabase.co';
      process.env.SUPABASE_KEY = 'fake-key';

      const result = await appController.checkSupabaseConnection();

      expect(result).toHaveProperty('status', '200 OK');
      expect(result).toHaveProperty('message', 'Conexión a Supabase verificada exitosamente');
      expect(result).toHaveProperty('timestamp');
    });
  });
});
