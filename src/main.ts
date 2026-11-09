import { NestFactory } from '@nestjs/core';
import { ValidationPipe, BadRequestException } from '@nestjs/common';
import { AppModule } from './appModule';
import { HttpExceptionFilter } from './common/filters';
import { httpsOnlyMiddleware } from './common/middleware/httpsOnlyMiddleware';

export async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  if (process.env.NODE_ENV === 'production') {
    app.getHttpAdapter().getInstance().set('trust proxy', 1);
    app.use(httpsOnlyMiddleware);
  }

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
    /**
     * `Content-Disposition` tiene que ser LEGIBLE desde el navegador.
     *
     * Por defecto CORS solo deja ver unas pocas cabeceras, y esta no está entre
     * ellas: el front no podía leer el nombre del archivo que mandaba el backend
     * y guardaba las descargas como "comprobante.xml", "comprobante.pdf" y
     * "comprobante.cdr.xml". El backend sí enviaba el nombre correcto
     * (20601234567-01-F001-32.xml); lo que faltaba era exponerlo.
     * Se detectó probando la descarga en el navegador el 31-10.
     */
    exposedHeaders: ['Content-Disposition'],
  });

  app.useGlobalFilters(new HttpExceptionFilter());

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      validationError: { target: false, value: false },
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

if (require.main === module) {
  void bootstrap();
}
