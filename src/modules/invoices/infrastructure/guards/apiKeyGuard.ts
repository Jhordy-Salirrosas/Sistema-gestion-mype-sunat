import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';

@Injectable()
export class ApiKeyGuard implements CanActivate {
  private readonly apiKey = process.env.API_KEY;

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const providedKey = request.headers['x-api-key'];

    if (!this.apiKey) {
      throw new UnauthorizedException('API_KEY no configurada en el servidor');
    }

    if (!providedKey || providedKey !== this.apiKey) {
      throw new UnauthorizedException('API Key inválida o ausente');
    }

    return true;
  }
}
