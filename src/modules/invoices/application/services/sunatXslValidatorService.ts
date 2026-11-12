/** Validador único del juego oficial SFS; los fallos del motor bloquean el envío. */
import { Injectable, Logger } from '@nestjs/common';
import { CATALOGO_REGLAS_SUNAT, type ReglaSunat, reglaPorCodigo } from './sunatValidationCatalog';
import { ejecutarSfs } from './sunatSfsRunner';

/** Resultado de ejecutar la hoja oficial sobre un XML. */
export interface ResultadoValidacionXsl {
  /** true si no se encontró ningún error con código. */
  valido: boolean;
  /** Errores con su código y su mensaje legible. */
  errores: ErrorValidacionXsl[];
  /** Códigos que la hoja reportó pero que no están en el catálogo. */
  codigosDesconocidos: string[];
  /** true si la validación no pudo ejecutarse y el envío debe bloquearse. */
  bloqueado: boolean;
  /** Motivo del bloqueo o de la imposibilidad de concluir, para diagnóstico. */
  motivoBloqueo: string | null;
  /**
   * ¿La hoja ejecutada era capaz de validar? (TA-62)
   *
   * `false` significa que la hoja corrió pero no tiene sus plantillas de
   * validación, así que NO se puede afirmar nada sobre el comprobante. En ese
   * caso `valido` es `false`; nunca se presenta como aprobado por XSL.
   */
  validadoDeVerdad: boolean;
  causaNoConcluyente?: 'DEPENDENCIA_VALIDATE_UTILS_AUSENTE';
}

export interface ErrorValidacionXsl {
  codigo: string;
  mensaje: string;
  nodo?: string | null;
  /** Regla del catálogo que lo explica, si se conoce. */
  regla: ReglaSunat | null;
}

/**
 * Nombre del archivo XSL oficial por tipo de comprobante.
 *
 * SUNAT publica una hoja por tipo, con estos nombres exactos. Se deja el mapa
 * explícito porque el criterio 2 del backlog exige el mapeo por tipo.
 */
export const XSL_POR_TIPO: Record<string, string> = {
  '01': 'Factura 2.0.1.xsl',
  '03': 'Boleta 2.0.1.xsl',
  '07': 'Nota de Credito 2.0.1.xsl',
  '08': 'Nota de Debito 2.0.1.xsl',
};

@Injectable()
export class SunatXslValidatorService {
  private readonly logger = new Logger(SunatXslValidatorService.name);

  async validar(xml: string, tipoComprobante: string): Promise<ResultadoValidacionXsl> {
    if (!XSL_POR_TIPO[tipoComprobante]) return this.bloqueo(
      `No hay hoja XSL mapeada para el tipo de comprobante '${tipoComprobante}'`,
    );
    try {
      const resultado = await ejecutarSfs(xml, tipoComprobante);
      const errores = resultado.errores.map(error => ({ ...error, regla: reglaPorCodigo(error.codigo) }));
      return {
        valido: errores.length === 0, errores,
        codigosDesconocidos: errores.filter(e => !e.regla).map(e => e.codigo),
        bloqueado: false, motivoBloqueo: null, validadoDeVerdad: true,
      };
    } catch (error) {
      return this.bloqueo(error instanceof Error ? error.message : 'Ejecutor SFS no disponible');
    }
  }

  private bloqueo(motivo: string): ResultadoValidacionXsl {
    this.logger.error(`[TA-31] Validación bloqueada: ${motivo}`);
    return {
      valido: false,
      errores: [],
      codigosDesconocidos: [],
      bloqueado: true,
      motivoBloqueo: motivo,
      validadoDeVerdad: false,
    };
  }

  /** Reglas del catálogo, para pruebas y para el endpoint de diagnóstico. */
  reglasDelCatalogo(): readonly ReglaSunat[] {
    return CATALOGO_REGLAS_SUNAT;
  }
}
