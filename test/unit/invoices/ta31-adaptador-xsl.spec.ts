/**
 * TA-31 — Adaptador de las hojas XSL oficiales de SUNAT.
 *
 * Las hojas de SUNAT están escritas para IBM DataPower y no son XSLT
 * estándar. Aquí se prueba la normalización que las hace ejecutables, sin
 * depender de tener los archivos oficiales en disco (no se versionan).
 */
import {
  nombreArchivoDesdeXml,
  normalizarHojaSunat,
} from '../../../src/modules/invoices/application/services/sunatXslAdapter';
import { XSL_POR_TIPO } from '../../../src/modules/invoices/application/services/sunatXslValidatorService';

/** Hoja mínima con los mismos rasgos que la oficial. */
function hojaConRasgosOficiales(): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet version="1.0"
  xmlns:xsl="http://www.w3.org/1999/XSL/Transform"
  xmlns:dp="http://www.datapower.com/extensions"
  xmlns:date="http://exslt.org/dates-and-times">
  <xsl:template match="/*">
    <xsl:variable name="numeroRuc"
      select="substring(dp:variable('var://context/cpe/nombreArchivoEnviado'), 1, 11)"/>
    <xsl:variable name="hoy" select="date:date()"/>
    <xsl:variable name="segundos" select="date:seconds($hoy)"/>
    <xsl:value-of select="$numeroRuc"/>
  </xsl:template>
  <xsl:include href="local:///commons/error/validate_utils.xsl"/>
</xsl:stylesheet>`;
}

describe('TA-31 adaptador de hojas XSL', () => {
  describe('normalizarHojaSunat', () => {
    it('reemplaza dp:variable por el parámetro propio', () => {
      const hoja = normalizarHojaSunat(hojaConRasgosOficiales());

      expect(hoja).toContain('$nombreArchivoEnviado');
      expect(hoja).not.toContain("dp:variable('var://context/cpe/");
    });

    it('elimina las funciones EXSLT date: que xslt-processor no tiene', () => {
      const hoja = normalizarHojaSunat(hojaConRasgosOficiales());

      expect(hoja).toContain('$date-date');
      expect(hoja).toContain('$date-seconds');
      expect(hoja).not.toContain('date:date()');
      expect(hoja).not.toContain('date:seconds(');
    });

    it('retira el xsl:include a la carpeta commons de SUNAT', () => {
      const hoja = normalizarHojaSunat(hojaConRasgosOficiales());

      expect(hoja).not.toContain('commons/error/validate_utils.xsl');
      expect(hoja).not.toContain('<xsl:include');
    });

    it('declara el parámetro y las variables globales en el template raíz', () => {
      const hoja = normalizarHojaSunat(hojaConRasgosOficiales());

      expect(hoja).toContain('<xsl:param name="nombreArchivoEnviado"');
      expect(hoja).toContain('<xsl:variable name="date-date"');
      expect(hoja).toContain('<xsl:variable name="date-seconds"');
    });

    it('es idempotente: normalizar dos veces da el mismo resultado', () => {
      const unaVez = normalizarHojaSunat(hojaConRasgosOficiales());
      const dosVeces = normalizarHojaSunat(unaVez);

      expect(dosVeces).toBe(unaVez);
    });

    it('descomenta la variable que SUNAT dejó comentada en la Nota de Débito', () => {
      const conComentario = hojaConRasgosOficiales().replace(
        '<xsl:template match="/*">',
        `<xsl:template match="/*">
         <!--<xsl:variable name="MontoDescuentoAfectoBI" select="sum(cac:AllowanceCharge)"/>-->
         <xsl:value-of select="$MontoDescuentoAfectoBI"/>`,
      );

      const hoja = normalizarHojaSunat(conComentario);

      expect(hoja).not.toContain('<!--<xsl:variable name="MontoDescuentoAfectoBI"');
      expect(hoja).toContain('<xsl:variable name="MontoDescuentoAfectoBI"');
    });

    it('declara un $nroLinea global para las plantillas de cabecera', () => {
      const conNroLinea = hojaConRasgosOficiales().replace(
        '<xsl:template match="/*">',
        `<xsl:value-of select="$nroLinea"/>
  <xsl:template match="/*">`,
      );

      const hoja = normalizarHojaSunat(conNroLinea);

      expect(hoja).toContain('<xsl:variable name="nroLinea" select="\'\'"/>');
    });

    it('no toca una hoja que ya es XSLT estándar', () => {
      const estandar = `<?xml version="1.0"?>
<xsl:stylesheet version="1.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform">
  <xsl:template match="/*"><xsl:value-of select="'ok'"/></xsl:template>
</xsl:stylesheet>`;

      const hoja = normalizarHojaSunat(estandar);

      expect(hoja).toContain("<xsl:value-of select=\"'ok'\"/>");
    });
  });

  describe('nombreArchivoDesdeXml', () => {
    it('arma RUC-tipo-serie-correlativo como lo espera SUNAT', () => {
      const xml = `<Invoice>
        <cbc:InvoiceTypeCode xmlns:cbc="cbc">01</cbc:InvoiceTypeCode>
        <cbc:ID xmlns:cbc="cbc">F001-7</cbc:ID>
        <rucEmisor>20601012341</rucEmisor>
      </Invoice>`;

      expect(nombreArchivoDesdeXml(xml)).toContain('20601012341');
      expect(nombreArchivoDesdeXml(xml)).toContain('.xml');
    });

    it('devuelve cadena vacía si el XML no trae tipo de comprobante', () => {
      expect(nombreArchivoDesdeXml('<Invoice></Invoice>')).toBe('');
    });
  });

  describe('XSL_POR_TIPO', () => {
    it('mapea los cuatro tipos a sus hojas oficiales', () => {
      expect(XSL_POR_TIPO['01']).toBe('Factura 2.0.1.xsl');
      expect(XSL_POR_TIPO['03']).toBe('Boleta 2.0.1.xsl');
      expect(XSL_POR_TIPO['07']).toBe('Nota de Credito 2.0.1.xsl');
      expect(XSL_POR_TIPO['08']).toBe('Nota de Debito 2.0.1.xsl');
    });

    it('no mapea tipos que el módulo no emite', () => {
      expect(XSL_POR_TIPO['09']).toBeUndefined();
      expect(XSL_POR_TIPO['20']).toBeUndefined();
    });
  });
});
