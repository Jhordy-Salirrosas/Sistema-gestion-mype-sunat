import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import {
  ACCOUNTING_REPOSITORY_PORT,
  type IAccountingRepositoryPort,
} from '../../domain/ports/accountingRepositoryPort';
import type { AccountingAccountEntity } from '../../domain/entities/accountingAccountEntity';

export interface UpdateAccountResult {
  account: AccountingAccountEntity;
  /** Subcuentas que se activaron o desactivaron junto con la cuenta. */
  descendientesAfectados: number;
  /** Avisos que no impiden la operación pero conviene mostrar. */
  advertencias: string[];
}

/**
 * Edita una cuenta del catálogo: nombre, tipo (elemento) y estado.
 *
 * Reglas de la inactivación:
 * - Desactivar una cuenta desactiva también **todas sus subcuentas**: dejar
 *   hijas activas bajo un padre inactivo rompe la coherencia del plan.
 * - No se permite desactivar si la cuenta tiene saldo en el período.
 * - Reactivar una subcuenta exige que su padre esté activo; reactivar un padre
 *   **no** reactiva a las hijas (decisión del contador, una por una).
 *
 * El código no se cambia: las líneas de asientos ya registrados lo referencian.
 */
@Injectable()
export class UpdateAccountingAccountUseCase {
  constructor(
    @Inject(ACCOUNTING_REPOSITORY_PORT)
    private readonly repository: IAccountingRepositoryPort,
  ) {}

  async execute(
    companyId: string,
    code: string,
    cambios: { name?: string; element?: string; isActive?: boolean },
    opciones: { usuarioId?: string } = {},
  ): Promise<UpdateAccountResult> {
    const cuentas = await this.repository.findAccounts({ includeInactive: true });
    const cuenta = cuentas.find((item) => item.code === code);
    if (!cuenta) {
      throw new BadRequestException(`La cuenta PCGE ${code} no existe en el catálogo.`);
    }
    if (cambios.name === undefined && cambios.element === undefined && cambios.isActive === undefined) {
      throw new BadRequestException('Indica el nombre, el tipo o el estado que quieres cambiar.');
    }

    let descendientesAfectados = 0;
    const advertencias: string[] = [];

    if (cambios.isActive === true) {
      await this.validarPadreActivo(cuentas, cuenta);
    }

    if (cambios.isActive === false) {
      await this.validarSaldo(companyId, cuenta);
      await this.avisarUsos(companyId, cuenta.code, advertencias);
    }

    // Nombre y tipo se guardan siempre; el estado se aplica en cascada aparte.
    const cuentaActualizada = await this.repository.updateAccount(code, {
      ...(cambios.name === undefined ? {} : { name: cambios.name }),
      ...(cambios.element === undefined ? {} : { element: cambios.element }),
    });

    if (cambios.isActive !== undefined) {
      const descendientes = await this.repository.findDescendantCodes(code);
      descendientesAfectados = await this.repository.setAccountsActive(descendientes, cambios.isActive);
      await this.repository.setAccountsActive([code], cambios.isActive);
      if (!cambios.isActive) await this.repository.registrarInactivacion(code, opciones.usuarioId);
      cuentaActualizada.isActive = cambios.isActive;
    }

    return { account: cuentaActualizada, descendientesAfectados, advertencias };
  }

  /** Una subcuenta no puede reactivarse si su padre está inactivo. */
  private async validarPadreActivo(
    cuentas: readonly AccountingAccountEntity[],
    cuenta: AccountingAccountEntity,
  ) {
    if (!cuenta.parentCode) return;
    const padre = cuentas.find((item) => item.code === cuenta.parentCode);
    if (padre && !padre.isActive) {
      throw new BadRequestException(
        `No se puede activar ${cuenta.code}: su cuenta padre ${padre.code} está inactiva. Active primero la cuenta padre.`,
      );
    }
  }

  /** No se desactiva una cuenta con movimientos en el período abierto. */
  private async validarSaldo(companyId: string, cuenta: AccountingAccountEntity) {
    const periodos = await this.repository.findPeriods(companyId);
    const abierto = periodos.find((periodo) => periodo.status === 'ABIERTO');
    if (!abierto) return;

    const saldo = await this.repository.accountPeriodBalance(companyId, cuenta.code, abierto.period);
    if (Math.abs(saldo) > 0.005) {
      const importe = saldo.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      throw new BadRequestException(
        `No se puede inactivar ${cuenta.code}: tiene un saldo de S/ ${importe} en el período ${abierto.period}. ` +
          'Registra el ajuste o espera el cierre del período antes de inactivarla.',
      );
    }
  }

  /** Avisa si la cuenta se usa en reglas automáticas o en tesorería. */
  private async avisarUsos(companyId: string, code: string, advertencias: string[]) {
    const reglas = await this.repository.accountUsedInRules(companyId, code);
    if (reglas > 0) {
      advertencias.push(
        `La cuenta se usa en ${reglas} regla(s) de contabilización; los asientos automáticos podrían fallar.`,
      );
    }
    const esTesoreria = await this.repository.accountIsTreasury(companyId, code);
    if (esTesoreria) {
      advertencias.push('La cuenta está configurada como cuenta de tesorería (caja o banco).');
    }
  }
}
