# M1 — consulta RUC del receptor (punto 4)

## Bases y dependencia

- Backend main: `bfd51637397abefb87f08e6a9092d67d0f0cc03e`.
- Frontend dev: `da8f3874b03e46a8f0f1d29c0e69d9dcdcc21431`, CarlosSoles/Fronted-sistema-mype-sunat.
- Requiere aplicar y desplegar primero `fix/m1-receptor-direccion-ruc` del backend, commit `9433b179e3f8b6276e7dba423feaa2700c1e9f70`: acepta `customer_address` opcional en `/invoices/emitir`. La versión anterior rechaza ese campo por whitelist. El GET RUC y su autenticación ya existían; no cambian.
- Este ferry se entrega exclusivamente en Jhordy-Salirrosas/Sistema-gestion-mype-sunat. No se empuja al repo front ni se crea PR.

## Comportamiento

En `/invoices/emision`, completar un RUC válido (11 dígitos y módulo 11 vigente) dispara, tras 300 ms, `apiClient.get('/sunat/ruc/:ruc')`: base `/api/v1`, token y tenant del cliente HTTP central. Rellena razón social y dirección del receptor. Ambos campos son editables; la dirección editada viaja como `customer_address` y queda en el payload UBL y el XML del receptor.

El alta de clientes en `/invoices/clientes` y «Registrar cliente nuevo» de emisión usan el mismo mecanismo. `PartnerFormDialog` recibe una opción aditiva `enableRucLookup` que por defecto es falsa. Solo consulta al escribir un documento RUC, en país PE y con rol CLIENTE; no activa consultas en altas de proveedores, terceros extranjeros ni módulos ajenos. No consulta automáticamente documentos preexistentes al abrir una edición o un formulario precargado; la consulta sigue a la edición del RUC.

Una consulta fallida, un RUC no encontrado o una respuesta inválida muestran un aviso no bloqueante y permiten completar manualmente. Si falta dirección no se inventa: se pide completarla. Cambiar documento, elegir cliente del maestro, editar nombre/dirección o cerrar invalida respuestas pendientes; cambiar tipo/país/rol en el alta también las invalida. El debounce evita consultas por cada dígito. El maestro conserva sus permisos de crédito/descuento: la consulta RUC no crea una selección del maestro ni modifica indicadores tributarios.

Solo se usan datos del receptor. No se escribe configuración del emisor, no se añaden credenciales al front, no se consulta Decolecta directamente y las pruebas nuevas usan exclusivamente dobles locales.

## Aplicación

1. Preparar una rama en el frontend sobre el SHA base indicado. Si dev avanzó, integrar los cambios con revisión; estos archivos completos no deben sobrescribir cambios posteriores sin compararlos.
2. En un checkout de este ferry, ejecutar `sha256sum -c SHA256SUMS`.
3. Copiar las rutas bajo `frontend/` a las mismas rutas relativas del repo frontend (retirar únicamente el prefijo `frontend/`). Son 8 archivos de producción y 2 archivos de pruebas. No hay dependencias nuevas ni archivos de entorno.
4. Ejecutar `npm ci`, `npm test -- --coverage`, luego `npm run build`. Mantener el build separado de las pruebas. Revisar el diff y promover por el flujo habitual de Emma.

El manifiesto SHA256SUMS cubre FERRY.md y todos los archivos transportados; se verifica desde la raíz del ferry. No incluye su propio hash.

## Validación

- Frontend base: 166 archivos / 1276 pruebas aprobadas; final: 168 archivos / 1308 pruebas aprobadas (+2 archivos / +32 pruebas), sin fallos ni omisiones. Suite completa con cobertura.
- Código front nuevo contra dev: 47/47 líneas ejecutables y 48/48 ramas instrumentadas, 100%. useRucAutofill y rucApi: 100% en líneas, sentencias, funciones y ramas. Medición local desde coverage-final.json y diff, sin ejecución de SonarCloud.
- Backend base main: 351 suites / 3459 pruebas aprobadas; rama aditiva: 352 suites / 3469 pruebas aprobadas, mismas 4 suites / 38 pruebas omitidas y 12 snapshots. Código nuevo: 1/1 líneas ejecutables con inicio instrumentado y 4/4 ramas nuevas, 100%.
- Builds de ambos repositorios correctos, posteriores a las suites. Lint back sin errores y tres advertencias heredadas. ESLint de archivos front modificados conserva un error previo react-hooks/set-state-in-effect de InvoiceEmissionPage y tres advertencias previas de Fast Refresh; el error se comprobó en un checkout separado de la base da8f387. No hay errores de lint nuevos.
- Commit local front probado: `ca356ce37e592f09edb5326d548708e7f1d36a92`; no empujado a su repo. Los diez archivos transportados coinciden byte por byte con ese commit.
- Pruebas nuevas: contrato RUC, validación/debounce, 404/503/red/respuesta incorrecta, dirección ausente, carreras y edición manual, maestro y permisos, emisión con payload editado, altas reales de Facturación y desde emisión, exclusión del contexto compartido ajeno a Facturación. Solo dobles, sin Decolecta real. Prueba fiscal backend con firma ficticia y hoja SUNAT local.

## Alcance y reversión

Cambios aditivos en el formulario compartido de terceros y su página: opción de consulta exclusiva para Facturación y cancelación de respuestas pendientes ante ediciones. El cambio de serialización solo añade dirección cuando hay un valor útil. No hay cambios en otros módulos, migraciones, emisiones reales, nuevos PR, despliegues ni llamadas reales a Decolecta.

Para retirar el front, revertir el commit de aplicación de estas rutas. El backend opcional puede permanecer desplegado: las peticiones sin dirección conservan exactamente su payload/XML anterior. No reescribe documentos históricos.
