import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe, BadRequestException } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../../../src/app.module';

describe('InvoicesController (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    // 1. Inyectamos una API Key ficticia para engañar al guard y poder pasar
    process.env.API_KEY = 'super-secret-test-key';

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    
    // 2. Replicamos la configuración exacta de nuestro main.ts para que los pipes funcionen igual
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        exceptionFactory: (errors) => {
          // Solución TS7006: Asignamos tipado any explícito al error
          const formattedErrors = errors.map((error: any) => {
            const rule = Object.keys(error.constraints || {})[0];
            const message = error.constraints ? error.constraints[rule] : 'Dato inválido';
            return {
              field: error.property,
              rule: rule,
              message: message,
            };
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

  it('/api/v1/invoices (POST) - Debe rechazar peticiones inválidas con formato estructurado (Criterio 5)', async () => {
    // 3. Preparamos nuestro payload malicioso/inválido
    const invalidPayload = {
      ruc_emisor: '12345678901', // Falla: Matemáticamente incorrecto (Módulo 11)
      serie: 'B001',             // Falla: Es Boleta pero declararemos que es Factura
      tipo_comprobante: '01',    // Factura
      correlativo: 999999999,    // Falla: Excede el máximo
      monto_total: -100,         // Falla: Monto negativo
      fecha_emision: 'ayer',     // Falla: No es un formato ISO Date
      // Omitimos 'payload_ubl' intencionalmente para provocar falla IsNotEmpty
    };

    // 4. Disparamos el misil contra nuestro servidor local usando SuperTest
    const response = await request(app.getHttpServer() as any)
      .post('/api/v1/invoices')
      .set('x-api-key', 'super-secret-test-key') // Saltamos el ApiKeyGuard
      .send(invalidPayload)
      .expect(400); // 5. AFIRMAMOS QUE DEBE DEVOLVER HTTP 400 Bad Request

    // 6. Verificamos la estructura estricta del Criterio 5: [{field, rule, message}]
    const errors = response.body.message;
    expect(Array.isArray(errors)).toBe(true);
    
    // Solución TS7006: Tipado explícito a 'any'
    errors.forEach((err: any) => {
      expect(err).toHaveProperty('field');
      expect(err).toHaveProperty('rule');
      expect(err).toHaveProperty('message');
    });

    // Verificamos que se hayan detectado los campos infractores
    const failedFields = errors.map((err: any) => err.field);
    expect(failedFields).toContain('ruc_emisor');
    expect(failedFields).toContain('serie');
    expect(failedFields).toContain('monto_total');
    expect(failedFields).toContain('fecha_emision');
    expect(failedFields).toContain('payload_ubl'); // El campo faltante fue detectado
  });
});
