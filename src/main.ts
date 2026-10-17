import { NestFactory } from '@nestjs/core';
import { ValidationPipe, BadRequestException } from '@nestjs/common';
import { AppModule } from './appModule';
import { HttpExceptionFilter } from './common/filters';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const extraOrigins = process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(',').map((o) => o.trim())
    : [];

  // Habilitar CORS con soporte para Vercel (*.vercel.app), localhost y credenciales
  app.enableCors({
    origin: [
      'http://localhost:5173',
      'http://localhost:3000',
      /\.vercel\.app$/, // Permite cualquier URL y preview de Vercel
      ...extraOrigins,
    ],
    credentials: true, // Requerido para cookies HttpOnly
  });

  app.useGlobalFilters(new HttpExceptionFilter());

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // elimina propiedades no declaradas en el DTO
      forbidNonWhitelisted: true, // rechaza si mandan campos extra
      transform: true, // convierte tipos automáticamente
      exceptionFactory: (errors) => {
        // Mapear los errores al formato exigido por HU-02: [{ field, rule, message }]
        const formattedErrors = errors.map((error) => {
          // Extraer la primera regla de validación que haya fallado
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

        // Lanzar el HTTP 400 Bad Request con nuestro array personalizado
        return new BadRequestException(formattedErrors);
      },
    }),
  );

  const port = process.env.PORT ?? 3000;
  await app.listen(port, '0.0.0.0');
  console.log(`Servidor corriendo en el puerto: ${port}`);
}
bootstrap();