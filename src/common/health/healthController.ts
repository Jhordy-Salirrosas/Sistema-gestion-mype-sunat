
import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  ServiceUnavailableException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  async check() {
    try {
      // Comprueba que PostgreSQL responda a una consulta real.
      await this.prisma.$queryRaw`SELECT 1`;

      return {
        status: 'ok',
        database: 'connected',
        timestamp: new Date().toISOString(),
      };
    } catch {
      throw new ServiceUnavailableException({
        status: 'error',
        database: 'disconnected',
        message: 'No se pudo conectar con la base de datos',
      });
    }
  }
}
