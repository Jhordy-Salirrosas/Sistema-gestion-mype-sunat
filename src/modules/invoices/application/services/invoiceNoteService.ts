/**
 * Notas de Crédito (07) y de Débito (08) con control de saldo (TA-66, HU-12).
 *
 * Los nodos UBL de una nota ya existían (`DiscrepancyResponse` y
 * `BillingReference` en `xmlNodesHelper`), pero no había servicio que las
 * emitiera ni forma de impedir que una nota devolviera más de lo que vale la
 * factura. Este servicio completa las dos piezas que faltaban:
 *
 *  - **Catálogos 09 y 10.** El motivo de la nota no es texto libre: es un código
 *    de un catálogo de SUNAT. El 09 para crédito (01 anulación total, 06
 *    devolución total, 07 devolución por ítem, 13 ajuste al crédito) y el 10
 *    para débito (01 intereses por mora, 02 aumento en el valor, 03
 *    penalidades). Un motivo del catálogo equivocado hace que SUNAT rechace la
 *    nota aunque el XML esté bien formado.
 *  - **Control de saldo.** Antes de emitir una Nota de Crédito se comprueba que
 *    el importe quepa en lo que queda de la factura. El control vive en
 *    `creditNoteBalanceGuard`.
 *
 * Aislamiento por empresa igual que el resto del módulo: la búsqueda del
 * comprobante origen filtra por `company_id` y responde 404 si no aparece.
 */
import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../database/prismaService';
import {
  ControlSaldoNotas,
  verificarSaldoNota,
  type SaldoComprobante,
} from './creditNoteBalanceGuard';

/** Motivo del Catálogo 09 (Nota de Crédito). */
export interface MotivoCredito {
  codigo: string;
  descripcion: string;
  /**
   * ¿Devuelve el importe completo del comprobante?
   *
   * Los motivos de anulación total (01, 06) implican devolver todo, así que no
   * se les pide importe: se toma el saldo disponible entero.
   */
  total: boolean;
}

/** Motivo del Catálogo 10 (Nota de Débito). */
export interface MotivoDebito {
  codigo: string;
  descripcion: string;
}

/** Catálogo 09 de SUNAT: motivos de Nota de Crédito. */
export const CATALOGO_09_MOTIVOS: readonly MotivoCredito[] = [
  { codigo: '01', descripcion: 'Anulación de la operación', total: true },
  { codigo: '02', descripcion: 'Anulación por error en el RUC', total: true },
  { codigo: '03', descripcion: 'Corrección por error en la descripción', total: false },
  { codigo: '04', descripcion: 'Descuento global', total: false },
  { codigo: '05', descripcion: 'Descuento por ítem', total: false },
  { codigo: '06', descripcion: 'Devolución total', total: true },
  { codigo: '07', descripcion: 'Devolución por ítem', total: false },
  { codigo: '09', descripcion: 'Disminución en el valor', total: false },
  { codigo: '13', descripcion: 'Ajustes de montos y/o fechas de pago al crédito', total: false },
];

/** Catálogo 10 de SUNAT: motivos de Nota de Débito. */
export const CATALOGO_10_MOTIVOS: readonly MotivoDebito[] = [
  { codigo: '01', descripcion: 'Intereses por mora' },
  { codigo: '02', descripcion: 'Aumento en el valor' },
  { codigo: '03', descripcion: 'Penalidades / otros conceptos' },
  { codigo: '11', descripcion: 'Ajustes de operaciones de exportación' },
  { codigo: '12', descripcion: 'Ajustes afectos al IVAP' },
];

/** Datos para solicitar una nota. */
export interface SolicitudNota {
  /** Comprobante que se modifica. */
  comprobanteOrigenId: string;
  motivoCodigo: string;
  /** Importe a acreditar o debitar; se ignora en los motivos totales. */
  importe?: number;
  /** Descripción libre que acompañará al motivo. */
  sustento?: string;
}

/** Resultado de la verificación de una nota. */
export interface NotaAutorizada {
  tipo: '07' | '08';
  motivoCodigo: string;
  motivoDescripcion: string;
  /** Importe que llevará la nota. */
  importe: number;
  /** Fechas y números del comprobante origen, para la referencia UBL. */
  origen: { id: string; serie: string; correlativo: number; total: number };
  saldo: SaldoComprobante;
}

@Injectable()
export class InvoiceNoteService {
  private readonly saldos: ControlSaldoNotas;

  constructor(private readonly prisma: PrismaService) {
    this.saldos = new ControlSaldoNotas(prisma);
  }

  /** Saldo disponible de un comprobante, para mostrarlo antes de emitir. */
  public async saldo(companyId: string, comprobanteId: string) {
    return this.saldos.calcular(companyId, comprobanteId);
  }

  /**
   * Valida una Nota de Crédito y calcula su importe.
   *
   * @throws ConflictException (409) si el importe supera el saldo disponible.
   */
  public async autorizarCredito(
    companyId: string,
    solicitud: SolicitudNota,
  ): Promise<NotaAutorizada> {
    const motivo = CATALOGO_09_MOTIVOS.find(
      (m) => m.codigo === solicitud.motivoCodigo,
    );
    if (!motivo) {
      throw new BadRequestException({
        code: 'MOTIVO_INVALIDO',
        message:
          `El motivo ${solicitud.motivoCodigo} no pertenece al Catálogo 09. ` +
          `Los válidos son ${CATALOGO_09_MOTIVOS.map((m) => m.codigo).join(', ')}.`,
      });
    }

    const saldo = await this.saldos.calcular(
      companyId,
      solicitud.comprobanteOrigenId,
    );

    // En los motivos de anulación o devolución total el importe ES el saldo:
    // pedirlo dejaría dos fuentes de verdad para el mismo número.
    const importe = motivo.total ? saldo.disponible : (solicitud.importe ?? 0);

    verificarSaldoNota(saldo, importe);

    return {
      tipo: '07',
      motivoCodigo: motivo.codigo,
      motivoDescripcion: solicitud.sustento?.trim() || motivo.descripcion,
      importe,
      origen: {
        id: solicitud.comprobanteOrigenId,
        serie: saldo.serie,
        correlativo: saldo.correlativo,
        total: saldo.total,
      },
      saldo,
    };
  }

  /**
   * Valida una Nota de Débito.
   *
   * Una nota de débito AUMENTA el importe de la operación, así que no consume
   * saldo: solo se comprueba que el motivo sea del Catálogo 10 y que el importe
   * sea positivo.
   */
  public async autorizarDebito(
    companyId: string,
    solicitud: SolicitudNota,
  ): Promise<NotaAutorizada> {
    const motivo = CATALOGO_10_MOTIVOS.find(
      (m) => m.codigo === solicitud.motivoCodigo,
    );
    if (!motivo) {
      throw new BadRequestException({
        code: 'MOTIVO_INVALIDO',
        message:
          `El motivo ${solicitud.motivoCodigo} no pertenece al Catálogo 10. ` +
          `Los válidos son ${CATALOGO_10_MOTIVOS.map((m) => m.codigo).join(', ')}.`,
      });
    }

    const saldo = await this.saldos.calcular(
      companyId,
      solicitud.comprobanteOrigenId,
    );

    const importe = solicitud.importe ?? 0;
    if (!(importe > 0)) {
      throw new BadRequestException({
        code: 'NOTA_IMPORTE_INVALIDO',
        message: 'El importe de una nota de débito debe ser mayor que cero.',
      });
    }

    return {
      tipo: '08',
      motivoCodigo: motivo.codigo,
      motivoDescripcion: solicitud.sustento?.trim() || motivo.descripcion,
      importe,
      origen: {
        id: solicitud.comprobanteOrigenId,
        serie: saldo.serie,
        correlativo: saldo.correlativo,
        total: saldo.total,
      },
      saldo,
    };
  }

  /**
   * Serie que debe usar la nota.
   *
   * SUNAT exige que una Nota de Crédito a una Factura use una serie que empiece
   * con `F` y a una Boleta una que empiece con `B`, con `C` para crédito y `D`
   * para débito. Se deriva del comprobante origen y no se acepta del usuario.
   */
  public serieDeNota(tipoNota: '07' | '08', serieOrigen: string): string {
    const esBoleta = serieOrigen.toUpperCase().startsWith('B');
    const prefijo = esBoleta ? 'B' : 'F';
    return `${prefijo}${tipoNota === '07' ? 'C' : 'D'}01`;
  }

  /** ¿El motivo del Catálogo 09 implica devolver todo el comprobante? */
  public esMotivoTotal(codigo: string): boolean {
    return CATALOGO_09_MOTIVOS.find((m) => m.codigo === codigo)?.total ?? false;
  }
}
