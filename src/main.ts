import { NestFactory } from '@nestjs/core';
import { ValidationPipe, BadRequestException } from '@nestjs/common';
import { AppModule } from './appModule';
import { HttpExceptionFilter } from './common/filters';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const extraOrigins = process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(',').map((o) => o.trim())
    : [];

  // =========================================================================
  // CONFIGURACIÓN CORS PARA VERCEL (FRONTEND MULTI-TENANT)
  // =========================================================================
  app.enableCors({
    origin: [
      'http://localhost:5173',
      'http://localhost:3000',
      'https://fronted-sistema-mype-sunat.vercel.app',
      /\.vercel\.app$/,
      ...extraOrigins,
    ],
    credentials: true,
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Tenant-Id', // Requerido por el interceptor del frontend de Carlos
      'Accept',
    ],
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  });

  app.useGlobalFilters(new HttpExceptionFilter());

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      exceptionFactory: (errors) => {
        const formattedErrors = errors.map((error) => {
          const rule = Object.keys(error.constraints || {})[0];
          const message = error.constraints
            ? error.constraints[rule]
            : 'Dato inválido';

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

  const port = process.env.PORT ?? 3000;
  await app.listen(port, '0.0.0.0');
  console.log(`Servidor corriendo en el puerto: ${port}`);
}
bootstrap();