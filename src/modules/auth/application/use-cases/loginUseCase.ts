import { SessionMembershipService } from '../services/sessionMembershipService';
import { Inject, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { LoginDto } from '../dto/loginDto';
import type { AuthResponseDto } from '../dto/authResponseDto';
import {
  USER_REPOSITORY_PORT,
  type UserRepositoryPort,
} from '../../domain/ports/userRepositoryPort';
import { HASHER_PORT, type HasherPort } from '../../domain/ports/hasherPort';
import {
  TOKEN_SERVICE_PORT,
  type TokenServicePort,
} from '../../domain/ports/tokenServicePort';

@Injectable()
export class LoginUseCase {
  private readonly logger = new Logger(LoginUseCase.name);

  constructor(
    @Inject(USER_REPOSITORY_PORT)
    private readonly userRepository: UserRepositoryPort,
    @Inject(HASHER_PORT)
    private readonly hasher: HasherPort,
    @Inject(TOKEN_SERVICE_PORT)
    private readonly tokenService: TokenServicePort,
    private readonly membership: SessionMembershipService,
  ) {}

  async execute(dto: LoginDto): Promise<AuthResponseDto> {
    const record = await this.userRepository.findByEmail(dto.email);
    if (!record) {
      throw new UnauthorizedException('Credenciales de acceso incorrectas.');
    }

    const { user, passwordHash } = record;
    if (!user.isActive) {
      // Mismo mensaje que credenciales inválidas: uno distinto revelaría a
      // quien llama que la cuenta existe.
      throw new UnauthorizedException('Credenciales de acceso incorrectas.');
    }

    let isValid = false;
    try {
      isValid = await this.hasher.compare(dto.password, passwordHash);
    } catch {
      // Un hash ilegible no autoriza: se trata como credencial inválida.
      isValid = false;
    }

    if (!isValid) {
      throw new UnauthorizedException('Credenciales de acceso incorrectas.');
    }

    const session = await this.membership.resolve({ sub:user.id,email:user.email,companyId:user.companyId,role:user.role });

    const expiresInSeconds = 900; // 15 minutos
    const accessToken = this.tokenService.signToken(
      {
        sub: user.id,
        email: user.email,
        companyId: user.companyId,
        role: session.role,
      },
      expiresInSeconds,
    );

    let rawRefreshToken: string | undefined;
    if (typeof this.tokenService.generateRefreshToken === 'function') {
      rawRefreshToken = this.tokenService.generateRefreshToken();
      const tokenHash = this.tokenService.hashToken(rawRefreshToken);
      const expiresAt = new Date(Date.now() + 7 * 24 * 3600 * 1000);
      if (typeof this.userRepository.saveRefreshToken === 'function') {
        try {
          await this.userRepository.saveRefreshToken(user.id, tokenHash, expiresAt);
        } catch {
          // Si la BD falla al guardar el refresh token, continuar para entregar la sesión
        }
      }
    }

    // La ficha de la empresa solo alimenta los datos de cabecera y el selector
    // de tenant de la respuesta: el vínculo del usuario con la empresa ya va en
    // el token. Si no se puede leer —por ejemplo, con el esquema a medio migrar
    // durante un corte— la sesión se entrega igual, en vez de devolver una
    // empresa inventada o tumbar el inicio de sesión.
    let company: { id: string; ruc: string; legalName: string } | null = null;
    let companies:
      | Array<{ tenantId: string; ruc: string; razonSocial: string }>
      | undefined;
    try {
      const ficha = await this.userRepository.findCompanyById(user.companyId);
      if (ficha) {
        company = ficha;
        companies = [
          {
            tenantId: ficha.id,
            ruc: ficha.ruc,
            razonSocial: ficha.legalName,
          },
        ];
      }
    } catch (error) {
      this.logger.warn(
        `No se pudo leer la ficha de la empresa ${user.companyId}: ${(error as Error).message}`,
      );
    }

    return {
      accessToken,
      tokenType: 'Bearer',
      expiresInSeconds,
      refreshToken: rawRefreshToken,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: session.role,
        companyId: user.companyId,
        companyRuc: company?.ruc?.replace(/[\r\n\t ]/g, ''),
        companyLegalName: company?.legalName,
      },
      companies,
    };
  }
}