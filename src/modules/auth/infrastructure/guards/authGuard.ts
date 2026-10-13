import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import {
  TOKEN_SERVICE_PORT,
  type TokenServicePort,
} from '../../application/ports/tokenServicePort';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    @Inject(TOKEN_SERVICE_PORT)
    private readonly tokenService: TokenServicePort,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers['authorization'];

    if (!authHeader || typeof authHeader !== 'string') {
      throw new UnauthorizedException('Encabezado de autorización ausente.');
    }

    const [scheme, token] = authHeader.split(' ');
    if (scheme !== 'Bearer' || !token) {
      throw new UnauthorizedException('Formato de token Bearer inválido.');
    }

    const payload = this.tokenService.verifyToken(token);
    if (!payload) {
      throw new UnauthorizedException('Token de acceso inválido o expirado.');
    }

    request.user = payload;
    return true;
  }
}
