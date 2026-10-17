import {
  BadRequestException,
  INestApplication,
  ValidationPipe,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../../src/appModule';
import { USER_REPOSITORY_PORT } from '../../src/modules/auth/domain/ports/userRepositoryPort';
import { UserEntity } from '../../src/modules/auth/domain/entities/userEntity';
import { RefreshTokenEntity } from '../../src/modules/auth/domain/entities/refreshTokenEntity';
import { PrismaService } from '../../src/database/prismaService';
import { QueueService } from '../../src/modules/resilience/infrastructure/queue/queue.service';

describe('AuthFlow (e2e)', () => {
  let app: INestApplication<App>;

  // Almacenamiento en memoria para simular persistencia
  const companies = new Map<string, any>();
  const users = new Map<string, { user: any; passwordHash: string }>();
  const refreshTokens = new Map<string, any>();

  const inMemoryUserRepo = {
    findByEmail: jest.fn(async (email: string) => {
      const entry = users.get(email.toLowerCase());
      if (!entry) return null;
      return {
        user: entry.user,
        passwordHash: entry.passwordHash,
      };
    }),

    findById: jest.fn(async (id: string, companyId?: string) => {
      for (const entry of users.values()) {
        if (entry.user.id === id) {
          if (companyId && entry.user.companyId !== companyId) return null;
          return entry.user;
        }
      }
      return null;
    }),

    findByRuc: jest.fn(async (ruc: string) => {
      return companies.get(ruc) || null;
    }),

    findCompanyById: jest.fn(async (id: string) => {
      for (const c of companies.values()) {
        if (c.id === id) return c;
      }
      return null;
    }),

    createUserWithCompany: jest.fn(async (params: any) => {
      companies.set(params.company.ruc, params.company);
      users.set(params.user.email.toLowerCase(), {
        user: params.user,
        passwordHash: params.passwordHash,
      });
      if (params.initialRefreshToken) {
        refreshTokens.set(params.initialRefreshToken.tokenHash, {
          id: 'rt-1',
          userId: params.user.id,
          tokenHash: params.initialRefreshToken.tokenHash,
          expiresAt: params.initialRefreshToken.expiresAt,
          isRevoked: false,
        });
      }
      return {
        user: params.user,
        company: params.company,
      };
    }),

    saveRefreshToken: jest.fn(async (userId: string, tokenHash: string, expiresAt: Date) => {
      const entity = new RefreshTokenEntity({
        id: `rt-${Date.now()}`,
        userId,
        tokenHash,
        expiresAt,
        isRevoked: false,
      });
      refreshTokens.set(tokenHash, entity);
      return entity;
    }),

    findRefreshToken: jest.fn(async (tokenHash: string) => {
      const token = refreshTokens.get(tokenHash);
      return token ? new RefreshTokenEntity(token) : null;
    }),

    revokeRefreshToken: jest.fn(async (tokenHash: string) => {
      const token = refreshTokens.get(tokenHash);
      if (token) refreshTokens.set(tokenHash, token.revoke());
    }),

    revokeAllUserRefreshTokens: jest.fn(async (userId: string) => {
      for (const [hash, token] of refreshTokens.entries()) {
        if (token.userId === userId) {
          refreshTokens.set(hash, token.revoke());
        }
      }
    }),

    updatePassword: jest.fn(async (userId: string, newPasswordHash: string) => {
      for (const entry of users.values()) {
        if (entry.user.id === userId) entry.passwordHash = newPasswordHash;
      }
    }),

    updateProfile: jest.fn(async (userId: string, fullName: string) => {
      for (const entry of users.values()) {
        if (entry.user.id === userId) {
          entry.user.fullName = fullName;
          return new UserEntity(entry.user);
        }
      }
      throw new Error('Usuario no encontrado');
    }),
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(USER_REPOSITORY_PORT)
      .useValue(inMemoryUserRepo)
      .overrideProvider(PrismaService)
      .useValue({
        $connect: jest.fn(),
        $disconnect: jest.fn(),
        $transaction: jest.fn(),
      })
      .overrideProvider(QueueService)
      .useValue({
        enqueueInvoiceInTx: jest.fn(),
      })
      .compile();

    app = moduleFixture.createNestApplication();

    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        exceptionFactory: (errors) => {
          const formattedErrors = errors.map((error) => {
            const rule = Object.keys(error.constraints || {})[0];
            const message = error.constraints ? error.constraints[rule] : 'Dato inválido';
            return { field: error.property, rule, message };
          });
          return new BadRequestException(formattedErrors);
        },
      }),
    );

    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  let sessionToken: string;
  let sessionRefreshToken: string;

  it('1. POST /api/v1/auth/register - Registra una nueva MYPE y retorna tokens', async () => {
    const registerPayload = {
      ruc: '20100070970',
      legalName: 'MYPE INNOVADORA S.A.C.',
      solUser: 'MODDATOS',
      solPassword: 'PasswordSol123!',
      fullName: 'Carlos Administrador',
      email: 'admin@mypeinnovadora.pe',
      password: 'Password123!#',
    };

    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send(registerPayload)
      .expect(201);

    expect(res.body.accessToken).toBeDefined();
    expect(res.body.user.email).toBe('admin@mypeinnovadora.pe');
    expect(res.body.user.role).toBe('ADMIN');

    // Extraer cookie
    const cookies = res.headers['set-cookie'];
    expect(cookies).toBeDefined();
    const cookieHeader = Array.isArray(cookies) ? cookies.join('; ') : cookies;
    expect(cookieHeader).toContain('refreshToken=');

    const match = cookieHeader.match(/refreshToken=([^;]+)/);
    sessionRefreshToken = match ? match[1] : '';
  });

  it('2. POST /api/v1/auth/login - Autentica al usuario registrado y genera cookies', async () => {
    const loginPayload = {
      email: 'admin@mypeinnovadora.pe',
      password: 'Password123!#',
    };

    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send(loginPayload)
      .expect(200);

    expect(res.body.accessToken).toBeDefined();
    sessionToken = res.body.accessToken;

    const cookies = res.headers['set-cookie'];
    const cookieHeader = Array.isArray(cookies) ? cookies.join('; ') : cookies;
    expect(cookieHeader).toContain('refreshToken=');
    const match = cookieHeader.match(/refreshToken=([^;]+)/);
    sessionRefreshToken = match ? match[1] : '';
  });

  it('3. GET /api/v1/auth/profile - Acceso protegido con Bearer token', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/auth/profile')
      .set('Authorization', `Bearer ${sessionToken}`)
      .expect(200);

    expect(res.body.email).toBe('admin@mypeinnovadora.pe');
    expect(res.body.company.ruc).toBe('20100070970');
  });

  it('4. POST /api/v1/auth/refresh - Rota el token enviando cookie HttpOnly', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .set('Cookie', `refreshToken=${sessionRefreshToken}`)
      .expect(200);

    expect(res.body.accessToken).toBeDefined();
    sessionToken = res.body.accessToken;

    const cookies = res.headers['set-cookie'];
    const cookieHeader = Array.isArray(cookies) ? cookies.join('; ') : cookies;
    expect(cookieHeader).toContain('refreshToken=');
    const match = cookieHeader.match(/refreshToken=([^;]+)/);
    const newRefreshToken = match ? match[1] : '';
    expect(newRefreshToken).not.toBe(sessionRefreshToken);
    sessionRefreshToken = newRefreshToken;
  });

  it('5. POST /api/v1/auth/logout - Revoca sesión y limpia cookie', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/logout')
      .set('Cookie', `refreshToken=${sessionRefreshToken}`)
      .expect(200);

    expect(res.body.success).toBe(true);
    const cookies = res.headers['set-cookie'];
    const cookieHeader = Array.isArray(cookies) ? cookies.join('; ') : cookies;
    expect(cookieHeader).toContain('refreshToken=;');
  });

  it('6. GET /api/v1/auth/profile - Rechaza 401 si no hay token Bearer', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/auth/profile')
      .expect(401);
  });
});
