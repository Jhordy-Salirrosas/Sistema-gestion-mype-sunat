import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../database/prismaService';
import { checkAccountCode, type CatalogAccount } from '../../domain/rules/catalogIntegrityRule';

/**
 * Acceso único al catálogo PCGE para validar cuentas antes de contabilizar.
 *
 * Existe para que los módulos que arman asientos (gastos, cobros, compras) no
 * repitan la consulta ni la regla de "no usar cuenta de mayor con subcuentas".
 */
@Injectable()
export class AccountingCatalogService {
  constructor(private readonly prisma: PrismaService) {}

  async catalogo(): Promise<CatalogAccount[]> {
    const filas = await this.prisma.accountingAccount.findMany({
      select: { code: true, name: true, parent_code: true, is_active: true },
    });
    return filas.map((f) => ({
      code: f.code,
      name: f.name,
      parentCode: f.parent_code,
      isActive: f.is_active,
    }));
  }

  /** Lanza 400 con el primer problema encontrado en los códigos indicados. */
  async validarCodigos(codes: readonly string[]): Promise<CatalogAccount[]> {
    const catalogo = await this.catalogo();
    for (const code of codes) {
      const issue = checkAccountCode(catalogo, code);
      if (issue) throw new BadRequestException(issue.message);
    }
    return catalogo;
  }

  /** Nombres del catálogo para las cuentas de una distribución. */
  async nombres(codes: readonly string[]): Promise<Map<string, string>> {
    const catalogo = await this.catalogo();
    const porCodigo = new Map(catalogo.map((c) => [c.code, c.name ?? '']));
    return new Map(codes.map((code) => [code, porCodigo.get(code) ?? '']));
  }
}
