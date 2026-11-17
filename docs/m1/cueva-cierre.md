# Semana Cueva — paquete 4

## Fase 0

Bases autorizadas y verificadas por `git ls-remote`: back dev
`646fa51a9e1862efc9265c529d0d33b81f44d978`; front main
`4fb2d30f841a374ce53efc57d790832b52c68510`.
Rama: `feat/cueva-cierre`, recreada desde la nueva base; reemplaza el informe
anterior que se había detenido por discrepancia de cabezas. No hay merges.

El PR #412 se corrigió primero en su rama: `a806fd0d`, dos suites PostgreSQL,
5 pruebas aprobadas, ninguna omitida. Esta rama no incorpora esa entrega.

### Inspección por punto

| Parte | Estado encontrado y decisión |
| --- | --- |
| P1 | PR #305 ya agregó medio_pago al DTO, payload y ambas entradas de emisión; catálogo incluye efectivo, Yape, Plin, tarjeta, transferencia, depósito y cheque. El puente solo carga CXC; falta clasificar el cobro y configurar el valor global. Se conserva el catálogo compatible y el tratamiento del crédito. |
| P2 | Hay resolución de credenciales y diagnóstico local X.509, sin prueba remota segura en configuración. Agregar diagnóstico beta de lectura, sin emitir/anular ni modificar comprobantes. |
| P3 | Existe input nativo .p12/.pfx y subida JSON cert_base64/cert_password en PUT invoices/config; no está oculto en JSX, pero carece de estilo explícito del botón tras el reset CSS. Hacer visible su acción sin cambiar el contrato. |
| P4 | Las pantallas de configuración existen separadas. Sidebar, appRoutes, roleNavigation y controladores auth/config están en la entrega de roles. Esos archivos quedan detenidos por secuencia; construir únicamente la agrupación y endpoints independientes que no los sobrescriben. |
| P5 | Lista navega al emitir factura/boleta; ya hay modal de notas. CustomerLookupField ya abre PartnerFormDialog y selecciona lo guardado. Reutilizar ese mecanismo y useRucAutofill/consultarDni de Decolecta; no duplicar proveedor ni validación documental del equipo. |
| P6 | ND admite importes positivos y aumenta la operación; deliberadamente no consume saldo (prueba TA-66 explícita). No se declarará ya cumplido el requisito de saldo decreciente. Se implementa el consumo de saldo confirmado por el encargo; se documenta el cambio de regla en P6. |
| P7 | Solo diseño de sucursal/caja/serie y plan gradual. |

Los fixtures de fecha invoiceBagsRegistered e invoiceFormValidation usan
hoyLima relativo, no fechas fijas fuera de plazo.

### Protección de la entrega de roles

Se contrastó la entrega `d28ffc8059..a806fd0d` y el inventario de sus 72
archivos de ferry. No se modifican sus fuentes ni pruebas. En particular
`authController.ts`, `invoiceConfigController.ts`, `invoicesController.ts`,
`auth.prisma`, Sidebar, rutas, paleta, atajos y editores de permisos permanecen
fuera de esta entrega. Los manifiestos del ferry describen solo este paquete;
su integración con los del paquete anterior requiere composición secuencial.

### Línea base antes de construir

| Suite completa | Archivos inventariados | Aprobados / fallidos / omitidos | Pruebas aprobadas / fallidas / omitidas |
| --- | --- | --- | --- |
| Back 646fa51a | 435 | 426 / 1 / 8 | 4228 / 1 / 50 (4279 total) |
| Front 4fb2d30 | 199 archivos (367 suites de Vitest) | 199 / 0 / 0 | 1488 / 0 / 0 |

Back: Node 24, Jest --runInBand, NODE_OPTIONS=--max-old-space-size=4096,
TEST_DATABASE_URL a PostgreSQL 17 local efímero y RUN_INTEGRATION_TESTS=required.
Se ejecutaron las integraciones de Outbox y reintento. El único fallo fue el
umbral de latencia de Outbox: 8/10 respuestas menores a 800 ms mientras corría
también Vitest. No se ajusta ni se oculta ese umbral; se repetirá sin carga
simultánea. Las 8 suites/50 pruebas omitidas son las omisiones declaradas por
la base. Front: npm test -- --reporter=json. Resultados completos en
cueva-back-before.json y cueva-front-before.json del workspace.

## P1 — Medio de pago y configuración comercial

Se conserva el catálogo compatible de PR #305 (incluidos depósito y cheque).
Crédito es la forma fiscal, no un medio de cobro. Se corrigió la conversión de
POST /invoices para conservar medioPago, además del camino /emitir que ya lo
hacía. Las ventas nuevas llevan snapshot m1PaymentAccountingVersion=1: el
puente usa caja 1011 para efectivo y la regla COBRO de la empresa para medios
bancarios; admite mapeos COBRO_YAPE, COBRO_PLIN, COBRO_TARJETA, etc. No inventa
subcuentas: sin cuenta 10 válida deja el puente pendiente con error visible.
El crédito conserva CXC; los documentos/asientos históricos sin snapshot no
se reclasifican. El cobro comercial se registra con clave estable m1-cash:ID,
sin segundo asiento COBRO; su reintento no duplica cobros ni asientos. Se
mantienen separadas detracción y retención. El cobro automático solo se puede
anular después del comprobante fiscal; su asiento se revierte por el puente
fiscal y no se genera un reverso COLLECTIONS duplicado. Once pruebas dirigidas
verifican cuentas reales del puente, crédito/histórico, reintento después de un
fallo de cobro e idempotencia y anulación del registro comercial.

GET/PUT /invoices/commercial-defaults almacena la forma y el medio por empresa;
solo ADMIN guarda, cualquier emisor autenticado puede leer dentro del módulo.
La tabla aditiva se gestiona por SQL manual (no se cambia auth.prisma, protegido
por la entrega de roles). Sin fila, Contado/Efectivo. La configuración global
sugiere crédito únicamente para factura con cliente habilitado; conserva la
regla de descuentos del maestro. Ambos formularios M1 y el POS consumen el valor global.
Un fallo de lectura se informa; no se presume que el cliente concede crédito.

El SQL y checksum están en scripts/manual/cueva-commercial-defaults.*. Se
ensayó solo en el contenedor PostgreSQL local. Las pruebas PostgreSQL verifican
persistencia, aislamiento empresarial, catálogo y PUT con guards reales.
Pruebas dirigidas iniciales: 2 archivos/13 pruebas de back aprobadas; build Nest
aprobado. La suite completa del cierre incluye la cobertura de este cambio.

## P2 — Diagnóstico SUNAT beta

POST /invoices/connection-test exige AuthGuard + RolesGuard ADMIN, toma la
empresa del token y resuelve las credenciales guardadas. Usa únicamente
getStatus con ticket de diagnóstico 0000000000000, endpoint beta fijo,
redirects prohibidos y timeout de 8 segundos. El WSDL beta consultado enumera
getStatus, getStatusAR, sendBill, sendPack y sendSummary; no se presupone
getStatusCdr, ausente en ese contrato. No se emite, anula, consulta documento
real ni se escribe estado fiscal. Las pruebas sustituyen el transporte externo.

La respuesta distingue conexión confirmada, rechazo de credenciales y respuesta
no concluyente; HTTP 200 por sí solo no acredita conexión. Los faults ajenos a
una respuesta getStatus reconocida no se declaran éxito. La validez beta no se
presenta como validación de credenciales de producción. El certificado se
inspecciona localmente y se informa por separado (vigente, vencido, futuro,
inválido o ausente). No se publican SOL, PFX, claves ni cuerpo remoto. La
pantalla muestra resultado, latencia y certificado sin emitir documentos.

## P3 — Selector de certificado visible

El input nativo existente permanece visible y asociado a su etiqueta. Se
agrega estilo explícito al botón file-selector-button para que el reset CSS
no elimine su contraste y superficie de acción. La ayuda indica .pfx/.p12 y
96 KiB. Se reutiliza FileReader y PUT /invoices/config con cert_base64 y
cert_password; no hay endpoint, transporte ni validación nuevos.

## P4 — Agrupación de configuración y archivos detenidos

Se construyó la sección Configuración en la ruta administrativa existente
/invoices/configuracion y GET /configuration/links, protegido por guards
reales ADMIN. Agrupa empresa/SOL/certificado, series, facturación, roles y
accesos, importación, SIRE, plan/períodos y reglas contables de compra/venta.
No existen pantallas independientes de configuración de compras/ventas en
esta base: se enlazan sus reglas existentes COMPRA/VENTA, sin duplicarlas.
Los anchors abren la sección correspondiente de las pantallas existentes.
La UI no consulta ni muestra la agrupación para un rol distinto de ADMIN;
el endpoint responde 403 aunque se invoque directamente.

**Archivos detenidos por la regla de secuencia:** la alternativa de un ítem en Sidebar y una
ruta global separada exigiría modificar Sidebar.tsx, appRoutes.tsx,
roleNavigation.ts y el catálogo de menús en auth/domain/menuCatalog.ts, todos
en la entrega de roles. No se sobrescriben ni se agrega un catálogo paralelo.
También se conserva invoiceConfigController.ts, compartido por emisión y en
esa entrega: no se bloquean sus lecturas operativas de series/checklist.
El acceso global se resuelve mediante Navbar.tsx y ConfigurationMenuLink.tsx,
que no pertenecen a la entrega de roles: solo ADMIN ve «Configuración» y se
abre la casa administrativa sobre la ruta ya existente. No hace falta modificar
Sidebar, rutas, paleta ni catálogo de menús para ofrecer este acceso. La
ubicación alternativa en Sidebar queda detenida, sin funcionalidad duplicada.

El servidor incorpora ConfigurationAdminInterceptor para reservar a ADMIN las
mutaciones de catálogos globales de importación, reglas/mapeos/cuentas de
contabilidad, cuentas de tesorería, costo de inventario y configuración SIRE.
También reserva el estado de configuración SIRE. No cambia la operación de
asientos/cierres/compras/ventas ni las lecturas de catálogos compartidas; excluye
expresamente partners, sus contactos y datos fiscales de terceros. La prueba
HTTP comprueba 403 al acceso directo de CONTADOR y acceso ADMIN, además de
la continuidad de las lecturas y edición de clientes.

## P5 — Emisión en contexto e identidad de boleta

La acción de emitir factura/boleta del listado abre el modal de emisión ya
existente y conserva la lista y sus filtros. La elección explícita del tipo
no se sustituye por el perfil comercial. No se crea otro flujo de emisión.
La cabecera precede al detalle en DOM y, desde pantalla ancha, ocupa la columna
izquierda con las líneas a su derecha. En menor ancho se apilan; se conserva
la grilla híbrida y su mecanismo de bolsas, validaciones y atajos.

Boleta muestra un solo input que admite DNI, RUC o razón social: detecta
entrada numérica y usa useRucAutofill/consultarDni/consultarRuc existentes,
o busca por nombre en el maestro. La identidad obtenida se resume como texto.
Los resultados de consulta no otorgan crédito ni descuentos: esos permisos
siguen requiriendo selección del maestro. El alta continúa en PartnerFormDialog,
sin navegación; al guardar se selecciona el registro creado. También permite
completar manualmente la identidad si el proveedor no responde. La consulta
pendiente se cancela al escoger un cliente para no sobrescribirlo.

Pruebas dirigidas: campo único, consulta DNI y selección del alta sin perder
el formulario; diagnóstico con resultado y error: 2 archivos/4 pruebas verdes.
No se altera el maestro de terceros ni la validación documental de cotizaciones.
La revisión de integración detectó además un validador local antiguo que
rechazaba RUC en boleta, aunque el servidor ya lo admite. Se alinea esa regla
con DNI/RUC y se adapta su prueba de regresión; no cambia la validación Módulo
11 ni el requisito de RUC en factura. Se prueba también la consulta RUC desde
el campo único.

## P6 — ND parcial o total con consumo de saldo

Se modifica la premisa anterior: tanto NC como ND vigentes reservan saldo
monetario del afectado. Se excluyen rechazadas/anuladas. Las ND conservan su
tipo fiscal y tratamiento contable; no se contabilizan como devolución ni
consumen unidades físicas para las NC. El atributo histórico `devuelto` del
contrato de saldo conserva su nombre por compatibilidad y ahora informa el
importe aplicado en ambos tipos de nota; la UI lo rotula como aplicado en notas.

Las dos entradas de emisión ejecutan la comprobación dentro de la transacción
común, con bloqueo FOR UPDATE del origen, importes en céntimos y validación de
empresa/adquirente. Se persiste en el payload de la nota m1NoteBalance con
saldo anterior, importe y restante calculados por el servidor; el saldo actual
del afectado se deriva de las notas vigentes, sin columna duplicada susceptible
de desincronizarse. Si una ND anterior ya agota el afectado, no se permite otra.
No se modifican filas históricas ni se ejecuta conversión de datos.

El modal permite indicar importe parcial o aplicar todo el saldo. Distribuye
el ajuste monetario en las líneas de ND sin cambiar producto, unidad, cantidad,
afectación ni bolsas; los valores calculados permanecen como texto. Valida
precisión, positividad, tributos fijos y total exacto antes de aplicar. El
servidor vuelve a liquidar y limita al saldo real al emitir. Los formularios
consultan y refrescan saldo también para ND, sin depender solo del estado UI.

Verificación dirigida: 38 pruebas existentes de notas/cantidades aprobadas;
PostgreSQL real con AtomicInvoiceCreationService comprueba ambas entradas
(pantalla/fiscal), ND 35.40 + 82.60 sobre origen 118, snapshots persistidos,
rechazo del exceso y dos ND concurrentes de 80 (solo una admitida). Tres
archivos/5 pruebas verdes con los controles HTTP administrativos. Front:
2 pruebas de importe parcial/total y rechazo de cero, exceso y precisión.

## P7 — Serie por sucursal

Solo diseño en docs/m1/serie-sucursal-diseno.md: sucursal/caja, vinculación de
F001/F002 y sus contrapartes B/FC/FD, acceso por empresa, numeración atómica,
snapshots fiscales, reportes, históricos y plan gradual con reversa. No hay
implementación ni SQL de sucursales en este paquete.


## Precisión de los conteos

El contador numTotalTestSuites de Vitest incluye agrupaciones describe y no
representa archivos. La fase 0 comunicó inicialmente 367 como archivos; el
JSON completo contiene 199 testResults (archivos) y 1488 pruebas, todos verdes.
La tabla base de este documento queda corregida, manteniendo también las 367
suites para trazabilidad. Los conteos de archivos del cierre se obtienen de
testResults.length; no se mezclan con las agrupaciones internas de Vitest.

## Cierre y verificación

| Suite completa | Antes: archivos | Antes: pruebas | Después: archivos | Después: pruebas |
| --- | --- | --- | --- | --- |
| Back | 435: 426 aprobados, 1 fallido, 8 omitidos | 4279: 4228 aprobadas, 1 fallida, 50 omitidas | 443: 435 aprobados, 0 fallidos, 8 omitidos | 4313: 4263 aprobadas, 0 fallidas, 50 omitidas |
| Front | 199 aprobados (367 suites Vitest) | 1488 aprobadas, 0 fallidas/omitidas | 205 aprobados (374 suites Vitest) | 1504 aprobadas, 0 fallidas/omitidas |

Las corridas finales se ejecutaron secuencialmente: primero Vitest completo,
después Jest completo --runInBand, con el mismo PostgreSQL local,
TEST_DATABASE_URL y RUN_INTEGRATION_TESTS=required. No se excluyó ningún archivo
por CLI. Las nuevas integraciones de configuración y ND se ejecutaron; las
8 suites/50 pruebas omitidas siguen siendo las declaradas por la base. Outbox
y batch-retry se ejecutaron con PostgreSQL real; no se cambió ningún umbral de
latencia y no se repitió el fallo base de Outbox sin carga simultánea de Vitest.
Resultados completos: cueva-front-release.json y cueva-back-release.json en
el workspace de ejecución.

Build Nest/Prisma y build TypeScript/Vite aprobados. Lint de back sin errores;
las tres advertencias corresponden a archivos no modificados. Se verificó
además la política ADMIN con HTTP real, incluyendo variantes de mayúsculas en
rutas, como las admite Express. SQL manual y manifiesto del ferry verificados
con sha256sum -c. No se ejecutó SQL fuera de PostgreSQL local efímero.

### Inventario de entrega

- Front: 24 archivos de delta, 17 fuentes y 7 archivos de pruebas, listados en
  FERRY.md y SHA256SUMS. No se copian fuentes ni pruebas de roles administrables.
- Back: medio de pago/defaults y puente/cobro, diagnóstico SUNAT, agrupación y
  enforcement administrativo, saldo transaccional de notas y sus pruebas.
- Datos: únicamente scripts/manual/cueva-commercial-defaults.sql, su checksum y
  README de preflight/aplicación/reversa; no se aplicó a la base compartida.
- Documentos: este informe y serie-sucursal-diseno.md. P7 no construye sucursales.

La comparación con la entrega de roles d28ffc8059..a806fd0d arroja cero cruces
con sus fuentes/pruebas protegidas. Sidebar, rutas, catálogo de menús, auth y
sus esquemas se conservaron. La alternativa de ubicación en Sidebar se detuvo;
el acceso global ADMIN se implementó en Navbar con la ruta existente, sin
perder la agrupación solicitada. Los manifiestos de ferries deben componerse
siguiendo la secuencia de revisión; los archivos heredados no enumerados en
SHA256SUMS no son parte del delta para aplicar al front.

No se crean PRs, no se fusionan ramas, no se modifican datos de producción.
El despliegue y cualquier aplicación del SQL a una base compartida requieren
coordinación posterior; no se realizaron en este encargo.

### Compatibilidad de los módulos de prueba con la entrega de roles

Los cuatro módulos HTTP nuevos importan AuthModule real mediante un fixture
común y completan ConfigModule para su contexto de prueba. El doble de
persistencia suministra la identidad activa y el catálogo de roles del actor;
las operaciones de negocio de la integración comercial mantienen PostgreSQL
real. No se sustituyen AuthGuard, RolesGuard, SessionMembershipService ni los
servicios de permisos por guards permisivos. Así el módulo raíz resuelve las
dependencias nuevas cuando se integre primero roles administrables.

Se comprobaron los mismos cuatro archivos/seis pruebas sobre 646fa51a y,
mediante overlay local aislado de los archivos nuevos, sobre a806fd0d de roles:
todos aprobados, sin omisiones, con PostgreSQL local. No hubo merge ni cambios
en la rama de roles. Se repite también la suite completa del back con estos
fixtures finales; los conteos del cierre corresponden a esa verificación.


### P1 — Compatibilidad del POS y cobro automático

El POS también consume el default global y comprueba en el maestro si el
cliente admite crédito; no presume crédito por nombre ni por una consulta
DNI/RUC. Los cachés se identifican por usuario/empresa/documento. Conserva la
consulta documental del equipo y soporta el catálogo de medios compatible.

La llamada POST /collections del POS anterior se mantiene compatible: para
ventas nuevas con snapshot de cobro automático, espera al puente o devuelve
el mismo registro m1-cash:ID ya creado. Nunca genera un segundo asiento COBRO
ni otro registro comercial. Rechaza un medio/importe incompatible. Los
comprobantes históricos conservan su flujo de cobranzas. Se prueban la espera,
el reintento idempotente y el rechazo de cambios de importe/medio; tres pruebas
de POS verifican medio global y crédito permitido/denegado por cliente.

## Addendum P6 — Corrección de emisión HTTP de notas

Rama `fix/m1-notas-saldo-http`, desde back main
`db1d2a5773bb7e2f117dd425df9d6caef812a4dc`.

### Causa y corrección

`saldoNotaCalculado` estaba declarado, sin decoradores de validación, en
EmitirComprobanteDto. Con target ES2023, la clase compilada materializa esa
propiedad con valor undefined incluso si el cliente no la envía. La tubería
HTTP con whitelist/forbidNonWhitelisted la rechaza. En la entrada fiscal la
misma clase se instancia dentro de prepareCreation y produce el rechazo
antes de reservar número. Las integraciones anteriores invocaban el servicio
con el transform ES2021 de Jest, que no materializaba el campo de igual forma;
por ello no representaban el comportamiento del build de producción.

El campo sale del DTO de entrada y pasa a PreparedEmission, tipo interno que
se obtiene tras validar el cuerpo y calcular el saldo bajo bloqueo del origen.
El servicio y el adaptador consumen ese tipo; m1NoteBalance conserva su formato
y sigue persistiendo el saldo anterior, importe y restante. No se agrega Allow,
no se amplía el contrato de entrada y no se cambian las opciones de validación.
Enviar saldoNotaCalculado o un campo arbitrario desde el cliente sigue dando 400.

La configuración global de ValidationPipe se extrae sin cambios a
applyGlobalValidation y se reutiliza desde bootstrap y la regresión. El bloque
de opciones y la fábrica de errores son idénticos a los anteriores.

### Regresión que faltaba

notasSaldoHttp.integration.spec.ts usa el AppModule compilado de producción,
la misma tubería global y el filtro HTTP, JWT firmado y usuario/rol/almacén
reales en PostgreSQL. Recorre NC y ND por POST /invoices/emitir (201) y
POST /invoices (202), monto parcial 35.40, saldo restante 82.60 y total inicial
118; verifica snapshots persistidos, reintento idempotente, exceso rechazado
sin incrementar correlativo y rechazo de campos indebidos sin crear documento.

Solo se sustituyen los consumidores que enviarían documentos y la consulta
externa de padrón; no los guards ni los servicios de autorización, creación,
liquidación, persistencia o cola. Cada corrida crea una base local aislada,
aplica allí las migraciones y el prerrequisito aditivo de roles ya entregado,
y elimina esa base al finalizar. No se aplica SQL a una base compartida.

CI compila antes de Jest. La regresión utiliza ese build ES2023; en ejecución
local compila mediante Nest CLI antes de cargar la app para evitar artefactos
anteriores. Esto cierra la diferencia entre el transform unitario y producción.

| Regresión HTTP | Archivos | Aprobadas | Fallidas | Omitidas |
| --- | --- | --- | --- | --- |
| Antes de corregir el DTO | 1 | 2 | 8 | 0 |
| Después, con base local aislada | 1 | 10 | 0 | 0 |

### Auditoría del front

Se inspeccionó, solo lectura, front main
`41e13ac5d39d5fdcfa9b5266424bfb2f26abd45b`. El tipo/payload de emisión y sus
constructores no incluyen saldoNotaCalculado ni m1NoteBalance. invoicesApi
transmite ese payload a /invoices/emitir sin agregar esos campos. El front no
requiere cambios: no se genera un ferry ni se ejecutan pruebas de front por
esta corrección exclusivamente del back.

### Verificación final del addendum

Suite completa del back: **474 archivos**, 464 aprobados y 10 omitidos;
**4576 pruebas**, 4513 aprobadas, 0 fallidas y 63 omitidas. Todas las omisiones
pertenecen a archivos preexistentes; la regresión HTTP nueva ejecutó sus
10 pruebas sin omisiones. Se usó PostgreSQL 17 local, con
TEST_DATABASE_URL y RUN_INTEGRATION_TESTS=required. Resultado completo:
notas-http-full.json del workspace de ejecución.

Build de producción aprobado (incluido el ejecutado por la regresión) y lint
sin errores; conserva tres advertencias en archivos ajenos a la corrección.
Para reproducir la regresión, usar una conexión local de pruebas con permiso
CREATEDB y ejecutar npm test -- --runInBand
 test/integration/invoices/notasSaldoHttp.integration.spec.ts con
TEST_DATABASE_URL y RUN_INTEGRATION_TESTS=required. El catálogo y los documentos
ficticios se crean exclusivamente en la base aislada, que se elimina al cerrar.
No hay cambios de esquema ni migraciones nuevas. No se crean PRs ni merges y
no se toca información de producción.

## Addendum PR #419 — Cobertura del código fuente

La corrida CI 43967003723 sí ejecutó notasSaldoHttp.integration.spec.ts:
474 archivos inventariados, 464 aprobados y 10 omitidos; 4513 pruebas aprobadas
y 63 omitidas. La regresión HTTP figura como PASS. TEST_DATABASE_URL estaba
configurada y el build se ejecutó antes de Jest; la integración no se omitió.

El problema era de atribución de cobertura: esa regresión carga dist/ para
reproducir la semántica ES2023. Jest recopila cobertura de src/**/*.ts y Sonar
consume ese LCOV; ejecutar el artefacto compilado no cubría en dicho informe
las líneas de src/main.ts. El informe de CI marcaba sin cubrir las líneas
16–29 de la fábrica de errores. Sonar rechazó únicamente la cobertura nueva
(30,8 %, mínimo 80 %).

Se agregan ocho pruebas unitarias sobre los módulos fuente existentes:
transformación válida, rechazo del saldo interno y campos arbitrarios,
formato de errores y respuesta segura para errores anidados sin constraints;
además, rechazo de campos indebidos antes de consultar datos y recorrido
NC/ND desde la entrada al saldo preparado y al payload, sin aceptar un saldo
falsificado dentro del JSON fiscal.

La corrida dirigida aprueba 99 pruebas de dos archivos. Sus informes cubren
todas las sentencias y ambas ramas de cada decisión nueva de
applyGlobalValidation. La regresión HTTP compilada permanece idéntica; no se
cambia código de producción, umbrales, exclusiones, instrumentación ni opciones
de validación. Ambas capas se comprueban en la corrida normal de CI: pruebas
unitarias para el LCOV de src/ y aplicación compilada para la regresión real.

Verificación completa con PostgreSQL local, CI=true y cobertura: 474 archivos
(464 aprobados, 10 omitidos), 4584 pruebas (4521 aprobadas, 63 omitidas),
12 snapshots aprobados y ningún fallo. Antes: 474 archivos, 4576 pruebas
(4513 aprobadas, 63 omitidas); después: ocho pruebas nuevas aprobadas, sin
nuevas omisiones. Las diez pruebas HTTP siguen aprobadas. Lint aprobado con
las tres advertencias preexistentes en archivos no modificados.

## Addendum — Preparación local de notas, investigación desde 991491c1

Rama `fix/m1-notas-validacion-local`, base exacta
`991491c1d93063db1b5c14f154e5b033acc8a4ad`. Investigación exclusivamente local:
no se consulta ni modifica la nota FD01-00000006, producción ni una base
compartida; no se efectúa transporte SUNAT.

La regresión HTTP anterior sustituía **todo InvoiceJobConsumer** por un objeto
con onModuleInit vacío. No sustituía directamente el validador: no llegaba a
él, porque terminaba en creación y encolado. Se cambia esa sustitución por una
intercepción exclusiva del registro automático de la cola, conservando la
instancia real del consumidor del build ES2023. Cuatro casos nuevos recorren
NC y ND por ambas entradas HTTP, emisión parcial de 10, generación UBL,
certificado autofirmado de pruebas, verificación de firma, ZIP, persistencia
del XML y compuerta XSD/XSL oficial mediante Python/lxml y los assets reales.
Se comprueba que no hubo bypass ni bloqueo, y que se conserva el saldo
calculado. Se invoca preparar, nunca procesar ni el transporte.

Si esa preparación falla, la prueba reproduce el validador en un subproceso
local sin el catch genérico del protocolo, recoge stderr y lo adjunta al
fallo de Jest. Solo opera sobre fixtures sintéticos locales; no cambia los
logs ni las respuestas de producción, ni registra XML o claves privadas.

**Resultado observado, no diagnóstico de producción:** los 14 casos HTTP
pasan sobre el build de esta base, incluidos los cuatro recorridos reales.
La ejecución directa sin catch también devuelve completado=true en NC/ND,
sin stderr. Se contrastaron motivos de ambos catálogos, moneda, emisor,
cliente, texto con caracteres especiales, unidad ZZ y referencias a boleta;
los casos válidos completan y los inválidos devuelven rechazo fiscal, sin
reproducir el fallo de infraestructura. El motor principal es Python 3.12,
lxml 6.1.1/libxslt 1.1.43; el contraste con lxml 4.9.4 tampoco reproduce ese
fallo. No se modifican reglas SUNAT, assets ni código de producción sin una
causa demostrada.

**Pendiente para corregir de raíz:** obtener el XML firmado que falló (o el
stderr real de ese caso y sus datos fiscales mínimos) para reproducir la
diferencia. M1_PREPARATION_INFRAESTRUCTURA/VALIDACION_LOCAL por sí solo no
identifica la excepción: también comprende errores posteriores del registro
de la decisión fiscal. No se atribuye una causa ni se declara corregido el
incidente de producción con estos resultados.

Verificación: build ES2023 y lint aprobados (las tres advertencias de lint
preexistentes, sin nuevas). Suite completa con PostgreSQL local:

| Conteo | Base | Después de ampliar la regresión |
| --- | ---: | ---: |
| Archivos totales | 474 | 474 |
| Suites aprobadas / omitidas | 464 / 10 | 464 / 10 |
| Pruebas totales | 4584 | 4588 |
| Pruebas aprobadas / omitidas | 4521 / 63 | 4525 / 63 |
| Fallos | 0 | 0 |
| Snapshots aprobados | 12 | 12 |

Este commit entrega cobertura de preparación y evidencia de investigación;
**no es todavía una corrección acreditada del incidente de producción**.
