/**
 * Adaptador de las hojas XSL oficiales de SUNAT (TA-31).
 *
 * Las hojas que publica SUNAT NO son XSLT estándar: están escritas para
 * **IBM DataPower**, el motor que SUNAT usa para validar. Eso obliga a tres
 * normalizaciones antes de poder ejecutarlas con `xslt-processor` (XSLT 1.0):
 *
 *  1. `dp:variable('var://context/cpe/nombreArchivoEnviado')` es una función
 *     propietaria que devuelve el nombre del archivo enviado. Se sustituye por
 *     el parámetro `$nombreArchivoEnviado`, que se calcula del propio XML.
 *
 *  2. `date:date()` y `date:seconds($f)` son funciones EXSLT que
 *     `xslt-processor` no implementa. Se sustituyen por variables globales.
 *
 *  3. La Nota de Debito trae **comentada** la declaración de
 *     `$MontoDescuentoAfectoBI` pero la sigue usando; y la Boleta y la Nota de
 *     Debito usan `$nroLinea` en plantillas de cabecera, donde no existe.
 *     Ambos son defectos de las propias hojas, no de este código.
 *
 * Todo esto está aquí, en un solo sitio, para que el validador se lea como lo
 * que es (ejecutar la hoja y leer su salida) y para que la conversión sea
 * auditable y testeable por separado.
 */

/** Parámetros y funciones globales que se inyectan en toda hoja. */
const PREAMBULO = `        <xsl:param name="nombreArchivoEnviado" select="''"/>
        <xsl:param name="fechaHoy" select="'2019-01-01'"/>
        <xsl:variable name="date-date" select="$fechaHoy"/>
        <xsl:variable name="date-seconds" select="0"/>
`;

/** Declaración de `$MontoDescuentoAfectoBI` tal como la dejó comentada SUNAT. */
const DECL_MONTO_DESCUENTO =
  '<xsl:variable name="MontoDescuentoAfectoBI" ' +
  'select="sum(cac:AllowanceCharge[cbc:AllowanceChargeReasonCode[text() = \'02\']]/cbc:Amount)"/>';

/**
 * Archivos de los que depende una hoja oficial y que SUNAT no publica.
 *
 * Se nombran para que el diagnóstico no se pierda: quien lea la deuda sabe
 * exactamente qué falta, no "algo de commons".
 */
export const DEPENDENCIAS_NO_PUBLICADAS = [
  'commons/error/validate_utils.xsl',
  'commons/error/error_utils.xsl',
] as const;

/** TA-70: solo la respuesta verificada de una ejecución acredita conclusión.
 * Sin argumento se conserva false: configuración no equivale a validación.
 * La ruta heredada de xslt-processor nunca aporta esta evidencia.
 */
export function validaDeVerdad(resultado?: { completado: boolean }): boolean {
  // Sin evidencia de ESTA ejecución (incluido el diagnóstico de configuración),
  // no se acredita validación por instalar Python o por encontrar los assets.
  return resultado?.completado === true;
}

/**
 * Convierte una hoja oficial de SUNAT en una hoja XSLT 1.0 ejecutable.
 *
 * Es idempotente: aplicarla dos veces da el mismo resultado.
 *
 * @param original Contenido literal del `.xsl` descargado de SUNAT.
 * @returns La hoja lista para `xslt-processor`.
 */
export function normalizarHojaSunat(original: string): string {
  let hoja = original;

  // 1) función propietaria de DataPower -> parámetro propio
  hoja = hoja.replaceAll(
    "dp:variable('var://context/cpe/nombreArchivoEnviado')",
    '$nombreArchivoEnviado',
  );

  // 2) atributos dp:* (no son atributos XSLT válidos)
  hoja = hoja.replaceAll(/\s+dp:[a-zA-Z-]+="[^"]*"/g, '');

  // 3) funciones EXSLT date:*
  hoja = hoja.replaceAll('date:date()', '$date-date');
  hoja = hoja.replaceAll(/date:seconds\([^()]*\)/g, '$date-seconds');

  // 4) declaración comentada por SUNAT que luego vuelve a usar
  if (hoja.includes('$MontoDescuentoAfectoBI')) {
    hoja = hoja.replace(
      /<!--\s*<xsl:variable\s+name="MontoDescuentoAfectoBI".*?-->\s*/s,
      `${DECL_MONTO_DESCUENTO}\n        `,
    );
  }

  // 5) `$nroLinea` fuera del template de línea: se declara un global vacío.
  //    Los templates de línea lo siguen sombreando con su variable local.
  if (
    hoja.includes('$nroLinea') &&
    !hoja.includes('<xsl:variable name="nroLinea" select="\'\'"/>')
  ) {
    const indice = hoja.indexOf('<xsl:template');
    if (indice !== -1) {
      hoja =
        hoja.slice(0, indice) +
        '<xsl:variable name="nroLinea" select="\'\'"/>\n    ' +
        hoja.slice(indice);
    }
  }

  // 6) `xsl:include` a la carpeta `commons` de SUNAT.
  //
  //    CORRECCIÓN (TA-62): el comentario anterior decía que ese archivo "solo
  //    aporta utilidades de mensaje, así que se retira". ERA FALSO.
  //
  //    `validate_utils.xsl` y `error_utils.xsl` contienen las plantillas que
  //    HACEN la validación: `isTrueExpresion` (277 llamadas en la hoja de
  //    Factura), `regexpValidateElementIfExist` (251) y
  //    `existAndRegexpValidateElement` (20). Sin ellas, las 1 552 llamadas de
  //    la hoja se descartan en SILENCIO: XSLT no falla, simplemente la llamada
  //    a una plantilla inexistente no produce nada y NO se escribe ningún
  //    código de error.
  //
  //    Consecuencia: la hoja "se ejecuta" pero no valida. El único contenido de
  //    la salida es el XML copiado, y el validador leía los números de ese XML
  //    (RUC, base imponible, total) como si fueran códigos de SUNAT.
  //
  //    SUNAT NO publica esos dos archivos: el ZIP oficial
  //    (`XSL Actualizado al 06092022.zip`) trae solo la carpeta `validaciones/`
  //    con las 15 hojas, y todas ellas incluyen `commons/error/*.xsl` por ruta
  //    `local:///` o relativa `../../../commons/...`. Se verificó el 31 oct.
  //
  //    Por eso este `replace` NO es una limpieza cosmética: es el punto exacto
  //    donde la hoja pierde su capacidad de validar. Se mantiene el borrado
  //    (dejar el include haría fallar el motor), pero la consecuencia queda
  //    declarada en `validaDeVerdad()`, que el servicio usa para NO afirmar
  //    que un XML es válido.
  hoja = hoja.replaceAll(/<xsl:include[^>]*\/>/g, '');

  // 7) el namespace dp debe seguir declarado aunque ya no se use
  if (!hoja.includes('xmlns:dp=')) {
    hoja = hoja.replace(
      '<xsl:stylesheet',
      '<xsl:stylesheet xmlns:dp="http://www.datapower.com/extensions"',
    );
  }

  // 8) parámetros y funciones globales al inicio del template raíz.
  //    Solo si no están ya: así la normalización es idempotente.
  if (!hoja.includes('<xsl:param name="nombreArchivoEnviado"')) {
    hoja = hoja.replace(
      /(<xsl:template\s+match="\/\*"\s*>)/,
      `$1\n${PREAMBULO}`,
    );
  }

  return hoja;
}

/**
 * Reconstruye el nombre de archivo que SUNAT espera, a partir del XML.
 *
 * Formato: `RUC-tipo-serie-correlativo.xml`, con el correlativo a 8 dígitos.
 * Es el valor que la hoja oficial lee de `nombreArchivoEnviado` para validar
 * que el número de comprobante del XML coincida con el del archivo.
 */
export function nombreArchivoDesdeXml(xml: string): string {
  const leer = (etiqueta: string): string => {
    const patron = new RegExp(`<(?:\\w+:)?${etiqueta}[^>]*>([^<]*)<`, 'i');
    return patron.exec(xml)?.[1]?.trim() ?? '';
  };

  const ruc = leer('rucEmisor') || leer('RUCEmisor');
  const tipo = leer('InvoiceTypeCode') || leer('CreditNoteTypeCode');
  const serie = leer('ID');
  const correlativo = leer('ID');

  if (!tipo) return '';

  return `${ruc}-${tipo}-${serie}-${correlativo.padStart(8, '0')}.xml`;
}
