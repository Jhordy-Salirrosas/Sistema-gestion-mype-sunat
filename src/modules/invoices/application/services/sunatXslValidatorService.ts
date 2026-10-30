/**
 * Validador local con las XSL oficiales de SUNAT (TA-31).
 *
 * SUNAT publica, dentro de `validacpe/programas`, una hoja XSL por tipo de
 * comprobante que devuelve la lista de errores de validación de un XML. Esa
 * hoja es la referencia normativa: reproducir sus reglas a mano sería
 * duplicar (y desactualizar) el estándar, así que aquí se EJECUTA la hoja.
 *
 * Decisiones de diseño:
 *
 *  - Las XSL no se versionan en el repositorio. Son material de SUNAT, pesan
 *    cientos de KB cada una y cambian con el estándar; se leen del directorio
 *    que indique `SUNAT_XSL_DIR`.
 *
 *  - Si la hoja no se puede cargar, el envío se BLOQUEA. El criterio 4 del
 *    backlog es explícito, y dejar pasar un comprobante sin validar porque
 *    faltaba un archivo es peor que detenerlo: el error silencioso aparecería
 *    recién cuando SUNAT lo rechace, con intentos del backoff ya gastados.
 *
 *  - La traducción de cada código a un mensaje legible vive en
 *    `sunatValidationCatalog.ts`, no aquí.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Injectable, Logger } from '@nestjs/common';
import { XmlParser, Xslt } from 'xslt-processor';
import {
  CATALOGO_REGLAS_SUNAT,
  type ReglaSunat,
  reglaPorCodigo,
} from './sunatValidationCatalog';

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
  /** Motivo del bloqueo, para la auditoría. */
  motivoBloqueo: string | null;
}

export interface ErrorValidacionXsl {
  codigo: string;
  mensaje: string;
  /** Regla del catálogo que lo explica, si se conoce. */
  regla: ReglaSunat | null;
}

/**
 * Nombre del archivo XSL oficial por tipo de comprobante.
 *
 * La hoja de SUNAT es la misma para los cuatro tipos 2.0.1: la
 * `2.0.1` del programa de validación cubre factura, boleta y notas, y la
 * propia hoja distingue por la raíz del documento. Se deja el mapa explícito
 * porque el criterio 2 del backlog exige el mapeo por tipo.
 */
const XSL_POR_TIPO: Record<string, string> = {
  '01': '2.0.1.xsl',
  '03': '2.0.1.xsl',
  '07': '2.0.1.xsl',
  '08': '2.0.1.xsl',
};

/** Tiempo máximo que se acepta para validar un comprobante (criterio 4). */
export const LIMITE_VALIDACION_MS = 2000;

@Injectable()
export class SunatXslValidatorService {
  private readonly logger = new Logger(SunatXslValidatorService.name);
  private readonly parser = new XmlParser();
  private readonly hojas = new Map<string, string>();

  /**
   * Valida el XML firmado con la hoja oficial de su tipo.
   *
   * @param xml XML firmado, tal como se va a enviar.
   * @param tipoComprobante Código SUNAT: 01, 03, 07 u 08.
   */
  async validar(
    xml: string,
    tipoComprobante: string,
  ): Promise<ResultadoValidacionXsl> {
    const archivo = XSL_POR_TIPO[tipoComprobante];
    if (!archivo) {
      return this.bloqueo(
        `No hay hoja XSL mapeada para el tipo de comprobante '${tipoComprobante}'`,
      );
    }

    const hoja = this.cargarHoja(archivo);
    if (hoja === null) {
      return this.bloqueo(
        `No se pudo cargar la hoja oficial '${archivo}' desde ${this.directorio()}. ` +
          'El envío se bloquea: no se valida a ciegas un comprobante tributario',
      );
    }

    const inicio = Date.now();
    let salida: string;
    try {
      salida = await new Xslt().xsltProcess(
        this.parser.xmlParse(xml),
        this.parser.xmlParse(hoja),
      );
    } catch (error) {
      // Una hoja oficial no debería fallar sobre un XML bien formado. Si pasa,
      // no se puede afirmar que el comprobante sea válido: se bloquea igual.
      return this.bloqueo(
        `La hoja XSL oficial falló al procesar el XML: ${
          error instanceof Error ? error.message : 'error desconocido'
        }`,
      );
    }

    const duracion = Date.now() - inicio;
    if (duracion > LIMITE_VALIDACION_MS) {
      this.logger.warn(
        `La validación XSL de ${tipoComprobante} tardó ${duracion} ms (límite ${LIMITE_VALIDACION_MS} ms)`,
      );
    }

    return this.interpretar(salida);
  }

  /**
   * Directorio de las hojas oficiales.
   *
   * Se lee en cada llamada y no en el constructor para que las pruebas puedan
   * apuntar a un directorio temporal sin volver a instanciar el servicio.
   */
  private directorio(): string {
    return process.env.SUNAT_XSL_DIR ?? join(process.cwd(), 'sunat-xsl');
  }

  /** Lee y cachea la hoja; `null` si el archivo no está. */
  private cargarHoja(archivo: string): string | null {
    const cacheada = this.hojas.get(archivo);
    if (cacheada !== undefined) return cacheada;

    const ruta = join(this.directorio(), archivo);
    if (!existsSync(ruta)) {
      this.logger.error(`No existe la hoja XSL oficial en ${ruta}`);
      return null;
    }

    try {
      const contenido = readFileSync(ruta, 'utf8');
      this.hojas.set(archivo, contenido);
      return contenido;
    } catch (error) {
      this.logger.error(
        `No se pudo leer ${ruta}: ${
          error instanceof Error ? error.message : 'error desconocido'
        }`,
      );
      return null;
    }
  }

  /**
   * Extrae los códigos de error de la salida de la hoja.
   *
   * La hoja oficial escribe líneas con la forma
   * `... <cbc:ResponseCode>2xxx</cbc:ResponseCode>` o texto plano `2xxx texto`.
   * Se buscan ambos formatos porque SUNAT ha cambiado el envoltorio entre
   * versiones y lo que importa es el código de 3 o 4 dígitos.
   */
  private interpretar(salida: string): ResultadoValidacionXsl {
    const codigos = new Set<string>();

    for (const coincidencia of salida.matchAll(/(\d{3,4})/g)) {
      codigos.add(coincidencia[1].padStart(4, '0'));
    }

    // Un cero aislado no es un error: es la ausencia de códigos.
    codigos.delete('0000');

    const errores: ErrorValidacionXsl[] = [];
    const codigosDesconocidos: string[] = [];

    for (const codigo of codigos) {
      const regla = reglaPorCodigo(codigo);
      if (regla) {
        errores.push({ codigo, mensaje: regla.mensaje, regla });
      } else {
        codigosDesconocidos.push(codigo);
      }
    }

    // Un código desconocido también es un error: la hoja oficial lo reportó.
    for (const codigo of codigosDesconocidos) {
      errores.push({
        codigo,
        mensaje: `El XML no cumple la regla ${codigo} de SUNAT (fuera del catálogo local)`,
        regla: null,
      });
    }

    return {
      valido: errores.length === 0,
      errores,
      codigosDesconocidos,
      bloqueado: false,
      motivoBloqueo: null,
    };
  }

  private bloqueo(motivo: string): ResultadoValidacionXsl {
    this.logger.error(`[TA-31] Validación bloqueada: ${motivo}`);
    return {
      valido: false,
      errores: [],
      codigosDesconocidos: [],
      bloqueado: true,
      motivoBloqueo: motivo,
    };
  }

  /** Reglas del catálogo, para pruebas y para el endpoint de diagnóstico. */
  reglasDelCatalogo(): readonly ReglaSunat[] {
    return CATALOGO_REGLAS_SUNAT;
  }
}
