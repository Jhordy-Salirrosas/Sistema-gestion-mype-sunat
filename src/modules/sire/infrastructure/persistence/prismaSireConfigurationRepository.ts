import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ClientSafeHttpException } from '../../../../common/exceptions';
import { PrismaService } from '../../../../database/prismaService';
import {
  SOL_CREDENTIAL_CIPHER,
  type SolCredentialCipherPort,
} from '../../../auth/domain/ports/solCredentialCipherPort';
import { SolCredentialCipherUnavailableError } from '../../../auth/infrastructure/security/solCredentialCipher';
import type {
  ISireConfigurationRepositoryPort,
  SireConfigurationCredentials,
  SireConfigurationResolved,
} from '../../domain/ports/sireConfigurationRepositoryPort';

/**
 * Adaptador de la configuración SIRE sobre Prisma.
 *
 * Es el ÚNICO punto donde el texto plano de las credenciales se convierte en
 * cifrado y viceversa: el resto de la aplicación solo ve valores planos a
 * través del puerto y nunca toca el texto cifrado.
 */
@Injectable()
export class PrismaSireConfigurationRepository
  implements ISireConfigurationRepositoryPort
{
  private readonly logger = new Logger(PrismaSireConfigurationRepository.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(SOL_CREDENTIAL_CIPHER)
    private readonly credentialCipher: SolCredentialCipherPort,
  ) {}

  async save(
    companyId: string,
    credentials: SireConfigurationCredentials,
  ): Promise<void> {
    try {
      await this.persist(companyId, credentials);
    } catch (error) {
      const prismaCode = this.prismaCode(error);
      this.logger.error(
        `No se pudo guardar SireConfiguration (companyId=${companyId}, error=${this.errorName(error)}, prismaCode=${prismaCode ?? 'n/a'}).`,
      );

      if (error instanceof SolCredentialCipherUnavailableError) {
        throw new ClientSafeHttpException(
          503,
          'El cifrado de credenciales SIRE no está configurado en el servidor. Contacta al administrador.',
        );
      }
      if (prismaCode === 'P2003') {
        throw new NotFoundException('La empresa indicada no existe.');
      }
      throw error;
    }
  }

  private async persist(
    companyId: string,
    credentials: SireConfigurationCredentials,
  ): Promise<void> {
    const existing = await this.prisma.sireConfiguration.findUnique({
      where: { companyId },
      select: {
        clientId: true,
        clientSecret: true,
        solUser: true,
        solPasswordEncrypted: true,
      },
    });

    const data = {
      clientId: this.resolveEncrypted(
        existing?.clientId ?? null,
        credentials.clientId,
      ),
      clientSecret: this.resolveEncrypted(
        existing?.clientSecret ?? null,
        credentials.clientSecret,
      ),
      solUser: this.resolveEncrypted(
        existing?.solUser ?? null,
        credentials.solUser,
      ),
      solPasswordEncrypted: this.resolveEncrypted(
        existing?.solPasswordEncrypted ?? null,
        credentials.solPassword,
      ),
    };

    await this.prisma.sireConfiguration.upsert({
      where: { companyId },
      create: { companyId, ...data },
      update: data,
    });
  }

  private prismaCode(error: unknown): string | undefined {
    if (typeof error !== 'object' || error === null || !('code' in error)) {
      return undefined;
    }
    const code = (error as { code?: unknown }).code;
    return typeof code === 'string' && /^P\d{4}$/.test(code) ? code : undefined;
  }

  private errorName(error: unknown): string {
    return error instanceof Error ? error.name : typeof error;
  }

  async findByCompanyId(
    companyId: string,
  ): Promise<SireConfigurationResolved | null> {
    const row = await this.prisma.sireConfiguration.findUnique({
      where: { companyId },
      select: {
        clientId: true,
        clientSecret: true,
        solUser: true,
        solPasswordEncrypted: true,
      },
    });

    if (!row) {
      return null;
    }

    return {
      clientId: this.decrypt(row.clientId),
      clientSecret: this.decrypt(row.clientSecret),
      solUser: this.decrypt(row.solUser),
      solPassword: this.decrypt(row.solPasswordEncrypted),
    };
  }

  async isConfigured(companyId: string): Promise<boolean> {
    const resolved = await this.findByCompanyId(companyId);
    if (!resolved) {
      return false;
    }

    return (
      this.hasValue(resolved.clientId) &&
      this.hasValue(resolved.clientSecret) &&
      this.hasValue(resolved.solUser) &&
      this.hasValue(resolved.solPassword)
    );
  }

  /**
   * Decide el valor cifrado final de una columna.
   *
   * `undefined` conserva lo que había; `null` borra la columna; un texto se
   * cifra de nuevo.
   */
  private resolveEncrypted(
    current: string | null,
    value: string | null | undefined,
  ): string | null {
    if (value === undefined) {
      return current;
    }
    if (value === null) {
      return null;
    }
    return this.credentialCipher.encrypt(value);
  }

  /**
   * Descifra una columna.
   *
   * Un dato cifrado que no se puede leer (clave rotada, fila corrupta) se
   * trata como "no configurado": es preferible decir que falta la
   * configuración a propagar un error que tumba la pantalla.
   */
  private decrypt(value: string | null): string | undefined {
    if (!value) {
      return undefined;
    }
    try {
      return this.credentialCipher.decrypt(value);
    } catch {
      return undefined;
    }
  }

  private hasValue(value: string | undefined): boolean {
    return typeof value === 'string' && value.trim().length > 0;
  }
}
