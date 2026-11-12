# Histórico cerrado: sustitución del validador XSL por SFS oficial

**Estado:** deuda original cerrada por TA-70. La validación por defecto utiliza el juego oficial completo de assets/sunat-sfs mediante el ejecutor SFS y bloquea el envío si no puede validar. Los síntomas y propuestas siguientes se conservan como diagnóstico histórico, no como descripción del motor vigente.

**Actualización Parte 8F-F2:** se retiraron la compatibilidad explícita SUNAT_XSL_DIR y el árbol assets/sunat-xsl. El SFS oficial es el único motor del validador y de su diagnóstico. La disponibilidad de Python/lxml y del juego oficial sigue siendo un requisito operativo; su ausencia bloquea el envío.

## Diagnóstico histórico (31 de octubre de 2026)

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

## 4-bis. Tercer bloqueo: `xslt-processor` no ejecuta `xsl:call-template` (verificado)

Detectado el 31 de octubre de 2026 al intentar cerrar esta deuda. **Este bloqueo
cambia la conclusión del apartado anterior: las opciones A y B no son viables.**

Lo que se comprobó, ejecutando la hoja oficial
(`assets/sunat-xsl/Factura 2.0.1.xsl`) sobre un XML válido
(`fixtures/sunat-invoice/factura-ubl21.xml`, S/ 1000 + IGV 180):

| Prueba | Resultado observado |
|---|---|
| Hoja oficial tal como está | Cabecera de salida `\n\t\t\n\t\t-`: **cero códigos** |
| Reemplazar `isTrueExpresion` por una plantilla propia con `name=` | **No se ejecuta nunca** (0 llamadas), pese a ser 277 en la hoja |
| `<xsl:call-template name="X"/>` desde `match="/*"` | Emite **cadena vacía**, sin lanzar error |
| Lo mismo desde dentro de otra plantilla | Igual: se pierde en silencio |
| `<xsl:choose>` + `<xsl:value-of>` sueltos, en el mismo sitio | Funcionan correctamente |

**Causa:** `xslt-processor` (v5.1.2) no resuelve las llamadas a plantillas con
`name=`. No falla: descarta la llamada. La consecuencia es que las 1 552
llamadas de la hoja oficial nunca se ejecutan, **aunque se añada
`validate_utils.xsl`**. Reproducible en una hoja mínima de 5 líneas.

**Qué implica:**

- El apartado 4 explicaba por qué no se veían los errores. Este añade que las
  reglas tampoco se ejecutan: el problema es del **motor**, no solo del archivo.
- La opción C del apartado 7 ("libxslt real") deja de ser la alternativa
  conservadora y pasa a ser la única vía que reutiliza las plantillas de SUNAT.
- La opción B ("motor propio que lea `xsl:message`") tampoco sirve si el motor
  reimplementado no resuelve `call-template`. Y reimplementar XSLT 1.0 no es el
  objetivo de este proyecto.
- Un validador **parcial** es peor que ninguno: al conectar solo
  `regexpValidateElementIfExist` (251 de 1 552), el fixture válido de
  S/ 1000 + IGV 180 sale **RECHAZADO**, porque la hoja busca
  `cac:AccountingCustomerParty` y el XML no lo trae. Un veredicto equivocado
  frena comprobantes correctos con el mismo criterio con el que deja pasar los
  incorrectos.

**Alternativas reales, en orden de preferencia:**

| Opción | Costo | Riesgo |
|---|---|---|
| C1. `saxon-js` (XSLT 2.0/3.0 en JS, compilador SE compilado a SJS) | Medio | Bajo: motor probado que sí resuelve `call-template` |
| C2. `libxslt` en un proceso hijo o contenedor | Medio | Bajo, pero añade un binario al despliegue |
| D. No validar localmente: confiar en el XSD + la validación de SUNAT | Bajo | El error llega en el CDR, después de gastar el envío |

---

## 4-ter. Salida adoptada: bandera explícita de demostración

Mientras la deuda siga abierta, la compuerta hace lo correcto: **se cierra**.
Pero un sistema que no emite no se puede demostrar, así que desde el 31 de
octubre existe un interruptor explícito, `BYPASS_XSL_GATE_DEMO=true`:

- **Solo** el valor exacto `true` lo activa (`TRUE`, `1`, `si` y cualquier otro
  valor **no** lo activan). Sin la variable, todo sigue como antes.
- Cuando está activo, el comprobante pasa a `processWithRetry` **sin** ejecutar
  el validador (se comprueba antes de invocarlo, para no gastar el costo de una
  hoja de 500 KB que se va a descartar).
- Deja constancia visible en **dos** sitios:
  - consola: `[WARN][DEMO] <id>: Compuerta XSL omitida por bandera explícita de
    demostración (BYPASS_XSL_GATE_DEMO=true; limitación de xslt-processor con
    xsl:call-template documentada en specs/DEUDA_VALIDADOR_XSL.md)`;
  - historial del comprobante (`CdrPersistenceService.persistFailure`, con el
    **mismo** texto, `codigoError: null` y **sin** cambiar el estado): la
    omisión no es un rechazo.
- Si el historial no se puede escribir, el envío **no** se detiene: se decide
  enviar y se pierde solo la constancia, no el comprobante.

Implementación: `bypassDemoActivo()`, `decidirEnvio()` y `AVISO_DEMO` en
`src/modules/invoices/application/services/invoiceSendGate.ts`. Pruebas:
`test/unit/invoices/ta58-bypass-demo.spec.ts` (17 casos).

---

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

> **Actualizado el 31 de octubre tras verificar el apartado 4-bis.** Las filas A
> y B se conservan porque explican cómo se pensó el problema, pero **ya no se
> recomiendan**: con el motor actual no llegan a ejecutar ninguna regla.

| Opción | Trabajo | Riesgo | ¿Viable hoy? |
|---|---|---|---|
| A. Reimplementar `validate_utils.xsl` y `error_utils.xsl` | Alto: son las 3 plantillas más el segundo archivo | **Alto**: si una regla se desvía, aprueba algo inválido y nadie lo sabe | **No**: `xslt-processor` no ejecuta `call-template` |
| B. Motor que lea `xsl:message` + plantillas propias | Alto | Medio-alto: mismo riesgo que A, más el motor | **No**: un motor que no resuelve `call-template` no sirve aquí |
| C1. `saxon-js` para ejecutar las hojas oficiales | Medio | Bajo: motor probado con soporte real de plantillas | **Sí, es la preferida** |
| C2. `libxslt` en proceso hijo o contenedor | Medio | Bajo, pero añade un binario al despliegue | **Sí** |
| D. No validar localmente: confiar en el XSD + validación de SUNAT | Bajo | El error llega en el CDR, después de gastar el envío | Sí |

**Recomendación:** ninguna de A o B se acepta sin un corpus de regresión
(decenas de XML válidos e inválidos con su resultado esperado). Un validador
que falla en verde es peor que no tenerlo. Hoy la vía corta es C1: cambiar el
motor y conservar las hojas y el adaptador; la deuda real deja de ser "falta un
archivo" y pasa a ser "falta el motor adecuado".

**Mientras tanto:** la compuerta se cierra y, si hay que exponer el sistema, se
activa `BYPASS_XSL_GATE_DEMO=true` con el aviso correspondiente (apartado 4-ter).

## 8. Rendimiento: además de no validar, es demasiado lento

Medido el 31 de octubre de 2026 sobre `dev`, ejecutando la hoja oficial
`Factura 2.0.1.xsl` (≈500 KB) con `xslt-processor` sobre el fixture
`fixtures/sunat-invoice/factura-ubl21.xml`:

| Ejecución | Tiempo observado |
|---|---|
| Primera (calentamiento del intérprete) | **77 726 ms** |
| Segunda | **40 756 ms** |
| Tercera | **5 449 ms** |

El presupuesto fijado para la compuerta es de **2 000 ms**. Ni la ejecución más
rápida entra en él: la tercera tarda todavía 2,7 veces más.

**Por qué importa aunque la compuerta esté cerrada:** si algún día se activa
`BYPASS_XSL_GATE_DEMO=false` en un entorno con hojas nuevas, o se conserva
`xslt-processor` como respaldo tras arreglar el motor, cada comprobante gastaría
entre 5 y 78 segundos antes de tocar la red. Con `teamSize: 1` y
`batchSize: 1` en la cola, eso es la misma demora por cada comprobante de la
fila.

**Consecuencia para quien cierre la deuda:** cambiar el motor no es solo una
decisión de corrección, es también la del rendimiento. C1 (`saxon-js`, que
precompila la hoja a SEF) y C2 (`libxslt` en C) resuelven las dos cosas a la
vez; reimplementar plantillas sobre el motor actual no arreglaría la lentitud.

## 9. Archivos relevantes

- `src/modules/invoices/application/services/sunatXslAdapter.ts` — paso 6
- `src/modules/invoices/application/services/sunatXslValidatorService.ts`
- `src/modules/invoices/application/services/invoiceSendGate.ts` — bandera de demo
- `src/modules/invoices/invoiceJobConsumer.ts`
- `assets/sunat-xsl/` — las 4 hojas, idénticas a las oficiales
- `test/unit/invoices/ta31-validador-xsl.spec.ts`
- `test/unit/invoices/ta31-xsl-oficial.spec.ts`
- `test/unit/invoices/ta62-multi-item-catalogo07-icbper.spec.ts`
- `test/unit/invoices/ta58-bypass-demo.spec.ts` — bandera de demostración
