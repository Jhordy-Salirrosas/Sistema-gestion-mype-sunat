# Deuda: el validador XSL no valida

**Detectado:** 31 de octubre de 2026, durante TA-62.
**Estado:** abierto. Requiere tarea propia.
**Afecta a:** TA-31 (validador XSL), TA-58 (compuerta previa al envío).

---

## 1. El síntoma

El validador se ejecuta, no lanza errores y devuelve `valido: true` para
cualquier XML. No es que apruebe bien: no valida.

Sobre un XML **correcto** (`fixtures/sunat-invoice/factura-ubl21.xml`,
S/ 1000 + IGV 180) devolvía 12 errores falsos:

```
0001, 2026, 2012, 3456, 0786, 2098, 7654, 0321, 0180, 1000, 1180, 0100
```

Esos números no son códigos de SUNAT. Son extractos del propio XML:
`2012` es parte del RUC `20123456786`, `1000` es la base imponible y `1180` el
total. El interpretador buscaba cualquier secuencia de 3-4 dígitos en la salida
y la trataba como código de error.

## 2. La causa

La hoja oficial `Factura 2.0.1.xsl` no contiene sus reglas de validación: las
importa de otro archivo.

```xml
<xsl:include href="local:///commons/error/validate_utils.xsl" />
```

En `src/modules/invoices/application/services/sunatXslAdapter.ts`, paso 6, ese
import se borraba con este comentario:

> "el archivo no viaja con la hoja y **solo aporta utilidades de mensaje**, así
> que se retira."

**Ese comentario era falso.** En `validate_utils.xsl` viven las plantillas que
hacen la validación:

| Plantilla | Llamadas en la hoja de Factura |
|---|---|
| `isTrueExpresion` | 277 |
| `regexpValidateElementIfExist` | 251 |
| `existAndRegexpValidateElement` | 20 |
| **Total de `call-template` en la hoja** | **1 552** |

Sin ellas, XSLT no falla: una llamada a una plantilla inexistente simplemente
no produce nada. La hoja se ejecuta y devuelve el XML copiado, sin ningún
código de error.

## 3. Verificación de la dependencia

Se descargó el ZIP oficial publicado en
<https://cpe.sunat.gob.pe/guias-y-manuales>, sección "ARCHIVOS XSL - XSD":
**`XSL Actualizado al 06092022.zip`**.

Resultado:

- El ZIP contiene **solo** la carpeta `validaciones/` con 15 archivos `.xsl`.
- **No incluye `commons/`, ni `validate_utils.xsl`, ni `error_utils.xsl`.**
- Las 4 hojas que usa el sistema son **byte a byte idénticas** a las del ZIP
  (verificado por SHA-256). La hoja no está mal elegida: está incompleta.

Las **15** hojas del ZIP dependen de esos archivos, por ruta `local:///` o
relativa `../../../commons/error/...`. SUNAT no publica ninguno.

Búsquedas descartadas: `thegreenter/cpe-validator`, `thegreenter/greenter` y
la organización `project-openubl` no distribuyen esas hojas.

## 4. Segundo bloqueo (no obvio)

Aunque se consiguiera el archivo, no bastaría. **La hoja no usa
`xsl:message`** (0 apariciones en las 15 hojas). Descarga los avisos como efecto
secundario dentro de `validate_utils.xsl`.

Greenter lo resuelve así (`cpe-validator`, `XslValidator.php`):

```php
$proc->transformToXML($document);
$errors = $this->getErrors(libxml_get_errors());   // ← mensajes de transformación
```

Nuestro `SunatXslValidatorService` mira el **texto de salida**, no los mensajes
de transformación. `xslt-processor` (JS, XSLT 1.0) no los expone igual que
`libxslt`.

**Conclusión: hacen falta dos cosas, no una.**
1. Las plantillas (`validate_utils.xsl` + `error_utils.xsl`).
2. Un motor que emita el código como `xsl:message` y se pueda leer.

## 5. Por qué el Sprint 2 no lo detectó

El único test contra la hoja real
(`test/unit/invoices/ta31-xsl-oficial.spec.ts`) comprobaba:

```ts
expect(resultado.bloqueado).toBe(false);
expect(Array.isArray(resultado.errores)).toBe(true);   // siempre cierto
```

Nunca miró el contenido. Los demás tests de TA-31 usan
`test/fixtures/xsl/2.0.1.xsl`, una hoja **falsa** que imita un contrato que las
hojas reales no tienen.

## 6. Qué se hizo en TA-62 (mitigación, no arreglo)

1. Se corrigió el comentario falso del adaptador.
2. Se añadió `validaDeVerdad()` en `sunatXslAdapter.ts`, que hoy devuelve
   `false` y documenta el estado.
3. `ResultadoValidacionXsl` gana el campo `validadoDeVerdad`.
4. El validador ya **no inventa códigos**: si no puede validar, devuelve
   `bloqueado: true`, `errores: []` y un `motivoBloqueo` que explica qué falta.
5. Los tests de TA-31 y TA-62 ahora **documentan el defecto** en lugar de
   taparlo.

**Efecto operativo:** la compuerta de TA-58 se cierra
(`ErrorValidacionBloqueada`) en lugar de dejar pasar todo. El job vuelve a la
cola sin consumir intento. Es el comportamiento correcto mientras no haya
validador real: no se envía a ciegas.

## 7. Opciones para la tarea nueva

| Opción | Trabajo | Riesgo |
|---|---|---|
| A. Reimplementar `validate_utils.xsl` y `error_utils.xsl` | Alto: son las 3 plantillas más el segundo archivo | **Alto**: si una regla se desvía, aprueba algo inválido y nadie lo sabe |
| B. Motor que lea `xsl:message` + plantillas propias | Alto | Medio-alto: mismo riesgo que A, más el motor |
| C. Validar con libxslt real (contenedor o proceso hijo) | Medio | Bajo, pero sigue faltando el archivo |
| D. No validar localmente: confiar en el XSD + validación de SUNAT | Bajo | El error llega en el CDR, después de gastar el envío |

**Recomendación:** ninguna de A o B se acepta sin un corpus de regresión
(decenas de XML válidos e inválidos con su resultado esperado). Un validador
que falla en verde es peor que no tenerlo.

## 8. Archivos relevantes

- `src/modules/invoices/application/services/sunatXslAdapter.ts` — paso 6
- `src/modules/invoices/application/services/sunatXslValidatorService.ts`
- `src/modules/invoices/application/services/invoiceSendGate.ts`
- `src/modules/invoices/invoiceJobConsumer.ts`
- `assets/sunat-xsl/` — las 4 hojas, idénticas a las oficiales
- `test/unit/invoices/ta31-validador-xsl.spec.ts`
- `test/unit/invoices/ta31-xsl-oficial.spec.ts`
- `test/unit/invoices/ta62-multi-item-catalogo07-icbper.spec.ts`
