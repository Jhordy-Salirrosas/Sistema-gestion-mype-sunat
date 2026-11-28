# M1 — Validación de la cuenta de detracciones del Banco de la Nación

## Bases y destino

- Base front exacta: `CarlosSoles/Fronted-sistema-mype-sunat`, `main`, `e434cc64defee3c8e9458ca37b6342c767369d48`.
- Commit local front: `99e0acbbb865ed77b147e5c6fd8f4bf1d125af49`, sin push al front.
- Rama front sugerida: `fix/m1-cuenta-bn-validacion`.
- Base back exacta: `Jhordy-Salirrosas/Sistema-gestion-mype-sunat`, `main`, `beff7af62ca8541e647a5ee2d7b91e1d106e9f72`.
- Rama de entrega: `ferry/m1-cuenta-bn-validacion`.

## Verificación y cambio

En el front se confirma la ausencia de `cuenta_banco_nacion` en la validación fiscal. Se añade al mismo recorrido de campos de dígitos, con longitud 11 y vacío permitido. El mensaje es `cuenta_banco_nacion: debe contener 11 dígitos.`.

El input `cfg-cuenta-bn` filtra caracteres que no sean dígitos ASCII al escribir y pegar, conserva los ceros iniciales y mantiene `maxLength=11`. Al pegar se filtra antes del límite y se respeta la selección actual, para que las letras no consuman posiciones de la cuenta.

En el back, `InvoiceConfigService.actualizar` delegaba el guardado a `IssuerConfigWriter`. La base ya incluye regex de 11 dígitos en `validateIssuerInput` y en el writer, pero con errores genéricos `CONFIG_INPUT_INVALID` / `CONFIG_FISCAL_INVALID`. Por tanto, la premisa de ausencia completa de validación en el back no se sostiene en esta base. Se añade la guarda explícita pedida en el servicio para devolver HTTP 400 con el mensaje específico antes de delegar al writer; la validación existente permanece intacta.

Se mantienen las convenciones existentes de normalización de espacios, cuenta vacía/null para limpiar y campo omitido para conservar. Una cuenta válida se guarda como texto, sin perder ceros. No se modifican otros campos ni módulos, los servicios de emisión, el bloqueo SPOT sin cuenta, los cálculos ni los payloads de emisión. No hay migraciones ni cambios retroactivos de datos.

## Archivos de aplicación

- Back, en sus rutas reales: `src/modules/invoices/application/services/invoiceConfigService.ts` y `test/unit/invoices/invoiceConfigBnAccount.spec.ts`.
- Front: copiar los cuatro archivos de `frontend/` a sus rutas relativas a la raíz del repo front. No hay archivos que eliminar en el front.
- Los archivos `FERRY.md` y `SHA256SUMS` son solo transporte y no forman parte del código de producción del front.

La base del back conservaba `frontend/`, `DELETE_PATHS.txt` y manifiestos de una entrega anterior. Se retiran exclusivamente los artefactos antiguos del transporte para que `frontend/` contenga solo esta corrección. **Esas eliminaciones del diff del back no son instrucciones de eliminación en el front.** El manifiesto nuevo cubre únicamente los cuatro archivos front, los dos archivos back y este documento.

## Verificaciones

- Front, pruebas dirigidas: **2 archivos / 29 pruebas**, verde. Incluyen 11 dígitos válidos, letras, longitudes 10/12, vacío, ceros iniciales, tecleo/pegado, bloqueo de datos precargados inválidos y guardado válido/null.
- Back, pruebas dirigidas: **2 suites / 59 pruebas**, verde. Incluyen el writer existente y la nueva guarda del servicio, ausencia de escritura ante cuenta inválida, cuenta válida/vacía/null/omitida y conservación de la validación de otros cuerpos/tipos.
- Suite completa front: **232 archivos / 1704 pruebas**, verde sobre el código final (`npm test`).
- Suite completa back: **462 suites / 4629 pruebas aprobadas**; 30 suites y 172 pruebas omitidas según las condiciones de integración existentes (492 suites / 4801 pruebas descubiertas). Comando: `npm test -- --maxWorkers=2 --workerIdleMemoryLimit=512MB`.
- Build front: `npm run build`, OK.
- Build back: `npm run build`, OK, después de terminar Jest. Se desactivaron las variables de Render y se usaron URLs locales simuladas para impedir migraciones/conexiones a la base compartida; el prebuild informó `[render-migrate] Omitido: no se ejecuta fuera de Render`.
- Pruebas con dobles y configuración de pruebas; sin emisiones reales, migraciones ni escrituras sobre la base compartida. El cliente Prisma se genera localmente con `prisma generate --config prisma7.config.ts`.

## Manifiesto

Ejecutar `sha256sum -c SHA256SUMS` desde la raíz de la rama. El manifiesto incluye los seis archivos de código/pruebas entregados y `FERRY.md`.

## Diff de los archivos front

| Ruta transportada | Diff respecto de la base front |
| --- | ---: |
| `frontend/src/modules/invoices/components/InvoiceIssuerConfigForm.tsx` | +9 / −1 |
| `frontend/src/modules/invoices/lib/invoiceConfigurationValidation.ts` | +1 / −1 |
| `frontend/test/unit/modules/invoices/invoiceConfigurationValidation.test.ts` | +5 / −0 |
| `frontend/test/unit/modules/invoices/invoiceIssuerBnAccount.test.tsx` | +29 / −0 |

## Diff de los archivos back de aplicación

| Ruta | Diff respecto de la base back |
| --- | ---: |
| `src/modules/invoices/application/services/invoiceConfigService.ts` | +7 / −1 |
| `test/unit/invoices/invoiceConfigBnAccount.spec.ts` | +32 / −0 |
