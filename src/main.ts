import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // elimina propiedades no declaradas en el DTO
      forbidNonWhitelisted: true, // rechaza si mandan campos extra
      transform: true, // convierte tipos automáticamente
    }),
  );

  await app.listen(process.env.PORT ?? 3000);
  console.log(
    `Servidor corriendo en: http://localhost:${process.env.PORT ?? 3000}`,
  );
}
bootstrap();
