<?xml version="1.0" encoding="UTF-8"?>
<!--
  Hoja XSL de PRUEBA para TA-31 (FACTURA).

  NO es la hoja oficial de SUNAT: es una imitacion minima del contrato de
  salida de la oficial (un codigo de error por cada problema encontrado), para
  que las pruebas del validador sean rapidas y deterministas sin depender de
  archivos de cientos de KB que no se versionan.

  El nombre del archivo SI coincide con el de la hoja oficial ('Factura
  2.0.1.xsl') porque el validador la busca por nombre; asi la prueba ejercita
  el mismo camino que produccion.

  Las pruebas contra la hoja REAL se hacen apuntando SUNAT_XSL_DIR a la
  carpeta con las hojas descargadas de SUNAT.
-->
<xsl:stylesheet version="1.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform"
                xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2">
  <xsl:output method="text"/>

  <xsl:template match="/">
    <!-- 2100: el total no cuadra con base + IGV -->
    <xsl:if test="number(//cbc:LineExtensionAmount) + number(//cbc:TaxAmount) != number(//cbc:PayableAmount)">
      <xsl:text>2100 El total no coincide con la base imponible mas el IGV&#10;</xsl:text>
    </xsl:if>

    <!-- 2022: el adquirente es el mismo emisor -->
    <xsl:if test="//cbc:CustomerAssignedAccountID[1] = //cbc:CustomerAssignedAccountID[2]">
      <xsl:text>2022 El adquirente coincide con el emisor&#10;</xsl:text>
    </xsl:if>

    <!-- 2800: monto total no positivo -->
    <xsl:if test="number(//cbc:PayableAmount) &lt;= 0">
      <xsl:text>2800 El monto total debe ser mayor que cero&#10;</xsl:text>
    </xsl:if>
  </xsl:template>
</xsl:stylesheet>
