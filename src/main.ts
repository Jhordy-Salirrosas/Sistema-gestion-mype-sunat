import { NestFactory } from '@nestjs/core';
import { ValidationPipe, BadRequestException } from '@nestjs/common';
import { AppModule } from './appModule';
import { HttpExceptionFilter } from './common/filters';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // CORS: el frontend de Vite corre en otro origen durante el desarrollo y en
  // Vercel en produccion. Sin esto el navegador bloquea toda peticion.
  app.enableCors({
    origin: (process.env.CORS_ORIGIN ?? 'http://localhost:5173').split(','),
    credentials: true,
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

  await app.listen(process.env.PORT ?? 3000);
  console.log(
    `Servidor corriendo en: http://localhost:${process.env.PORT ?? 3000}`,
  );
}
bootstrap();
