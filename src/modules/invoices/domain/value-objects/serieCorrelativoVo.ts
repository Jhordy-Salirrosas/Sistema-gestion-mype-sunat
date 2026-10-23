/**
 * Value object serie-correlativo del comprobante (M1).
 *
 * La serie no puede validarse sin conocer el tipo de comprobante: una Nota de
 * Crédito usa FC01/BC01 y una de Débito FD01/BD01. El tipo es opcional para
 * mantener la retrocompatibilidad con los llamados existentes.
 */
import {
  MENSAJE_SERIE_INVALIDA,
  REGLAS_SERIE,
  serieCorrespondeATipo,
} from '../rules/serieRules';

/**
 * Patrón genérico cuando no se conoce el tipo de comprobante.
 * Excluye los prefijos de nota (FC/FD/BC/BD) del grupo de facturas y boletas
 * para que la serie no se acepte en el tipo equivocado.
 */
const PATRON_SERIE_GENERICA = /^(?:(?:F|E)(?![CD])[A-Z0-9]{3}|B[A-Z0-9]{3}|EB[A-Z0-9]{2}|(?:FC|BC|FD|BD)[A-Z0-9]{2})$/;

export class SerieCorrelativoVo {
  public readonly serie: string;
  public readonly correlativo: number;
  public readonly tipoComprobante?: string;

  constructor(serie: string, correlativo: number, tipoComprobante?: string) {
    const serieNormalizada = typeof serie === 'string' ? serie.trim().toUpperCase() : '';

    if (tipoComprobante) {
      if (!serieCorrespondeATipo(serieNormalizada, tipoComprobante)) {
        throw new Error(
          REGLAS_SERIE[tipoComprobante]?.mensaje ?? MENSAJE_SERIE_INVALIDA,
        );
      }
    } else if (!PATRON_SERIE_GENERICA.test(serieNormalizada)) {
      throw new Error(
        `La serie ${serie} no cumple con el formato oficial SUNAT (F###, B###, FC##, FD##)`,
      );
    }

    if (
      !Number.isInteger(correlativo) ||
      correlativo < 1 ||
      correlativo > 99999999
    ) {
      throw new Error(
        `El correlativo ${correlativo} debe ser un número entero entre 1 y 99999999`,
      );
    }

    this.serie = serieNormalizada;
    this.correlativo = correlativo;
    this.tipoComprobante = tipoComprobante;
  }

  get formatted(): string {
    return `${this.serie}-${String(this.correlativo).padStart(8, '0')}`;
  }

  /** Indica si la serie pertenece a una nota de crédito o débito. */
  get esNota(): boolean {
    return /^[FB][CD]/.test(this.serie);
  }

  /** Siguiente correlativo del mismo talón (lo usa el worker al reemitir). */
  public siguiente(): SerieCorrelativoVo {
    return new SerieCorrelativoVo(
      this.serie,
      this.correlativo + 1,
      this.tipoComprobante,
    );
  }
}
