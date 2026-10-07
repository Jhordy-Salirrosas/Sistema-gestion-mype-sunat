import { NestFactory } from '@nestjs/core';
import { ValidationPipe, BadRequestException } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

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
          const message = error.constraints ? error.constraints[rule] : 'Dato inválido';
          
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
