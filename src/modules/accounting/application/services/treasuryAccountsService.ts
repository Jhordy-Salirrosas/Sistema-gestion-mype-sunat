import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../../database/prismaService';
import { checkAccountCode } from '../../domain/rules/catalogIntegrityRule';
import { AccountingCatalogService } from './accountingCatalogService';
import type { CreateTreasuryAccountDto, UpdateTreasuryAccountDto } from '../dto/treasuryAccountDto';

/**
 * Cuentas de tesorería de la empresa.
 *
 * El catálogo PCGE es global y oficial; esta capa guarda lo que es de la
 * empresa: qué subcuentas usa para caja/banco y con qué nombre las ve el
 * usuario. Antes el asiento de un cobro o pago elegía `'101'` o `'1041'` según
 * el medio de pago, sin intervención del usuario y sin poder auditarse.
 */
@Injectable()
export class TreasuryAccountsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly catalog: AccountingCatalogService,
  ) {}

  async list(companyId: string) {
    const cuentas = await this.prisma.companyTreasuryAccount.findMany({
      where: { company_id: companyId },
      orderBy: [{ is_active: 'desc' }, { kind: 'asc' }, { name: 'asc' }],
    });
    return cuentas.map((c) => this.mapear(c));
  }

  async create(companyId: string, dto: CreateTreasuryAccountDto) {
    const code = dto.code.trim();
    const nombre = dto.name.trim();
    if (!nombre) throw new BadRequestException('El nombre de la cuenta es obligatorio.');

    const issue = checkAccountCode(await this.catalog.catalogo(), code);
    if (issue) throw new BadRequestException(issue.message);

    const yaExiste = await this.prisma.companyTreasuryAccount.findFirst({
      where: { company_id: companyId, code },
      select: { id: true, name: true },
    });
    if (yaExiste) {
      throw new BadRequestException(
        `La cuenta PCGE ${code} ya está registrada en tesorería como "${yaExiste.name}".`,
      );
    }

    const creada = await this.prisma.companyTreasuryAccount.create({
      data: {
        company_id: companyId,
        code,
        name: nombre,
        kind: dto.kind ?? 'BANCO',
        currency: dto.currency ?? 'PEN',
      },
    });
    return this.mapear(creada);
  }

  async update(companyId: string, id: string, dto: UpdateTreasuryAccountDto) {
    const actual = await this.prisma.companyTreasuryAccount.findFirst({
      where: { id, company_id: companyId },
    });
    if (!actual) throw new NotFoundException('Cuenta de tesorería no encontrada.');

    const actualizada = await this.prisma.companyTreasuryAccount.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.kind !== undefined ? { kind: dto.kind } : {}),
        ...(dto.isActive !== undefined ? { is_active: dto.isActive } : {}),
      },
    });
    return this.mapear(actualizada);
  }

  /**
   * Devuelve la cuenta elegida por el usuario, validando que sea suya y que
   * siga activa. Un id de otra empresa es un 404, no un 403: no se confirma
   * siquiera que exista.
   */
  async resolve(companyId: string, treasuryAccountId: string) {
    const cuenta = await this.prisma.companyTreasuryAccount.findFirst({
      where: { id: treasuryAccountId, company_id: companyId, is_active: true },
    });
    if (!cuenta) {
      throw new BadRequestException(
        'La cuenta de tesorería indicada no existe, está inactiva o no pertenece a la empresa.',
      );
    }
    return this.mapear(cuenta);
  }

  /**
   * Cuenta que debe llevar el asiento, con el nombre para la línea.
   *
   * @param treasuryAccountId cuenta elegida en la UI; si llega, manda.
   * @param respaldo          cuenta histórica cuando no hay selección.
   */
  async cuentaParaAsiento(
    companyId: string,
    treasuryAccountId: string | undefined | null,
    respaldo: { code: string; name: string },
  ): Promise<{ code: string; name: string }> {
    if (!treasuryAccountId) return respaldo;
    const cuenta = await this.resolve(companyId, treasuryAccountId);
    return { code: cuenta.code, name: cuenta.name };
  }

  private mapear(cuenta: {
    id: string;
    code: string;
    name: string;
    kind: string;
    currency: string;
    is_active: boolean;
  }) {
    return {
      id: cuenta.id,
      code: cuenta.code,
      name: cuenta.name,
      kind: cuenta.kind,
      currency: cuenta.currency,
      isActive: cuenta.is_active,
    };
  }
}
