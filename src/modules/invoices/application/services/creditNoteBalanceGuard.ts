/**
 * Control del saldo disponible de un comprobante antes de emitir una nota
 * (TA-66, HU-12).
 *
 * Una Nota de Crédito devuelve dinero o anula parte de una factura: por lógica
 * no puede devolver más de lo que la factura vale. SUNAT no comprueba ese saldo
 * al aceptar la nota — acepta cada Nota de Crédito por separado y el exceso de
 * devolución aparece en la determinación del impuesto, no en el CDR. Por eso hay
 * que controlarlo aquí: dejar emitir dos notas de 1000 sobre una factura de 1000
 * produce un comprobante válido y una devolución imposible.
 *
 * Reglas que se aplican:
 *
 *  - Solo se puede notar un comprobante **ACEPTADO u OBSERVADO**. Notar uno
 *    rechazado o en cola equivale a modificar un documento que SUNAT no ha
 *    reconocido.
 *  - Una Nota de Crédito (07) **devuelve** saldo; una de Débito (08) **aumenta**
 *    el importe y no consume saldo, pero tampoco puede aplicarse a un
 *    comprobante con saldo cero si este ya fue anulado por completo.
 *  - Las notas anuladas no consumen saldo, y las rechazadas tampoco: no existen
 *    ante SUNAT.
 *  - El margen es al céntimo, sin tolerancia: exigir "no superar" con un epsilon
 *    deja pasar un céntimo de más en cada nota.
 */
import { ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../../database/prismaService';

/** Estados del comprobante origen que admiten una nota. */
export const ESTADOS_NOTABLES = ['ACEPTADO', 'OBSERVADO'];

/** Estados de una nota que NO consumen saldo. */
export const ESTADOS_NOTA_SIN_EFECTO = ['RECHAZADO', 'ANULADO'];

/** Resultado del cálculo de saldo. */
export interface SaldoComprobante {
  /** Importe total del comprobante origen. */
  total: number;
  /** Importe ya devuelto por notas de crédito vigentes. */
  devuelto: number;
  /** Importe que todavía se puede acreditar. */
  disponible: number;
}

/** Redondeo monetario a céntimos. */
const centimos = (n: number): number => Math.round(n * 100) / 100;

/**
 * Calcula el saldo disponible de un comprobante.
 *
 * Es una función pura para poder probarla sin base de datos.
 *
 * @param total importe total del comprobante origen.
 * @param devuelto suma de las notas de crédito vigentes ya emitidas.
 */
export const saldoDisponible = (
  total: number,
  devuelto: number,
): SaldoComprobante => {
  const t = centimos(Math.max(0, total));
  const d = centimos(Math.max(0, devuelto));
  // Nunca negativo: si por datos históricos el devuelto supera el total, el
  // saldo disponible es cero, no un número negativo que confunda al usuario.
  return { total: t, devuelto: d, disponible: centimos(Math.max(0, t - d)) };
};

/**
 * Verifica que una Nota de Crédito quepa en el saldo del comprobante.
 *
 * @throws ConflictException (409) cuando el importe supera el saldo, que es el
 *   código que el criterio pide: no es un error del cliente (400) sino un
 *   conflicto con el estado actual del comprobante.
 */
export const verificarSaldoNota = (
  saldo: SaldoComprobante,
  importeNota: number,
): void => {
  const importe = centimos(importeNota);

  if (importe <= 0) {
    throw new ConflictException({
      code: 'NOTA_IMPORTE_INVALIDO',
      message: 'El importe de la nota debe ser mayor que cero.',
    });
  }

  // Comparación en céntimos enteros: 0.1 + 0.2 !== 0.3 en coma flotante, y aquí
  // un céntimo decide si la nota se emite o no.
  if (Math.round(importe * 100) > Math.round(saldo.disponible * 100)) {
    throw new ConflictException({
      code: 'NOTA_EXCEDE_SALDO',
      message:
        `La nota por ${importe.toFixed(2)} supera el saldo disponible del ` +
        `comprobante (${saldo.disponible.toFixed(2)} de ${saldo.total.toFixed(2)}; ` +
        `ya se acreditaron ${saldo.devuelto.toFixed(2)}).`,
      saldo,
    });
  }
};

/** Servicio que resuelve el saldo contra la base de datos. */
export class ControlSaldoNotas {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Devuelve el saldo disponible del comprobante origen.
   *
   * @throws NotFoundException si el comprobante no existe en la empresa.
   * @throws ConflictException si su estado no admite notas.
   */
  public async calcular(
    companyId: string,
    comprobanteId: string,
  ): Promise<SaldoComprobante & { estado: string; serie: string; correlativo: number }> {
    const origen = await this.prisma.invoice.findFirst({
      where: { id: comprobanteId, company_id: companyId },
      select: {
        id: true,
        estado: true,
        serie: true,
        correlativo: true,
        monto_total: true,
      },
    });

    if (!origen) {
      throw new NotFoundException({
        code: 'INVOICE_NOT_FOUND',
        message: 'El comprobante no existe o no pertenece a la empresa',
      });
    }

    if (!ESTADOS_NOTABLES.includes(origen.estado)) {
      throw new ConflictException({
        code: 'INVOICE_NO_NOTABLE',
        message:
          `El comprobante está en estado ${origen.estado} y no admite notas: ` +
          'solo un comprobante aceptado u observado puede modificarse.',
      });
    }

    // Suma de las notas de crédito (tipo 07) vigentes que apuntan a este
    // comprobante. Las de tipo 08 (débito) aumentan el importe y no consumen
    // saldo, así que no entran en la resta.
    const notas = await this.prisma.invoice.findMany({
      where: {
        company_id: companyId,
        tipo_comprobante: '07',
        referenced_invoice_id: origen.id,
        estado: { notIn: ESTADOS_NOTA_SIN_EFECTO as never },
      },
      select: { monto_total: true },
    });

    const devuelto = notas.reduce(
      (acc, nota) => acc + Number(nota.monto_total),
      0,
    );

    const saldo = saldoDisponible(Number(origen.monto_total), devuelto);

    return {
      ...saldo,
      estado: origen.estado,
      serie: origen.serie,
      correlativo: origen.correlativo,
    };
  }
}
