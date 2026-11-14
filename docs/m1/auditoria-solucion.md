# Correcciones M1 — 8 de noviembre de 2026

Base: origin/main e097ecda10239e369b60c0db9eed906e50ce9f43.

## Verificación inicial

El proxy bloqueó frontend, Render y SUNAT BETA con CONNECT 403. El navegador compartido también falló. No se verificó autenticación SOL real, certificado del despliegue ni pantalla. Las 50 pruebas locales de certificado, firma y resolución del emisor pasaron usando exclusivamente fixtures. Ninguna emisión externa fue ejecutada.

## Parte 1: estados finales

Una reentrega de un comprobante ACEPTADO, OBSERVADO, RECHAZADO o ANULADO termina sin escribir ni despachar. La escritura de fallo de preparación exige que el estado siga siendo no final, protegiendo finalizaciones concurrentes.

## Parte 2: transacción e idempotencia HTTP

Ambas rutas de creación pasan por AtomicInvoiceCreationService. Se exige `Idempotency-Key`, con 16–128 caracteres de `[A-Za-z0-9_-]`. Cada nueva venta usa una clave distinta; todos sus reintentos conservan la misma. Reutilizar una clave con otro cuerpo devuelve 409. El tenant forma parte de la clave. La respuesta se conserva en base y no depende de memoria del proceso.

El bloqueo PostgreSQL es transaccional. La reserva de correlativo, cabecera, evento pg-boss, actualización de importes, líneas y respuesta HTTP se ejecutan con el mismo cliente transaccional. No se abre una transacción anidada en el repositorio. Un fallo posterior al encolado revierte todo antes de hacer visible el job.

Migración `20261108210000_m1_creation_requests` pendiente de aplicación MANUAL. No desplegar el código sin esa migración y sin adaptar los clientes para conservar la clave de solicitud. No se ha aplicado ninguna migración ni se ha desplegado esta rama.

Las pruebas automatizadas usan dobles transaccionales y servidores locales. La demostración de rollback y contención en PostgreSQL real queda pendiente porque no se autoriza aplicar migraciones a ninguna base durante este encargo.

## Dependencias fuera de M1

La atomicidad del movimiento a DLQ y el cambio del orquestador de reintentos requieren Resiliencia. La unicidad común de los dos escritores contables requiere Contabilidad. No modificar esos módulos en esta rama sin autorización adicional.

## Parte 3: guardas comunes y saldo

Las rutas HTTP convergen en la misma emisión de negocio, con liquidación del servidor. La integración fiscal exige cabecera/payload coherentes, líneas reales, moneda y forma de pago explícitas. El correlativo lo asigna el servidor y se propaga al payload. Se rechazan discrepancias de total. Se exige SKU tanto para mercadería como para servicios; los servicios registrados con `is_inventory=false` no requieren stock.

Se heredan unidad y afectación del maestro. La falta de afectación bloquea; no se presume Gravado. Crédito y descuentos exigen permiso booleano explícito. Las notas toman bloqueo FOR UPDATE del origen antes de consultar saldo y persisten en la misma transacción. No admiten otros tipos de origen, otro adquirente ni un céntimo de exceso. La retención se resuelve a la fecha de emisión.

Migración `20261108211000_m1_note_origin_integrity` NO aplicada. Añade FK por tenant y obligación de vínculo para notas nuevas. Los constraints NOT VALID requieren revisar históricos antes de validarlos: no hay backfill que invente referencias. La política existente solo admite ACEPTADO como origen; OBSERVADO permanece pendiente de definición explícita.

## Parte 4: RC/RA bloqueada por límite entre módulos

La API de Resiliencia `encolarResumen` no admite cliente transaccional ni registro durable de envío. La corrección integral requiere `encolarResumenInTx` y transporte por identificador durable en QueueService (Resiliencia), seguida de persistencia M1 de miembros, identificador, ticket y CDR. Se detiene esta parte sin duplicar una infraestructura de cola en M1. No se modificó Resiliencia.

## Parte 5: frontera segura de validación y firma

No se permite bypass ni resultado XSL no concluyente contra BETA/PRODUCCIÓN o un endpoint remoto. La excepción de pruebas exige contexto MOCK y host loopback explícito. Se bloquea XML sin certificado, firma inválida o copia firmada que no pudo persistirse. La verificación de firma usa ahora checkSignature real y rechaza alteraciones; el método anterior solo comprobaba nodos.

TA-70 añade validación estructural XSD 2.1 oficial y ejecución local del juego SFS completo, con pruebas positivas de Factura, Boleta, NC y ND (ver detalle al final). Los fallos del ejecutor siguen siendo no concluyentes y no permiten despachos externos. La compuerta de esta parte no se modifica ni se despliega.

## Parte 6: cotejo de CDR y consulta segura

Se verifica ReferenceID al recibir y recuperar CDR. Un CDR ajeno/ausente no acepta la factura: deja resultado incierto, auditado y no reintentable automáticamente. Las escrituras de persistencia del CDR también condicionan el estado para no degradar un final concurrente.

Nueva ruta autenticada `POST /api/v1/invoices/:id/consultar-sunat`: selecciona el documento por tenant, usa exclusivamente getStatusCdr y devuelve metadatos, sin cola ni emisión. La verificación SOL real de F001-00000060 queda pendiente de acceso al sistema desplegado; la ruta nueva no está desplegada.

La política de reenvío tras una consulta incierta y la transición atómica a DLQ siguen bloqueadas: requieren modificar InvoiceRetryService/InvoiceDlqService de Resiliencia. La unicidad común de efectos contables requiere Contabilidad. No se modificaron esos módulos.

## Parte 7: precisión, redondeo e ICBPER

Se centraliza HALF_UP decimal (Prisma.Decimal): dos decimales para importes, diez para bases unitarias. Se preserva el precio final ingresado y se desglosa por línea, evitando redondear primero la base unitaria. PriceAmount conserva precisión; los bloques TaxTotal de cabecera no duplican ICBPER.

`cantidadBolsas` permite declarar cantidades enteras: el servidor liquida S/ 0.50 por bolsa. El importe legado solo se acepta si coincide con cantidades enteras comprobables. No se infiere que un producto es bolsa; falta un indicador persistido en el maestro para imponer ese control desde producto, fuera de esta parte. SPOT se mantiene APARCADO: la base en operaciones mixtas queda pendiente de definición normativa de Jhordy, sin cambio de algoritmo ni de tasas.

## Parte 8: certificado, entorno y perfil

La inspección del certificado es distinta de la autorización para firmar: conserva sus fechas aun vencido, comprueba par de claves y RUC, y no devuelve material criptográfico a configuración. La proyección calcula días en cada consulta y distingue NO_CONFIGURADO, INVALIDO, AUN_NO_VIGENTE, VENCIDO, POR_VENCER y VIGENTE. El nombre de archivo histórico no está persistido: `archivo=null`, sin nombre sintético.

El entorno se normaliza en un solo lugar, incluidos PRODUCCION/PRODUCTION y mayúsculas. Si falta, se expone null, sin declarar MOCK ni dirigir implícitamente a BETA. Se comprueba que los hosts efectivos correspondan al entorno antes de transportar credenciales. MOCK solo admite loopback. La configuración pública elimina credenciales y parámetros de las URLs y no declara listo_para_emitir con validación oficial incompleta.

`tipo_comprobante_predeterminado` se calcula desde commercial_profile: MAYORISTA=01, MINORISTA=03, sin perfil=null. La preselección visual sigue dependiendo del repositorio de frontend. La disponibilidad efectiva de las operaciones SOAP de consulta BETA sigue sin verificarse en red.

## Parte 9: proyecciones y regeneración sin datos inventados

Las cuotas históricas incompletas conservan campos null; no se asigna Cuota001 ni se inventa fecha o monto. El origen no recuperado no hereda el cliente ni la moneda de la nota. Los textos desconocidos del CDR quedan null.

El generador requiere cabecera fiscal explícita, correlativo válido, forma de pago registrada para ventas, referencia y motivo de notas, y líneas reales. No rellena F001, 1, PEN, Contado, 10:00 ni Servicio prestado. La hora desconocida se omite. No se presume ubigeo 150101 ni local anexo 0000. Esta limpieza no convierte las comprobaciones internas en validación oficial: los datos obligatorios que falten deberán ser rechazados por esa frontera, que sigue cerrada a envíos externos.

Los datos de local anexo/ubicación que no consten requieren completar la configuración del emisor, nunca un backfill inventado. No se ha añadido una migración de datos ni se han modificado comprobantes históricos.

La representación PDF toma importes registrados del payload/fila y del detalle, sin recalcular IGV global a partir de valores unitarios. No infiere el tipo de documento del cliente por longitud; omite el QR cuando le faltan datos, y muestra ausencia de nombres/moneda sin inventarlos. Un comprobante final sin su XML original ya no se vuelve a firmar durante la descarga como si fuera el archivo enviado: se informa la pérdida del original sin mutarlo.

## Parte 10: monitor, logs y control de secretos

El monitor usa la inspección de metadatos y calcula su vigencia en vivo: VENCIDO y AUN_NO_VIGENTE son estados críticos evaluados, no ausencia de datos. Los logs de fallo del repositorio Outbox y de alertas no vuelcan objetos/mensajes de error potencialmente sensibles.

El control de secretos revisa contenido además de nombres: claves privadas, patrones de tokens y asignaciones literales de credenciales/certificado/clave de cifrado. Solo informa rutas y categorías, nunca el valor coincidente. Sus límites se explicitan: no certifica ausencia de otros secretos.

No se modifica el alta de empresas de Auth ni se recifran datos históricos: homogeneizar el contrato de credenciales con ese escritor requiere autorización sobre el otro módulo y revisión de los datos en integración. Tampoco se leen credenciales del despliegue.

## Parte 11: retirada del pipeline obsoleto

Se retira InvoiceWorkerService y su helper de auditoría. Solo lo registraba/exportaba InvoicesModule; no había consumidores en las rutas ni en otros módulos. Ese pipeline heredado declaraba PROCESADO/FALLIDO/FALLIDO_DLQ como si fueran estados persistibles, aceptaba un payload del job y ocultaba fallos de actualización. No implementaba un envío SOAP real ni una DLQ durable.

El consumidor activo permanece InvoiceJobConsumer: recarga el documento persistido, conserva estados finales y exige las compuertas de validación/firma. Se eliminan seis casos exclusivos del código retirado; las pruebas del consumidor activo y de ambas rutas de creación siguen ejecutándose. Ningún endpoint público se elimina.

## Pendientes de integración y decisiones

1. Emma: aplicar manualmente 20261108210000_m1_creation_requests y 20261108211000_m1_note_origin_integrity; revisar históricos y validar constraints sin inventar referencias. Luego probar contención/rollback con PostgreSQL real. Ninguna migración fue aplicada durante este trabajo.
2. Resiliencia: API transaccional y envío durable RC/RA con ticket/CDR, reintentos tras resultado incierto y movimiento atómico a DLQ. Contabilidad: unicidad entre escritores contables. No se modificaron estos módulos.
3. Validador oficial: obtener/integrar esquemas y dependencias completos; sin ello BETA/PRODUCCIÓN permanecen bloqueados. Catálogo 53/04 requiere el flujo de anticipos; no se habilita como descuento genérico.
4. Jhordy: definir normativamente la base SPOT de operaciones mixtas. Se conserva la selección de base existente, sin cambiar tasas; la política monetaria común usa redondeo decimal.
5. Completar datos reales de ubicación/local del emisor donde no consten; decidir expresamente el tratamiento de OBSERVADO como origen de notas si se cambia la política vigente. No se rellena ningún dato histórico con un valor típico.
6. Frontend (otro repo): conservar Idempotency-Key por solicitud y consumir campos nuevos/nullable, perfil comercial y estados estructurados. La visualización y la preselección no son auditables aquí.
7. Sistema desplegado: consulta SOL de un comprobante existente, certificado del despliegue y contraste pantalla/GET. Los sondeos HEAD de frontend, Render y WSDL BETA continuaron bloqueados por el proxy CONNECT 403. No se emitió ni se reenvió ningún comprobante.

## Parte 12: validación común de la estructura de entrada

Se aplica el mismo DTO anidado a ambas rutas dentro de la fachada, antes de leer maestros/reservar correlativos. Se rechazan objetos o arreglos mal formados de líneas, descuentos y cuotas con 400, sin persistencia ni eventos. Las cuotas UBL numeradas se traducen al contrato común sin perder monto/fecha, y se rechaza numeración contradictoria. El contrato admite las diez cifras de base unitaria que genera el backend.

Las pruebas nuevas fallaron antes del cambio (TypeError sin clasificación 400 o lectura de maestros antes de rechazar) y cubren ahora el rechazo temprano. No se añaden reglas tributarias ni decisiones SPOT.

También se elimina el respaldo Gravado del constructor de líneas XML, incluida la regeneración: una afectación ausente/inválida bloquea con error explícito. Un precio reconstruido desde una base registrada de operación exonerada, inafecta o exportada no recibe un IGV supuesto.

Se alinea el código 37 (retiro a trabajadores) con la gratuidad que declara el propio catálogo. Las listas de liquidación/representación/puente de M1 no lo cuentan como venta onerosa; se prueba total cero y PriceTypeCode 02. No se modifica la selección de base SPOT ni código de Inventario/Contabilidad.

## Validación de cierre

Suite completa: 231 suites aprobadas, 2030 pruebas aprobadas, 20 omitidas en suites optativas BETA/BD. Build Nest, lint de M1/SUNAT y escáner de secretos aprobados. Cobertura global: sentencias 93.39%, ramas 80.13%, funciones 89.36%, líneas 93.98%. Ningún servicio M1 modificado redujo cobertura en su parte; creationGuards queda en 100% de sentencias, funciones y ramas. La cobertura local no acredita conectividad ni autenticación SUNAT real.


## Integración TA-70: validador local concluyente con el SFS

Fase 0: rama feat/m1-ta70-sfs desde dev
`e14cc80d04d200ab119d62ab2523046ed1305618`. validate_utils.xsl tiene
54.304 bytes y SHA-256
`d3d4a1cac97a97101dba05bf7a88232894c776164ea6507238f1b171c71ce1d9`.
Se leyeron README y verificacion/probar.py; se reprodujo BTC→3088 y PEN→3030
(supera moneda, no acredita una factura válida). Python 3.12.14, lxml 6.1.1,
libxslt 1.1.43 disponibles. Línea base: 236 suites aprobadas, 2078 pruebas
aprobadas, 4 suites/20 pruebas omitidas; build y lint completos aprobados.
Fue necesario generar el cliente Prisma local; no se aplicaron migraciones.

El servicio usa scripts/m1/validate_sfs.py por stdin/stdout JSON, sin shell.
Requiere Python 3 con lxml (scripts/m1/requirements.txt); SUNAT_SFS_PYTHON
permite indicar el intérprete. Ejecutar desde la raíz que contiene scripts/ y
assets/, también con node dist/main.js. Estos directorios deben empaquetarse
junto a dist/; Nest no los copia. SUNAT_XSL_DIR explícito mantiene la ruta
heredada, que nunca acredita validación positiva sin evidencia.

Cada proceso valida primero con los XSD oficiales 2.1 vendorizados de Invoice,
CreditNote o DebitNote. Una infracción estructural devuelve código local XSD,
mensaje y nodo antes de ejecutar XSL; no se inventa un código SUNAT. Después
selecciona ValidaExprRegFactura/Boleta/NC/ND según 01/03/07/08 y prepara una
copia temporal con las tres adaptaciones documentadas (func, current-date(),
matches()) y el cuarto patrón autorizado de renombrado de variables duplicadas.
Resolver confinado a commons, sin recursos externos ni escrituras XSL; EXSLT
regexp y dyn:evaluate siguen la prueba de referencia. Se calcula
nombreArchivoEnviado desde emisor, tipo e ID, sin confundir IDs anidados ni
completar datos ausentes.

### Cuarta adaptación autorizada: instancias exactas

Las rutas de la tabla son relativas a
`assets/sunat-sfs/commons/xsl/validation/2.X/`; las líneas corresponden a los
originales vendorizados. Solo se modifica el atributo name y las referencias
locales indicadas. Cada fórmula, condición, código y mensaje conserva el texto
original. Las hojas vendorizadas permanecen byte a byte intactas.

| Archivo | Definiciones originales duplicadas | Renombrado temporal | Referencias modificadas |
| --- | --- | --- | --- |
| ValidaExprRegFactura-2.0.1.xsl | totalDescuentosGlobales: 4735 y 4771 | 4735 → totalDescuentosGlobalesInafectos | 4736, totalCalculado; intacta la fórmula IGV/IVAP de 4771–4774 |
| ValidaExprRegBoleta-2.0.1.xsl | totalDescuentosGlobales: 5304 y 5348 | 5304 → totalDescuentosGlobalesInafectos | 5305, totalCalculado; intacta la fórmula IGV/IVAP de 5348–5351 |
| ValidaExprRegNC-2.0.1.xsl | tipoComprobante: 71–72 y 81–93 | 81 → tipoComprobantePorSerie | Ninguna: no hay referencias ejecutables a esa variable |
| ValidaExprRegND-2.0.1.xsl | tipoComprobante: 29 y 34 | 34 → tipoComprobantePorSerie | Ninguna: no hay referencias ejecutables a esa variable |
| ValidaExprRegND-2.0.1.xsl | totalImpuestos: 1063 y 1073 | 1073 → totalImpuestosLocal | Ninguna: la referencia posterior solo aparece en comentarios |
| ValidaExprRegND-2.0.1.xsl | SumatoriaImpuestos: 1064 y 1074 | 1074 → SumatoriaImpuestosLocal | Ninguna: la referencia posterior solo aparece en comentarios |
| ValidaExprRegND-2.0.1.xsl | valorVentaLinea: 1917 y 1983 | 1983 → valorVentaLineaDuplicado | Ninguna: no hay referencias ejecutables a esa variable |

La adaptación verifica la presencia de las definiciones y referencias en las
líneas esperadas y falla de forma no concluyente si no coinciden. Una prueba
independiente exige que solo cambien esas nueve líneas y que al revertir los
identificadores se recupere exactamente el texto original; no se reescribe el
XML con un serializador ni se cambian fórmulas. La autorización del usuario
abarca exclusivamente este patrón de duplicación, no otras incompatibilidades.

Solo el rechazo fatal del SFS devuelve su primer código, mensaje original y
nodo; los avisos previos no se convierten en rechazos. Si falta Python/lxml,
assets, función o recurso, hay error de motor, protocolo inválido o timeout de
2000 ms, el resultado es bloqueado=true, valido=false, validadoDeVerdad=false.
El timeout termina el proceso con SIGKILL. No se cachean conclusiones de otras
invocaciones. validaDeVerdad() sin evidencia sigue false, incluido el diagnóstico
de configuración. La compuerta de la Parte 5 permanece intacta.

Pruebas reales de punta a punta: Factura, Boleta, Nota de Crédito y Nota de
Débito completas pasan XSD y XSL, devuelven errores=[] y el servicio acredita
valido=true/validadoDeVerdad=true. No se usan dobles para acreditar aprobación.
BTC devuelve 3088 con mensaje/nodo; sin local del emisor devuelve 3030;
NC con motivo 99 devuelve 2172; Factura con precio negativo devuelve 2369.
También se verifica rechazo XSD previo al catálogo, XML mal formado, selección
XSD por los cuatro tipos, ejecutor ausente y timeout real después de un éxito
previo. Los fixtures sin firma de TA-31/TA-62 con ExtensionContent vacío se
rechazan por XSD sin modificar el generador ni la compuerta.

La validación local no acredita aceptación, conectividad, credenciales ni
verificación de firma de SUNAT; las ramas DataPower de consulta/firma no se
suplantan. Sin emisiones, acceso a credenciales, migraciones aplicadas,
cambios de otros módulos, PR ni despliegue.

Cierre TA-70 con la cuarta adaptación autorizada: suite completa con 237 suites
y 2096 pruebas aprobadas; 4 suites/20 pruebas optativas omitidas. Las 18 pruebas
Jest específicas incluyen dos comprobaciones Python del alcance del renombrado.
Build Nest y lint completo aprobados. No se detectó otro bloqueo en los cuatro
fixtures positivos ni en los negativos verificados. La integración queda en
cuatro commits por partes; la autorización de la cuarta adaptación y sus
pruebas/documentación se incorporan al commit de cierre de la Parte 4.

## Segunda corrección

### Fase 0 y base autorizada

Emma autorizó sustituir la base 24fb5a2 por main
`af5a71fade3ca38125634a876a1c2bcbade8a572`, comprobado con ls-remote.
24fb5a2 es ancestro; el delta de base contiene únicamente .env.example,
prisma/seeds/auth.seed.ts y prismaAccountingRepository.ts. Rama de trabajo:
fix/m1-auditoria-2. Front clonado por URL desde
https://github.com/CarlosSoles/Fronted-sistema-mype-sunat.git, main
`c22b923272e0de9248a8bcc32f10237e636e7f6d`.

Línea base después de generar el cliente Prisma local (sin migraciones):
237 suites/2096 pruebas aprobadas; 4 suites/20 pruebas optativas omitidas.
Frontend: 96 archivos/747 pruebas aprobados. Python/lxml/assets operativos;
la invocación local de validate_sfs.py con moneda BTC devolvió 3088.
La auditoría adjunta se trató como evidencia, no como autorización adicional.

### Parte 1: datos fiscales, precio y diagnósticos

Se incorporan seis campos opcionales de Company: local_anexo,
domicilio_fiscal, ubigeo_fiscal, departamento_fiscal, provincia_fiscal y
distrito_fiscal. Configuración permite leerlos y guardarlos; omitir conserva
el valor y vaciar guarda null. No hay valores predeterminados ni backfill.
La migración 20261109040000_m1_issuer_fiscal_address fue GENERADA con
`prisma migrate diff --from-schema <copia anterior> --to-schema prisma/schema --script`.
No fue aplicada. Emma debe revisarla/aplicarla antes de usar el nuevo código.
El equipo debe registrar los datos reales de cada emisor.

Ambas rutas HTTP pasan por el mismo servicio, que carga esos campos de la
empresa y bloquea con ISSUER_FISCAL_DATA_REQUIRED antes de reservar número
si faltan datos o los códigos son inválidos. El adaptador transporta el anexo
hasta AddressTypeCode y el domicilio hasta RegistrationAddress. Las pruebas
usan datos ficticios explícitos exclusivamente en test/fixtures; no se copian
a configuración real. Se verifica en ambas rutas la persistencia del payload,
su XML generado, firma de prueba y ejecución SFS concluyente sin 3030 ni otros
errores. No se emiten comprobantes ni se llama a SUNAT.

Al seleccionar un producto el frontend conserva el valor sugerido por el
catálogo e inicializa precioUnitario final con IGV para gravadas; las otras
afectaciones conservan su precio. El payload siempre transporta precioUnitario,
incluso al restaurar líneas anteriores con valorUnitario. La guarda backend
permanece. Contrato cubierto: seleccionar, no editar, construir solicitud.
La fuente existente del catálogo sigue siendo la valorización real expuesta
por /invoices/products (averageUnitCost); esta parte no crea una política de
márgenes o un maestro separado de precios de venta.

La fila de validación usa un diagnóstico independiente: ejecutable Python,
importación de lxml, archivos principales SFS, compilación de los tres XSD
oficiales y prueba XSD mínima positiva y negativa. Retorna causas cerradas y
sanitizadas para Python/lxml/assets/XSD, timeout o protocolo inválido. Una
selección heredada por SUNAT_XSL_DIR se muestra como tal y no acredita SFS.
Se verificaron también lxml ausente (python -S) y assets ausentes en una copia
temporal del diagnóstico. No se modifica validaDeVerdad ni la compuerta por
documento. scripts/m1/diagnose_sfs.py debe distribuirse junto a los demás scripts
y assets; ejecutar desde la raíz sigue siendo requisito del empaquetado.

La inspección conserva causas clasificadas sin publicar errores de parser,
certificados, claves ni contraseñas. RUC_NO_COINCIDE muestra ambos RUC obtenidos
del contexto y del sujeto; se mantiene la comprobación estricta. Cuando la
inspección funciona, archivo contiene un identificador SHA256 del certificado.
Configuración publica origen efectivo, causa y explicación. El front distingue
INVALIDO y AUN_NO_VIGENTE y presenta origen y causa.

Evidencia de producción aportada por Emma (no se accedió a producción en este
trabajo): el certificado del XML histórico F001-00000060 corresponde al RUC
20601234567; la empresa demo es 20614142503. Es una discrepancia de credenciales,
no un defecto del chequeo de RUC. No se relaja el chequeo, no se modifica la
política de respaldo y no se registra un certificado ajeno para la demo.
Registrar un certificado propio es una decisión de datos del equipo.

### Excepciones autorizadas para Parte 2

La autorización de Emma/Jhordy se limita a retryDlq y la declaración de
INVOICE_QUEUE en queue.service.ts, más invoiceRetryService.ts exclusivamente
para 2.4. Su fundamento y alcance final constan en la sección de Parte 2.
Los demás archivos de Resiliencia y todos los archivos de Contabilidad se
conservan. El bloqueo de despacho RA/RC sigue intacto.

Validación de cierre Parte 1: backend 238 suites/2105 pruebas aprobadas;
4 suites/20 pruebas optativas omitidas. Frontend 96 archivos/753 pruebas
aprobados. Build de ambos repos, lint del backend y control de secretos aprobados.
Rectificación: el lint global del frontend NO pasó; tiene 63 errores y 25
advertencias heredados. Se informó inicialmente como aprobado por una lectura
incorrecta del resultado. El contraste con la base conserva los mismos
diagnósticos por archivo y regla, sin añadir errores nuevos.
Se descartaron ejecuciones solapadas con generación de Prisma/build y se
repitieron las suites completas en serie sobre el estado final. Frontend se
entrega mediante ferry/m1-auditoria-2-parte1, con rutas y procedimiento en FERRY.md.

Autorización posterior de Emma/Jhordy para Parte 2: la excepción a «otros
módulos intocados» se limita EXACTAMENTE a QueueService.retryDlq y a la
declaración de reintentos de INVOICE_QUEUE en
src/modules/resilience/infrastructure/queue/queue.service.ts. Ningún otro
cambio de Resiliencia queda autorizado. El bloqueo RA/RC permanece intacto.
Esta constancia debe comunicarse a Oliver, dueño del módulo, durante la
revisión del equipo; Codex no envió mensajes a terceros.

### Parte 2: recuperación e integridad del Outbox

Segunda excepción expresa de Emma/Jhordy: se autoriza modificar
src/modules/resilience/infrastructure/queue/invoiceRetryService.ts SOLO para
2.4, persistencia de incertidumbre y consulta antes de reenviar. Fundamento:
el docente permite reenviar cuando el comprobante no ingresó; una consulta
inconcluyente nunca demuestra esa ausencia. Esta autorización amplía la
excepción anterior, no habilita otros cambios de Resiliencia. Oliver debe
recibir ambas excepciones y este fundamento durante la revisión del equipo.
No se cambian las reglas del circuito ni el bloqueo de RA/RC.

retryDlq publica un trabajo mínimo en INVOICE_QUEUE con la misma empresa y
clave singleton del comprobante; solo después elimina el de DLQ. Si publicar
falla, conserva DLQ; si falla la limpieza, el reintento usa la misma clave.
Ya no se llama boss.retry sobre una cola sin consumidor. La política de la
cola principal se crea y actualiza con 3 reintentos, demora 60 s, backoff y
máximo 300 s, más su DLQ. Los intentos SOAP normales siguen perteneciendo a
InvoiceRetryService; los throws de preparación, infraestructura, circuito
abierto o contabilidad se recuperan por pg-boss. Los jobs ya creados pueden
conservar opciones anteriores de pg-boss; el reintento manual crea el job con
la política nueva.

Invoice.transport_uncertain se escribe ANTES de cada llamada física. Un
reinicio no borra la incertidumbre. El marcador es nullable: no se fabrica
certeza para registros antiguos; ENVIADO/ERROR_RED sin marcador exige consulta.
Solo el resultado del puerto que confirma NO_ENCONTRADO (null) autoriza
reenviar; un CDR recuperado termina el flujo sin envío; una consulta fallida o
sin CDR conserva el marcador y el trabajo recuperable. Se generó, sin aplicar,
20261109043000_m1_transport_uncertainty mediante prisma migrate diff.
Emma debe aplicar la migración antes de usar este código.

Los fallos de firma, estructura y disponibilidad se relanzan tras conservar
ERROR_RED, con causa en el registro existente; no se completa silenciosamente
el job. Un circuito abierto también se relanza para reprogramación. No se
modifica la clasificación de rechazos locales de negocio de la compuerta.

Puente y respaldo de M1 pasan m1:invoice:<UUID> como idempotencyKey a
GenerateAccountingEntryUseCase. Se usa la restricción ÚNICA ya existente de
Contabilidad (company_id, idempotency_key); no se modifican sus archivos ni se
crea una segunda política de unicidad. Se conservan consultas de referencias
históricas M1_INVOICES/número e INVOICES/UUID para no duplicarlas. El respaldo
vive en M1 y consume la interfaz existente de generación contable. Los errores
de Kardex no se ocultan por haber recuperado un asiento.

El mismo job durable conserva la tarea posterior a la aceptación: si falla la
contabilización no se completa, y la reentrega de ACEPTADO/OBSERVADO intenta
completar el puente/respaldo sin firmar ni reenviar. Tras agotar la política,
queda en DLQ y el reintento manual conserva ese mismo comportamiento. Los
casos que requieren revisión fiscal/contable tampoco se convierten en éxito
silencioso. No se cambia la política de OBSERVADO como origen de notas.

Pruebas: marcador confirmado antes de la red, recuperación tras reinicio sin
sendBill, consulta inconcluyente sin segundo envío, ausencia confirmada antes
del reenvío, misma clave para escritores, publicación fallida que conserva
DLQ y reentrega contable sin transporte. Los escenarios anteriores de backoff
usan ahora una respuesta explícita de ausencia confirmada en sus dobles.
PostgreSQL real y concurrencia de infraestructura continúan en las suites
optativas; ninguna migración o base de producción fue utilizada.

Cierre Parte 2: suite completa 239 suites/2113 pruebas aprobadas, 4 suites/20
pruebas optativas omitidas. Build Nest, lint y control de secretos aprobados.
El frontend no cambia en esta parte (última verificación: 96 archivos/753 pruebas).
Sin llamadas a SUNAT, migraciones aplicadas, cambios de Contabilidad, PR,
fusiones ni despliegues. El detalle de archivos y pruebas queda en el diff del
commit de Parte 2; las dos únicas fuentes modificadas de Resiliencia son las
expresamente autorizadas arriba.

### Parte 3 — alcance parcial: 3.1 y 3.2

El frontend exige has_credit === true y no infiere crédito de payment_terms.
El catálogo conserva el código de afectación real por separado de la categoría
visual: 12/16/21/31/37/40 y los demás códigos admitidos llegan sin compresión al
payload. No se sustituye una unidad desconocida por NIU; una unidad que la
grilla no soporta o una afectación ausente bloquea la selección con causa.
La página y el modal usan series activas de Configuración, sin respaldo a
F001/B001 cuando faltan; la página permite elegir entre las activas del tipo.
La lista pasa la configuración de la empresa autenticada al modal. Un entorno
ausente permanece null y el formulario lo presenta sin preseleccionar MOCK.
Las pruebas de formularios declaran ahora sus series ficticias explícitamente;
no se alteran reglas SPOT al actualizar esas preparaciones.

SummaryEnvioService responde «Despacho externo no habilitado para RA/RC»
fuera de MOCK, incluido entorno ausente, antes de firmar o encolar. La
resolución empresarial determina el entorno efectivo. Se mantiene el bloqueo
posterior de Resiliencia y no se habilita ningún despacho externo.

Quedan FUERA de este commit parcial: 3.3 (productos históricos inactivos y
semántica de motivos totales en el flujo común) y el tratamiento completo de
gratuitas y stock agregado de 3.4. No se cambió OBSERVADO como origen.
Diferencia de precisión aún vigente, documentada conforme a 3.4: payload/XML
permiten diez decimales unitarios; InvoiceItem.unit_price/unit_value persisten
cuatro decimales. Esta parte no aplica ni genera una migración de precisión;
la diferencia puede afectar proyecciones reconstruidas y queda pendiente de
unificación. Esta sección no declara cerrados los puntos pendientes.

Cierre del alcance PARCIAL de Parte 3: backend 239 suites/2116 pruebas
aprobadas, 4 suites/20 pruebas optativas omitidas; frontend 96 archivos/766
pruebas aprobados. Build de ambos y lint del backend aprobados. El lint global
del front conserva exactamente 63 errores y 25 advertencias de la base,
contrastados por archivo/regla (cero diagnósticos nuevos o retirados).
No se corrigieron módulos ajenos para limpiar esa deuda heredada.

Frontend entregado en ferry/m1-auditoria-2-parte3, commit
1ffdc790641e7bf3a93205140dfd8a144a80c5d3, 26 archivos, con FERRY.md y todas las
rutas exactas. Aplicar después de ferry/m1-auditoria-2-parte1 (15868aa).
Backend de esta parte: docs/m1/auditoria-solucion.md,
summaryEnvioService.ts y m1-envio-resumenes-bajas.spec.ts.
Las pruebas nuevas incluyen serie configurada F087 con F001 inactiva, los
códigos fiscales completos, entorno null, has_credit estricto y RA/RC bloqueado
antes de firma/cola. Sin emisiones, llamadas a SUNAT, migraciones aplicadas,
PR, fusiones ni despliegues. 3.3 y los puntos señalados de 3.4 siguen pendientes.

## Ciclo de verificación sobre dev — 9 noviembre 2026

### Fase 0

Backend dev: 42b66ae6c14dc6ad590f8b1fba598b79b7cbc672.
Frontend dev: a3f723e9a80325024efa40c0cfddefc9f47aa1a4.
Línea base completa: backend 243 suites/2127 tests aprobados, 3 suites/18
pruebas optativas omitidos; frontend 96 archivos/766 pruebas aprobados.
Se utilizó PostgreSQL 16 local nuevo y desechable, exclusivamente con las
migraciones existentes, conforme a la excepción autorizada por Emma. Sin
conexión a bases compartidas, emisiones ni llamadas reales a SUNAT.

### Corrección: líneas históricas de notas (3.3)

La guarda común de ambas rutas admitía solo productos activos y cotejaba
siempre su configuración actual. Ahora permite un producto inactivo únicamente
si consta en el origen de la misma empresa y conserva su unidad/afectación
históricas; rechaza alteraciones o productos inactivos ajenos. Las ventas
nuevas conservan el filtro activo. NC no exige stock para una salida nueva;
ND conserva comprobación de disponibilidad sin sustituir la fiscalidad histórica
por la actual. OBSERVADO sigue sin habilitar un origen.

El frontend conserva codigoAfectacion y precio_unitario del detalle de origen,
incluidos los códigos antes comprimidos/rechazados. Un precio desconocido
impide precargar; no se reconstruye desde una base redondeada. Pruebas nuevas:
cuatro guardas históricas y siete contratos detalle → nota → payload.

Cierre de este arreglo: backend 244 suites/2131 pruebas aprobadas, 3 suites/18
pruebas optativas omitidas; frontend 97 archivos/773 pruebas aprobados.
El primer pase simultáneo falló solo por el umbral temporal de TA-13 (4/10
menores de 500 ms); el pase completo exclusivo pasó sin cambiar el test.
Lint backend y typecheck front aprobados. Ferry frontend: rama
ferry/m1-verificacion-dev, commit 4293cc2, con FERRY.md y tres rutas exactas.

### Corrección: motivos totales en flujo común (3.3)

Se reutiliza CATALOGO_09_MOTIVOS de InvoiceNoteService: 01/02/06 exigen que
las líneas devuelvan el saldo disponible completo, después de notas anteriores
y bajo el bloqueo del origen. Un importe parcial se rechaza con causa clara;
no se inventan precios/cantidades para completar el saldo. Motivo 07 conserva
la devolución parcial. Cinco pruebas nuevas; suite completa backend:
244 suites/2136 pruebas aprobadas, 3 suites/18 pruebas optativas omitidas.
Frontend sin cambios: 97 archivos/773 pruebas aprobados.

### Corrección: stock agregado (3.4)

StockValidationService suma todas las cantidades por SKU normalizado antes de
comparar con la suma de almacenes de la empresa. Decimal evita falsos excesos
como 0.1 + 0.2 frente a 0.3. Se conserva el cotejo tributario de cada línea y
la exención de stock de servicios. Pruebas: exceso 6+6 frente a 10 (fallaba en
dev), límite decimal exacto, servicio repetido y afectación alterada en segunda
línea. Suite completa backend: 245 suites/2140 pruebas aprobadas; 3 suites/18
pruebas optativas omitidas. Frontend sin cambios: 97 archivos/773 pruebas.

### Corrección: gratuitas referenciales (3.4)

El XML anterior anulaba referencia, base e IGV, y utilizaba el tributo oneroso.
Ahora el flujo común conserva precio final y base referenciales, desglosa IGV
referencial para 11–16, declara tributo 9996 en línea/cabecera y precio tipo 02
sin IGV; cac:Price (precio de venta) sigue cero. LineExtensionAmount de la
línea informa referencia, excluida del total oneroso de cabecera. El IGV no
cobrado se declara en 9996 y no aumenta PayableAmount. No se modifica SPOT.
Una gratuita sin referencia positiva se bloquea; no se inventa el valor.

Seis pruebas nuevas fallaban antes: comunes 11/16/21/31/37 → XML → firma
ficticia → ejecutor SFS real local, con referencia positiva y payable cero;
referencia cero rechazada. Se corrige la expectativa antigua que confundía
precio de venta cero con referencia cero. Suite completa backend: 246 suites/
2146 pruebas aprobadas, 3 suites/18 pruebas optativas omitidas. Frontend sin
cambios: 97 archivos/773 pruebas aprobados.

### Corrección y límite del rescate (2.4)

Dev ya dispone de Invoice.transport_uncertain nullable: no hace falta una
migración nueva para registrar incertidumbre. InvoiceRetryService confirma
true antes de la red, consulta antes de reenviar true, interpreta null con
ENVIADO/ERROR_RED como desconocimiento y solo reenvía tras ausencia confirmada.
Las pruebas m1-auditoria2-outbox verifican reinicio, consulta inconcluyente,
marcador anterior a la red y no segundo envío.

El rescate manual de M1 (InvoiceQueryService.reintentarCdr) no escribía el
marcador para PENDIENTE/EN_COLA históricos con null. Ahora confirma true ANTES
de publicar el rescate, con filtro por empresa/estado/null; conserva true/false
existentes. Si falla esa escritura, no encola. Dos pruebas nuevas fallaban
antes y pasan después. Es una decisión conservadora: desconocimiento no se
convierte en certeza de que nunca se envió. La consulta de boletas puede quedar
sin conclusión; no se autoriza por eso un reenvío a ciegas.

**2.4 PARCIAL: resto automático fuera del alcance autorizado.**
InvoiceQueueReconciler.reconciliar (Resiliencia) selecciona EN_COLA sin job y
llama reenqueueInvoiceIfIdle, sin clasificar/persistir null como incertidumbre.
InvoiceRetryService interpreta null como incierto solo en ENVIADO/ERROR_RED.
Por tanto un EN_COLA histórico sin marcador y con intento previo desconocido
sigue sin prueba durable de ausencia antes del rescate automático. Ya existe
el campo seguro donde registrarlo, pero cerrar ese camino exige modificar
el reconciliador o la interpretación de null en Resiliencia, prohibido en este
ciclo. No se cambió ninguno de esos archivos ni se generó una migración.

Separadamente, publicación y auditoría del rescate no son una transacción
única: la API reenqueueInvoiceIfIdle no admite cliente transaccional. La
incertidumbre anterior a publicación queda durable aun si falla esa auditoría;
no se declara atomicidad que la interfaz existente no ofrece. La transición
explícita InvoiceDlqService (estado/historial y posterior publicación DLQ)
también conserva ese límite preexistente de Resiliencia.

### Veredictos de la revisión

- **1.1 Cumple en código y pruebas locales.** datosDelEmisor lee los seis
  campos persistidos y bloquea ISSUER_FISCAL_DATA_REQUIRED antes de numerar.
  AtomicInvoiceCreationService usa prepareCreation para las dos rutas;
  emitirComprobanteAdapter → UblGeneratorService → xmlPartiesHelper transporta
  AddressTypeCode y dirección reales. Evidencia: atomicInvoiceCreation.spec.ts
  y m1-auditoria2-sfs.spec.ts (XML común firmado con credencial ficticia y SFS,
  sin 3030). Con domicilio_fiscal NULL informado por Emma, la demo debe seguir
  bloqueada. No se completó ese dato ni se probó una emisión real.
- **1.2 Cumple.** selección de producto inicializa precio final, contrato de
  payload lo conserva y prepareCreation exige precioUnitario. Evidencia:
  pruebas del selector/payload frontend y creationGuards.spec.ts.
- **1.3 Cumple.** InvoiceConfigService usa diagnosticarSfs; el script prueba
  Python/lxml/assets/XSD y devuelve causas permitidas sanitizadas. La compuerta
  por documento sigue separada. Evidencia: m1-auditoria2-sfs y ta70-sfs.
- **1.4 Cumple.** inspectCertificate conserva comprobación de RUC;
  InvoiceConfigService expone causa, detalle, origen y huella identificadora
  cuando funciona. InvoiceIssuerConfigForm distingue INVALIDO/AUN_NO_VIGENTE
  y origen. Prueba de RUC discrepante conserva ambos RUC sin secretos.
  La credencial ajena de respaldo no se habilitó; su sustitución es del equipo.
- **2.1–2.3 Cumple en las rutas verificadas.** retryDlq publica INVOICE_QUEUE
  antes de borrar DLQ; cola crea/actualiza retryLimit=3, demora60/backoff/max300
  y deadLetter. InvoiceJobConsumer relanza preparación, infraestructura y
  circuito abierto. Evidencia: pruebas de QueueService, consumidor y
  m1-auditoria2-outbox.spec.ts. Resiliencia se leyó sin modificarla.
- **2.5 Cumple en las rutas verificadas.** puente y respaldo comparten
  m1:invoice:<UUID> por interfaz contable existente y su unicidad durable.
  Reentrega de aceptado/observado completa contabilidad sin nuevo transporte;
  fallo contable relanza el job. Evidencia: m1-auditoria2-outbox y pruebas del
  consumidor/puente. Contabilidad no se modificó.
- **3.1 Cumple.** has_credit estricto, códigos/unidades reales, series
  configuradas y entorno ausente null se conservan. La precarga histórica
  queda cubierta además por invoiceHistoricasContrato.test.ts.
- **3.2 Cumple como bloqueo.** SummaryEnvioService devuelve «Despacho externo
  no habilitado para RA/RC» antes de firmar/encolar fuera de MOCK. Evidencia:
  m1-envio-resumenes-bajas.spec.ts. El transporte externo de resúmenes continúa
  deshabilitado y no se modificó el bloqueo de Resiliencia.
- **3.3 Corregido.** líneas históricas y motivos totales según los arreglos
  anteriores; OBSERVADO como origen permanece rechazado.
- **3.4 Corregido en fiscalidad gratuita y stock agregado.** la precisión
  conserva la diferencia ya documentada: payload/XML diez decimales unitarios,
  InvoiceItem.unit_price/unit_value cuatro. No se unificó ni se propuso una
  migración nueva; reconstruir desde columnas puede perder esos decimales.
- **4 Cumple en las comprobaciones automatizadas.** idempotencia obligatoria,
  guardas de ambas rutas, compuerta, cotejo ReferenceID del CDR y consultar-sunat
  sin reenvío mantienen sus tests. TA-70 ejecuta XSD+SFS reales locales para
  01/03/07/08; BTC sigue rechazado con 3088 y anexo ausente con 3030.
  Evidencia: atomicInvoiceCreation, ta32-idempotencia-envio,
  m1-consulta-sunat-segura, pruebas de referencia CDR y ta70-sfs.

No se generaron ni aplicaron migraciones nuevas. No se cambió SPOT, Contabilidad,
Resiliencia ni módulos ajenos a M1. No se abrió PR, fusionó ni desplegó.

### Cierre del ciclo

Suite completa final backend, con cobertura y PostgreSQL 16 local real:
246 suites/2148 pruebas aprobadas, 3 suites/18 pruebas optativas omitidas
(249 suites/2166 pruebas totales). Frontend: 97 archivos/773 pruebas aprobados.
Build de ambos repos, lint backend y ESLint de los tres archivos frontend
modificados aprobados; typecheck frontend aprobado. Cada arreglo anterior tuvo
su propio pase completo verde antes del commit. El rescate añade dos pruebas.

Commits previos de este ciclo: 3f828c0 (históricos), 7fd0410 (motivos totales),
3681d82 (stock), 88bfc69 (gratuitas). Este último commit de rescate contiene
InvoiceQueryService, m1-rescate-manual.spec.ts y este informe. Frontend se
entrega exclusivamente por ferry/m1-verificacion-dev (4293cc2), tres archivos
más FERRY.md; el commit local frontend es 191fc8b y no se empujó a su repo.

Restos abiertos: rescate automático histórico null en Resiliencia y falta de
atomicidad de sus interfaces de publicación/historial descritos arriba;
precisión persistida cuatro frente a diez decimales unitarios documentada;
transporte externo RA/RC deshabilitado por diseño. Datos de demo pendientes
del equipo: domicilio fiscal real y certificado propio del RUC. Nada de esto
se disfraza de validación productiva ni se resuelve inventando datos.

## Ronda post-despliegue — timeout SFS y consulta en detalle (9 noviembre 2026)

Fase 0: backend dev fe16db2b2f037b2fd2fe580709014e88115d306e,
frontend dev 34480624cfabb30e6fb59f952679c9153103a53e.
Línea base backend: 245 suites/2148 pruebas aprobadas; 4 suites/20 pruebas
optativas omitidas (sin base PostgreSQL ni migraciones en esta ronda).
Frontend: 97 archivos/773 pruebas aprobados. Rama nueva fix/m1-sfs-timeout.

### Parte A — presupuesto compartido y diagnóstico cacheado

SUNAT_SFS_TIMEOUT_MS configura el presupuesto en milisegundos de ambos procesos
Python (diagnóstico y validación del documento). Por defecto 20000 ms para
arranque frío en servidor pequeño. Valores ausentes/no enteros/no positivos o
mayores al máximo de temporizador de Node usan ese valor seguro por defecto.
No se confunde disponibilidad con validez: timeout del documento sigue siendo
NO concluyente y bloquea el despacho; diagnóstico fallido sigue no disponible.

El diagnóstico conserva éxito o fallo durante 60000 ms por proceso desde su
finalización; las lecturas concurrentes comparten la ejecución. Cambio de
Python, motor heredado o presupuesto invalida la entrada. La validación de
cada documento no se cachea. La caché no habilita emisiones ni modifica la
compuerta. Se elimina la suposición de arranque de ~200 ms.

Pruebas: configuración válida/inválida, presupuesto efectivo en ambos caminos,
TTL de éxito y fallo, deduplicación concurrente e invalidación; TA-70 conserva
bloqueo real por timeout con presupuesto de prueba de 100 ms, SFS 01/03/07/08,
BTC 3088 y anexo ausente 3030. Suite completa Parte A: 246 suites/2161 pruebas
aprobadas; 4 suites/20 pruebas optativas omitidas. Sin llamadas reales a SUNAT.

### Parte B — consulta explícita dentro del detalle

InvoiceCdrModal incorpora InvoiceSunatConsulta, que solo llama mediante
invoicesApi a POST /invoices/:id/consultar-sunat tras pulsar «Consultar SUNAT».
Muestra estado, código y mensaje en la misma vista; conserva NO_ENCONTRADO e
INCIERTO como tales, sin inventar código ni aceptación. Deshabilita lecturas
simultáneas y muestra errores inline. No envía ni reencola comprobantes.

El endpoint M1 ya existente omitía description del CDR recuperado. Se añade
mensaje nullable desde ese CDR para presentarlo fielmente; no se modifica el
servicio de SUNAT ni su transporte. Prueba de contrato backend adicional.
Seis pruebas frontend nuevas cubren detalle real montado, clic explícito,
respuesta recuperada/no encontrada/incierta, espera y error/respuesta inválida,
con API simulada y un único POST a consultar-sunat.

Cierre: backend 246 suites/2162 pruebas aprobadas; 4 suites/20 pruebas optativas
omitidas (250 suites/2182 pruebas totales). Frontend 98 archivos/779 pruebas
aprobados. Builds de ambos, lint backend y ESLint de los cuatro archivos del
front aprobados. Una advertencia contable heredada no se modificó.

Frontend local: 737ce29; entrega exclusivamente por ferry/m1-sfs-timeout, con
FERRY.md y sus cuatro rutas exactas, sobre base frontend 34480624. Parte A
backend: 8271c36. Todo queda en fix/m1-sfs-timeout para revisión de Emma.
Sin migraciones, emisiones, llamadas reales a SUNAT, PR, fusiones ni despliegues.
No quedan pendientes funcionales dentro de esta ronda; los casos PostgreSQL
optativos no se ejecutaron, y el comportamiento en Render/SUNAT real no se
probó por las restricciones del encargo. Los restos de auditorías anteriores
no se modifican ni se declaran cerrados aquí.

## Ronda post-despliegue 2 — consulta con fallos de contexto (9 noviembre 2026)

Fase 0: dev e6fb72c3f09ec3f4d49e46a8144bb0490c1842f3; rama nueva
fix/m1-consulta-500. Base completa: 246 suites/2163 pruebas aprobadas;
4 suites/20 pruebas optativas omitidas, sin PostgreSQL ni migraciones.

### Evidencia y límite de la atribución del 500 productivo

La reproducción inicial con RUCs coincidentes usa resolver real, empresa
20614142503 no activada, sol_pass_encrypted legado plano ficticio y SOL/certificado
ficticios por entorno. Devuelve NO_ENCONTRADO con SOAP simulado; decrypt y
lectura de certificado de empresa tienen cero llamadas. El camino feliz
recupera y persiste un CDR aceptado con ese respaldo. El resolver retorna fallback
antes de descifrar grupos cuando issuer_config_activated_at es null. La consulta
no inspecciona X509: ni el legado ni el chequeo del certificado causan este 500.

Emma confirmó por lectura de Supabase a las 12:16 Lima del 9 noviembre:
F001-00000060 (398d74e5-12c6-4be4-b1d0-864672740295) tiene ruc_emisor
20601234567; su empresa (5eaccb4e-a6ec-4f23-9909-85fe7fc9e879) tiene RUC
20614142503. Con ESOS valores distintos, el test reproduce la causa exacta:
statusConsultaService.ts:150 de la base lanza Error('ISSUER_IDENTITY_MISMATCH')
ANTES del try. La traza llega al controlador sin captura y el filtro común lo
clasifica como 500 no controlado. No hay llamada SOAP ni descifrado antes del
fallo de identidad. Con los valores reales confirmados, esta reproducción sí
corresponde al escenario productivo; no se atribuye por proximidad de logs.

También se reproduce como riesgo una excepción de lectura del contexto fuera
del catch. Activar SOL con legado indescifrable provoca BadRequestException
('ISSUER_CONFIG_DECRYPTION_FAILED'); es un supuesto distinto del informado y
sería HTTP 400 con el filtro existente, no el 500 no controlado observado.
Antes del arreglo: test nuevo con tres fallos y dos aprobados.

### Corrección mínima en el flujo de consulta

Se extiende el try existente para incluir lectura del contexto, resolución,
cotejo de empresa/RUC y construcción del cliente. Las guardas permanecen y no
se consulta ante discrepancia; su fallo devuelve INCIERTO con motivo que explica ambos RUC y conserva el código de causa. El
controlador conserva 404/otros HTTP deliberados <500 y controla los demás
fallos de carga como INCIERTO útil. No se modifica HttpExceptionFilter.

El log de servicio identifica etapa (contexto/consulta), nombre y mensaje real
sanitizado de excepción. El controlador hace lo mismo si falla antes del
servicio. Se omiten secretos del entorno y del contexto, URLs, XML y valores
rotulados de credenciales; no se serializan error/stack/objetos SOL/certificado.
Los motivos devueltos por el servicio usan ese mismo mensaje sanitizado.

IssuerConfigResolver, cifrado, certificado y política de respaldo NO cambian.
Radio de impacto: consulta manual y consultarEstado, el adaptador existente de
conciliación; este último sigue rechazando INCIERTO y no autoriza reenvío. Se
ajusta su test de empresa ajena para esperar INCIERTO conservando cero SOAP.
No se modifica emisión, Resiliencia, Contabilidad ni ningún otro flujo.

Siete pruebas nuevas: fallback sin decrypt, discrepancia de identidad,
configuración activada indescifrable, fallo de carga del controlador, CDR
recuperado feliz, fallo de carga del contexto y secretos de empresa no presentes
en entorno. Cliente SOAP simulado; sin llamadas reales a SUNAT ni emisiones.

Cierre de la ronda: suite completa final 247 suites/2170 pruebas aprobadas;
4 suites/20 pruebas optativas omitidas (251 suites/2190 pruebas totales).
Build y lint backend aprobados, sin diagnósticos nuevos; se conserva una
advertencia contable heredada. El primer pase completo anterior también pasó;
el final añade al motivo los RUC confirmados por Emma y comprueba su presentación.

No se corrige ni reescribe ruc_emisor, companies.ruc ni ningún dato histórico.
F001-00000060 queda INCIERTO por ISSUER_IDENTITY_MISMATCH, con ambos RUC y
explicación, sin abrir SOAP. La decisión sobre esa discrepancia histórica queda
en manos del equipo. La corrección cierra el 500 no controlado; no relaja el
cotejo para conseguir un resultado SUNAT con otra identidad.
Sin migraciones, emisiones, consultas SUNAT reales, PR, fusiones ni despliegues.

## Parte 1 — boletas: FormaPago y error SFS 3128 (9 noviembre 2026)

### Fase 0

Clon backend actualizado; dev b2365bf1e45897d3f109fe5062976897136f09cc.
Rama nueva fix/m1-boleta-paymentterms. Antes de tocar código se reportó:
247 suites/2170 pruebas aprobadas; 4 suites/20 pruebas optativas omitidas
(sin base PostgreSQL ni migraciones en esta ronda).

### Corrección y evidencia

Verificada la regla activa 3128 en la hoja SFS de boleta, sobre la existencia
de cac:PaymentTerms/cbc:PaymentMeansID fuera de operaciones 1001–1004.
UblGeneratorService usaba raiz === 'Invoice', compartida por 01 y 03, para
insertar bloqueFormaPago. Ahora usa tipo === '01': solo factura declara la
cabecera Contado/Credito y sus cuotas. xmlNodesHelper y ublDocumentTemplate no
cambian. Las notas 07/08 ya omitían FormaPago y siguen igual; TA-70 de notas
permanece verde. No se cambia ningún otro criterio de generación o validación.

Prueba nueva con XML de boleta contado S/17.70 generado por traducirEmision →
UblGeneratorService, producto CEM-001 y firma de certificado ficticio:
antes del cambio el ejecutor SFS real devolvió exactamente 3128, nodo
cac:PaymentTerms/cbc:PaymentMeansID, valor Contado; después devuelve
{completado:true, errores:[]}. No se persigue la observación no bloqueante 4269
por el SKU. No se usaron datos/XML/certificados productivos ni llamadas SUNAT.

Se capturaron TRES snapshots antes de cambiar el generador y se verificaron
sin actualizarlos después: FormaPago de factura contado, cabecera/cuota de
factura crédito y bloques PaymentMeans/PaymentTerms de detracción. Estos
bloques permanecen byte a byte idénticos a la base. No se modifica SPOT ni su
política: la suite existente rechaza boletas con detracción (no hay fixture de
XML permitido de boleta SPOT); esa guarda sigue aprobada. Se protege el XML de
factura SPOT del caso ya existente, sin habilitar boletas ni reinterpretar normas.

Pruebas dirigidas: 4 suites/96 pruebas y 3 snapshots aprobados. Nueve pruebas
nuevas cubren factura contado/crédito, boleta contado/crédito sin FormaPago,
notas 07/08, SPOT intacto, boleta SPOT bloqueada y SFS de boleta generado.

### Ítem secundario pendiente: rechazo local presentado como SUNAT

Fuera de la zona de serialización FormaPago: invoiceSendGate.ts, decidirEnvio,
persiste estado RECHAZADO aun cuando el bloqueo fue local; sí registra el
mensaje «Bloqueado antes de enviar por la validación XSL», cdr:null y
reintentable:false. La presentación equipara RECHAZADO a «Rechazado por SUNAT».
Cerrar este defecto requiere distinguir el origen local en la proyección del
estado/contrato y su presentación, no eliminar un bloque XML. Se deja pendiente
según el límite de esta parte. No se sustituye por ERROR_RED ni se habilitan
reintentos, porque una validación local de negocio no es un fallo de red.
No se modifica compuerta, clasificación, front, Resiliencia ni Contabilidad.

Este arreglo cambia la generación de XML nuevos. No se reprocesó ni alteró
la boleta B001-00000005 existente, su estado ni su XML firmado persistido.

Cierre: suite completa 248 suites/2179 pruebas aprobadas y 3 snapshots intactos;
4 suites/20 pruebas optativas omitidas (252 suites/2199 pruebas totales).
Build y lint backend aprobados, sin diagnósticos nuevos (solo advertencia
contable heredada). Sin emisiones reales, llamadas SUNAT, migraciones, PR,
fusiones ni despliegues. La clasificación/presentación del rechazo local queda
como el único ítem secundario abierto de esta parte.

## Construcción autorizada de agregados — 2A RA y 2B RC

Emma confirmó el diseño y Jhordy autorizó UNA tabla aditiva M1. Base backend:
af5f4fb2b2440f91436a4a7657aae941bbdd1fca; frontend:
204d3da6e620f80d0533debc8b629e2bf3a3a574. Rama fix/m1-bajas-resumenes-envio.
Base completa: back 248 suites/2179 pruebas aprobadas, 4 suites/20 optativas
omitidas; front 98 archivos/779 pruebas aprobados. No se modifican Resiliencia,
Contabilidad ni los assets oficiales. SPOT permanece aparcado.

### 2A — comunicación de baja

Modelo InvoiceAggregate y migración 20261110000000_m1_invoice_aggregates,
GENERADA con prisma migrate diff desde el esquema anterior. El SQL crea SOLO
invoice_aggregates y sus índices. No añade columnas ni relaciones en otra tabla.
Contiene reserva e identificador único por empresa/tipo/identificador, huella de
solicitud, fecha, contexto, XML/hash/ZIP, miembros y motivos en JSON, ticket,
incertidumbre, estado, resultado y job. Emma aplica el SQL a mano antes de
integrar/desplegar. No se aplicó a una base compartida. Para verificar transacciones
se creó PostgreSQL 16 local nuevo y desechable, enlazado solo a 127.0.0.1:5436;
allí se aplicaron las migraciones existentes y esta migración de prueba.

RA exige selección explícita, sin ella responde 400 antes de reservar/firmar.
El servidor vuelve a seleccionar dentro de una transacción, bloquea los miembros
y reserva correlativo bajo advisory lock de empresa; no acepta empresa por body.
Excluye ANULADO, RUC histórico ajeno, plazo inválido, reserva previa y la factura
neutralizada por NC aceptadas/observadas de saldo completo. Las NC pendientes
bloquean la baja mientras se resuelven. La trampa F001-61/FC01-13 está reproducida
en PostgreSQL local. Una nota nueva tampoco puede crearse mientras su origen
está reservado en RA; el bloqueo se comprueba en la guarda común bajo el mismo
bloqueo del origen. No cambia OBSERVADO como origen de notas.

El usuario captura un motivo por documento (inicial «Anulación de la operación»).
Se transporta, escapa y valida (1–100 caracteres); no se acepta vacío. El front
previsualiza exclusivamente la selección, invalida esa vista al editarla y exige
confirmación antes de publicar. La vista de candidatos/exclusiones se conserva.

RA genera LineID ordinal y cabecera UBL 2.0 con CustomerAssignedAccountID,
AdditionalAccountID=6 y RegistrationName. Extensión del ejecutor local para
RA/RC: XSD 2.0 seguido de las hojas 1.X correspondientes, mismas adaptaciones de
motor que TA-70, sin editar ni omitir reglas oficiales. HOJAS y adaptaciones de
los cuatro tipos individuales permanecen separadas para proteger sus tests.
El RA generado y firmado con certificado ficticio pasa XSD Y XSL oficiales.

SummaryGate se ejecuta en preparación y despacho. Comprueba destino/entorno,
RUC, identificador, firma presente y SFS; no usa bypass de demostración.
MOCK solo puede ir a localhost; BETA debe ir al endpoint BETA coherente. El ZIP
se conserva en la tabla y el worker coteja nombre, hash y XML contra ese artefacto,
no confía en un ZIP inyectado por el job. Ninguna credencial se guarda en el job.

La reserva se conserva antes de publicar; un PREPARED sin publicación se recupera
por un barrido M1 de 60 s usando la interfaz existente de cola. Publicaciones
repetidas no duplican sendSummary: update condicional reclama el agregado y
confirma incertidumbre ANTES de abrir red. El ticket se persiste inmediatamente;
la reentrega retoma getStatus. Si se pierde la respuesta sin ticket, permanece
UNCERTAIN y no se reenvía a ciegas, aunque la cola reentregue el job. El Monitor
lo presenta para revisión; no se inventa un ticket. Con ticket, ofrece consulta
explícita sin reenvío. Cola y consumidor de Resiliencia permanecen intactos.

Un CDR debe corresponder al RUC/nombre de archivo y al identificador reservado.
La lista del XML firmado/hash debe coincidir con los miembros reservados, tipos
y ordinales; si el CDR enumera documentos, la lista también debe corresponder
exactamente. Un CDR global acredita el agregado único y su XML inmutable.
Solo código 0 permite actualizar a ANULADO. El resultado del agregado y TODAS
las anulaciones se guardan en la misma transacción; si cambia un miembro,
rollback completo. CDR ajeno no anula y deja revisión visible.

GET /invoices/resumenes/envios añade el listado M1 al Monitor con ticket,
estado, código y motivo; no expone XML/ZIP/CDR completos en el listado ni datos
de otra empresa. POST /invoices/resumenes/envios/:identificador/consultar solo
opera si ya existe ticket. La respuesta de envío sigue significando ENCOLADO,
no aceptación. Durante 2A RC continúa cerrado hasta terminar 2B.

Pruebas de aceptación 2A: RA firmado contra XSD+XSL, snapshot del orden/motivos,
destinos incoherentes bloqueados, selección/motivos, XML anterior a publicación,
cola caída, idempotencia y reserva incierta. En PostgreSQL real se comprueban
NC completa, aislamiento, doble clic concurrente, reclamación única del envío,
ticket durable, marca antes de red, CDR válido/ajeno, rollback de anulación y
recuperación PREPARED. Front: selección/confirmación, motivo, preview invalidado,
resultado visible y Monitor con consulta por ticket, siempre con API simulada.

El primer pase completo descubrió una flaqueza heredada de TA-30: comparaba dos
ZIP generados en instantes distintos y sus timestamps podían variar. Se conserva
una sola entrada ZIP para afirmar el contrato del parser, sin cambiar su lógica.
Los dobles de las pruebas antiguas se actualizaron al repositorio/compuerta nuevos;
no hay una ruta de compatibilidad productiva que omita persistencia o validación.

Cierre 2A: back 251 suites / 2201 pruebas aprobadas (3 suites / 18 pruebas
omitidas por sus condiciones existentes), con PostgreSQL 16 local desechable y
la integración real de agregados habilitada. Front 99 archivos / 784 pruebas
aprobadas. Build de ambos repos y lint de los archivos modificados aprobados
(solo avisos heredados). La recuperación también cubre reservas sin artefacto
tras reinicio, conservando identificador y miembros. Los fallos previsibles de
contexto se registran sanitizados y quedan visibles como bloqueo/revisión.
La migración no se aplicó a bases compartidas. Sin llamadas reales a SUNAT.

### 2B — RC sin competir con despacho individual

Se abre RC con la misma reserva, artefacto firmado, compuerta XSD+XSL, cola,
ticket y finalización durable de 2A. Solo entra PENDIENTE con incertidumbre
explícitamente falsa, RUC coherente, plazo válido y detalle fiscal verificable.
EN_COLA, PROCESANDO, ENVIADO, ERROR_RED, incertidumbre true/null, informados y
miembros de agregados activos quedan visibles como excluidos. Por tanto las
boletas que hoy se emiten por el canal individual NO se vuelven a informar por
RC. No se añade un canal nuevo de creación de boletas.

El consumidor individual M1 y la reserva RC toman el mismo bloqueo transaccional
por empresa: si gana RC el job individual no despacha; si gana el individual,
PENDIENTE pasa a PROCESANDO y RC lo excluye. Se conservan ERROR_RED/ENVIADO y la
marca null histórica para que la conciliación individual existente siga
reconociendo incertidumbre. Resiliencia solo se usa por sus interfaces, sin
modificar sus archivos. La recuperación de RESERVED también reconstruye RC
con los mismos miembros e identificador, no una selección nueva del día.

XML RC: ordinales, emisor UBL 2.0 completo, PaidAmount antes de InstructionID,
Catálogo 11 (01/02/03/04/05) desde afectaciones persistidas, tributos separados,
referencia de notas a boletas y descuentos fiscales 02. Sin detalle/referencia
real o si el total no concuerda, se excluye y se explica; no se inventa GRAVADA.
La hoja oficial exige TaxTotal IGV aun en gratuitas/exoneradas: se declara IGV
cero junto al tributo real. La hoja solo admite AllowanceCharge con indicador
true (cargo); por eso los descuentos no afectos 03/01 no se disfrazan de cargos:
se mantienen bases fiscales y total cobrado reales, sin AllowanceCharge falso.
La discrepancia de su fórmula antigua 4027 es observación no bloqueante cuando
corresponde; no se modifica ni se debilita la hoja oficial.

Un CDR aceptado y cotejado de RC actualiza los miembros a ACEPTADO y publica el
trabajo contable por enqueueInvoiceInTx en la MISMA transacción que el resultado
del agregado. La reentrega individual final completa el puente existente sin
sendBill. Si falla esa publicación, rollback; el reintento retoma getStatus con
el ticket persistido. Sin cambios de Contabilidad ni tablas adicionales.

Front: RC conserva confirmación, motivo literal y resultado en cola; Monitor
muestra ambos tipos y permite consultar solo tickets existentes. Un false
explícito de reenviable se respeta; la vista no ofrece reenvío individual de
miembros reservados/inciertos. Error de transporte no afirma que SUNAT no lo vio.
La explicación de RC vacío incluye exclusiones reales, no atribuye CDR a todos.

Pruebas: XML firmado con certificado ficticio y SFS real para gravado, mixto,
exonerado, inafecto, exportación, gratuito, ICBPER, NC/ND con referencia y
descuentos; snapshots de orden y contenido. PostgreSQL local: carrera de ambos
canales, estados excluidos, recuperación de reserva, incertidumbre sin reenvío,
aislamiento y rollback contable seguido de consulta de ticket sin segundo envío.

Resto operativo deliberado: un sendSummary incierto SIN ticket queda UNCERTAIN
visible y requiere conciliación externa por el equipo; getStatus necesita un
ticket y el protocolo no ofrece aquí una consulta segura por identificador.
Nunca se libera automáticamente esa reserva ni se vuelve a enviar a ciegas.
Los documentos con RUC histórico/credenciales ajenas continúan bloqueados.
La migración aditiva sigue pendiente de aplicación compartida por Emma; durante
esta construcción solo se aplicó al PostgreSQL local nuevo y desechable.

Checksum SHA-256 de la única migración generada
`20261110000000_m1_invoice_aggregates/migration.sql`:
`28a4df36738f93b6cdcd91b0230414603dba63754ec84c04565e92aede723b67`.
La recuperación se aísla por registro: una empresa con contexto bloqueado no
impide recuperar las siguientes. En una carrera perdida de RC la relectura
puede devolver HTTP 400 «Los miembros reservados ya no son elegibles para RC»;
no hay publicación ni reserva residual en ese caso.

Cierre de verificación back 2B: 252 suites / 2222 pruebas aprobadas, 6 snapshots;
3 suites / 18 pruebas omitidas por sus condiciones existentes. Build y lint
aprobados (único aviso heredado en prueba de Contabilidad, archivo sin cambios).
El contenedor PostgreSQL 16 y su volumen desechable fueron eliminados al acabar.
Ninguna prueba de esta entrega llama realmente a SUNAT; SOAP y cola se simulan,
con persistencia transaccional real local en la integración de agregados.
Front 2B: 99 archivos / 785 pruebas aprobadas; build y lint de archivos modificados
aprobados. Entrega front por la rama `ferry/m1-bajas-resumenes-envio` del back,
con FERRY.md y rutas exactas; no se empuja al repositorio front. Bases verificadas:
back af5f4fb2, front 204d3da6. Entrega back `fix/m1-bajas-resumenes-envio`.
Un commit de construcción por parte (2A y 2B); sin PR, fusiones ni despliegue.


### Corrección CI del PR #224 — Reliability y cobertura de agregados

Misma rama `fix/m1-bajas-resumenes-envio`, base de comparación
`af5f4fb2b2440f91436a4a7657aae941bbdd1fca` (dev). Sin sincronizar mediante
fusiones ni modificar la configuración de Sonar/CI o sus umbrales.

Cambios productivos mínimos: los dos map del constructor XML llaman funciones
flecha con `(linea, index)` explícitos; ambas funciones utilizan ese índice para
LineID, de modo que los ordinales y snapshots se conservan. El normalizador del
almacén toma el último guion y valida el sufijo con `^\d+$`, evitando la
ambigüedad entre ceros y dígitos de la regex anterior. Comparación diferencial
local: 335929 cadenas con resultados idénticos, incluidos ceros, múltiples
guiones, sufijos inválidos y saltos de línea. Un sufijo inválido de 100001
caracteres se procesó en 0,40 ms, sin ejecutar la regex antigua sobre ese caso.

Se agregan unitarias sobre reserva/idempotencia/aislamiento, transiciones
condicionales, hashes, cotejo de CDR y miembros, rechazo por línea, efectos
transaccionales RA/RC y publicación contable fallida; también compuerta SFS,
selección/vista previa, coordinación individual/RC, incertidumbre, reanudación
por ticket y recuperación de preparación. Los harness sustituyen únicamente
DB/cola/SOAP, manteniendo la lógica real de los servicios. Se conservan las
pruebas existentes de XML firmado contra XSD/XSL reales y la integración de
agregados con PostgreSQL, sin hacer que la cobertura dependa de habilitar esta
última en CI.

Verificación completa con cobertura y PostgreSQL 16 local nuevo/desechable,
TEST_DATABASE_URL local, sin M1_AGGREGATE_TEST_DATABASE_URL (como la CI):
**256 suites / 2326 pruebas aprobadas**, 6 snapshots sin cambios; 4 suites / 38
pruebas omitidas por sus condiciones existentes (incluye 20 pruebas opcionales
de integración de agregados). Son 5 suites y 124 pruebas aprobadas adicionales
respecto del registro CI de Emma (251 / 2202). Build y lint aprobados; el único
aviso de lint es heredado de una prueba de Contabilidad sin cambios.
Las migraciones existentes solo se aplicaron a esa base local autorizada;
ninguna migración nueva ni operación sobre bases compartidas.

Medición de código nuevo, no del promedio global del repositorio: intersección
de las líneas añadidas por `git diff --unified=0 <base> -- src` con DA/BRDA del
LCOV completo, respetando la exclusión de código generado de Sonar. Resultado:

- Líneas nuevas ejecutables: 354 / 359 cubiertas = **98,61%**.
- Resultados de condiciones nuevos: 474 / 516 cubiertos = **91,86%**.
- Cobertura combinada local: (354 + 474) / (359 + 516) = **94,63%**.
- Almacén, despacho, preparación, compuerta y coordinación individual: 100%
  de líneas de cada archivo en la suite completa (no solo líneas nuevas).

Reproducción, tras ejecutar la suite completa con `--coverage`:
`python3 scripts/m1/coverage_new_code.py af5f4fb2b2440f91436a4a7657aae941bbdd1fca`.
Detalle por archivo en `docs/m1/auditoria-ci-cobertura.json`. Es una medición
local desde LCOV y el diff, no una afirmación de que el Quality Gate remoto ya
pasó: la API de SonarCloud devolvió 403 desde el entorno y el análisis remoto
corresponde al siguiente push del PR #224. No se rebajó ninguna exigencia.
Sin cambios front/ferry, Resiliencia, Contabilidad, envíos reales, PR nuevo,
fusiones ni despliegues.

### Parte 3b — UBL de Nota de Débito (08)

Rama `fix/m1-nota-debito-ubl` creada desde el dev remoto
`306dc43af4394c1e24332348e54041958048a2fc` (incluye las entregas anteriores).
Línea base completa antes de cambiar el generador: **256 suites / 2327 pruebas
aprobadas**, 4 suites / 38 pruebas omitidas por sus condiciones existentes.
PostgreSQL 16 nuevo local y desechable para la integración de la suite; solo
migraciones existentes en esa base local, sin conexión a bases compartidas.

Reproducción previa con payload del adaptador común → UblGeneratorService →
firma con certificado ficticio → ejecutarSfs/validate_sfs.py (sin XML escrito
a mano): XSD oficial 2.1 devuelve `DebitNoteTypeCode: This element is not
expected`, nodo `/*/cbc:DebitNoteTypeCode`. Al retirar solo ese elemento, la
misma generación devuelve `LegalMonetaryTotal: This element is not expected`,
nodo `/*/cac:LegalMonetaryTotal`, esperando TaxTotal o RequestedMonetaryTotal.
Ambos defectos se confirmaron antes de modificar código productivo.

Corrección exclusiva de DebitNote: la plantilla no emite DebitNoteTypeCode;
el generador pide al bloque monetario RequestedMonetaryTotal, manteniendo su
contenido interno idéntico. El valor predeterminado del bloque sigue siendo
LegalMonetaryTotal. No se cambian cálculos, precios, referencias, líneas, SPOT,
políticas de emisión ni otros tipos de documento.

Se capturaron ANTES del cambio seis snapshots completos desde la base anterior:
Factura contado/crédito, Boleta contado/crédito, NC y Factura con SPOT. Después
pasan sin `-u` ni modificación, preservando bytes de 01/03/07 y todo el bloque
SPOT/detracción. SHA-256 del archivo de snapshots antes/después:
`2b8d7859e44078ac403df8535ca26cc013876e1d449ecce70623a6bb94934395`.

La prueba nueva genera ND (no consume el fixture XML de TA-70), comprueba orden
TaxTotal → RequestedMonetaryTotal → DebitNoteLine y contenido monetario igual
al de la factura equivalente. Firmada ficticiamente, completa XSD oficial 2.1
más ValidaExprRegND-2.0.1.xsl con `{completado:true,errores:[]}`. La inspección
local del error_log de esa transformación, usando exactamente el XML generado
del caso TEST001, no devuelve mensajes/observaciones (`[]`). No se alteran el
ejecutor ni los assets oficiales. Dos casos negativos reintroducen por separado
los nodos antiguos sobre XML generado y conservan ambos rechazos XSD. También
se actualiza la expectativa heredada de ublAndCdrRules que exigía el nodo inválido.

FD01-00000001 permanece como exhibit histórico bloqueado: no se reescribe,
reemite ni reenvía y no se toca ningún dato productivo. La etiqueta visible
«Rechazado por SUNAT» para bloqueos locales ANTES del envío sigue pendiente,
como en la Parte 1; esta entrega no cambia esa clasificación.

Cierre: suite completa **257 suites / 2336 pruebas aprobadas**, 12 snapshots;
4 suites / 38 pruebas omitidas por las mismas condiciones de la base. Build
y lint aprobados (solo aviso heredado en prueba de Contabilidad sin cambios).
Sin migraciones nuevas, llamadas reales a SUNAT, emisiones, PR, fusiones ni
despliegues. Base y suite final usaron PostgreSQL local aislado; su contenedor y
volumen desechable se eliminaron al terminar las comprobaciones.

### Parte 3c — Alinear el validador interno de preparación para ND

Rama `fix/m1-nota-debito-validador` desde dev
`8111cb71d787a50ffacc30a80d0a408c9073d832`. Fase 0: suite completa
**257 suites / 2343 pruebas aprobadas**, 12 snapshots; 4 suites / 38 pruebas
omitidas por las condiciones existentes. Base local PostgreSQL 16 nueva y
exclusivamente desechable; sin acceso a base compartida o producción.

La 3b corrigió el XML del generador, pero quedaron dos capas contradictorias:
SFS oficial acepta DebitNote sin DebitNoteTypeCode y con RequestedMonetaryTotal;
la tabla usada en preparación por XsdValidatorService todavía exigía
DebitNoteTypeCode y LegalMonetaryTotal. Por eso el tipo 08 no podía completar el
flujo: el generador antiguo fallaba en la compuerta y el corregido, en la
preparación del Outbox. Se reprodujo localmente con el mismo payload/generador
de la prueba 3b y certificado ficticio: SFS `{completado:true,errores:[]}` frente
a los dos errores internos de nodos ausentes. Los tipos 01, 03 y 07 ya validaban
sin errores, sin encontrar otro conflicto que ampliara el alcance.

Cambio productivo limitado a tres entradas de xsdRules.ts: se elimina la regla
DebitNoteTypeCode, LegalMonetaryTotal queda solo para 01/03/07 y se exige
RequestedMonetaryTotal solo para 08, por presencia igual que la regla monetaria
existente. No se modifica el servicio validador ni ninguna otra regla.

Se extiende la spec de 3b, reutilizando su payload, generador y firma ficticia:
ND sin firmar y firmada pasan la capa interna; el MISMO XML firmado pasa también
el ejecutor SFS real. Regresión de 01/03/07: validan como antes y siguen fallando
si se sustituye LegalMonetaryTotal. La ND sin RequestedMonetaryTotal falla; aun
con LegalMonetaryTotal y PayableAmount presentes falla específicamente por la
nueva regla. Antes del arreglo los tres casos ND fallaban y los otros pasaban;
tras el arreglo la ejecución focalizada pasó 45 pruebas en 2 suites.
Se conserva la advertencia interna existente (no error):
«El comprobante declara IGV: verifique que el régimen del emisor lo permita».
El generador y los snapshots XML de la 3b permanecen intactos.

Exhibits históricos aportados por Emma, sin alteración, reemisión o reenvío:

- FD01-00000001: bloqueo de la compuerta oficial por el generador anterior.
- FD01-00000002: superó la compuerta, falló preparación interna y luego quedó
  en DLQ por ISSUER_STATUS_UNCERTAIN al consultar ante una respuesta inconclusa
  de BETA. Ese comportamiento conservador de statusConsultaService (ronda 2.4)
  queda expresamente fuera de alcance y no se modifica.

Sin cambios en Resiliencia, Contabilidad, migraciones, políticas de consulta o
transporte; sin llamadas reales a SUNAT, PR, fusiones ni despliegues.

Cierre 3c: suite completa con cobertura **257 suites / 2349 pruebas aprobadas**
(+6 pruebas), 12 snapshots intactos; 4 suites / 38 pruebas omitidas por las mismas
condiciones de la base. xsdRules.ts: 100% de cobertura de líneas y ramas. Build
y lint aprobados (solo aviso heredado de Contabilidad, archivo sin cambios).
No se generan migraciones: el juego existente se aplicó únicamente a la base
local desechable autorizada. Su contenedor y volumen se eliminaron al terminar.
La entrega solo cambia xsdRules.ts, la spec de 3b y este documento.

### Parte 2b — Presupuesto y sondeo espaciado de agregados RA/RC

Bases verificadas: back `cb878d9fddf1be994f51d617a261a5b81eb21b8b`, front
`87a980d771d4a31c66d4b44a006c6871cd7f6d1c`; rama `fix/m1-resumenes-timeout`.
Líneas base completas: back **257 suites / 2349 pruebas aprobadas**, 12
snapshots (4 suites / 38 pruebas omitidas); front **99 archivos / 785 pruebas**.

Fase 0: Axios global imponía 15000 ms sin override de consultarAgregado.
El endpoint de ticket valida empresa/ticket y llama al despacho con una sola
consulta. El transporte sendSummary/getStatus tomaba context.timeoutMs antes
que el constructor, ambos provenientes del timeout general (30000 por defecto,
SUNAT_TIMEOUT_MS); además su error mostraba el constructor aunque no fuera el
valor efectivo. El consumidor relanzaba y la cola aplicaba tres reintentos sin
retraso configurado (cuatro ejecuciones totales), acabando en DLQ. Con 98/99 el
despacho podía hacer 31 consultas por corrida separadas por un segundo; ante
timeout cortaba tras la primera. El ticket sí era durable y evitaba reenviar,
pero la recuperación de preparación no retomaba POLLING. QueueService no
exponía startAfter a pesar de que pg-boss lo soporta.

**Excepción quirúrgica autorizada por Jhordy el 9 de noviembre de 2026**, según
confirmación de Emma en este hilo, para aviso a **Oliver, dueño de Resiliencia**:
únicamente encolarResumen en queue.service.ts acepta startAfter opcional y lo
pasa como opción a boss.send. Sin ese argumento conserva exactamente la llamada
anterior de dos argumentos. No se toca ninguna otra función, política de cola,
archivo ni comportamiento de Resiliencia. Las pruebas cubren ambas firmas y el
retorno null ante fallo de publicación.

Transporte exclusivo de agregados: SUNAT_SUMMARY_TIMEOUT_MS, defecto 90000 ms;
valores ausentes/inválidos/no enteros/no positivos o fuera del rango de timer
vuelven al defecto. El proveedor de SunatSummaryClient y el snapshot de contexto
M1 de resúmenes usan el mismo resolver; el contexto fiscal original no se muta.
El timeout y el mensaje de error del POST comparten el valor efectivo. No se
modifican SUNAT_TIMEOUT_MS, el resolver general ni el cliente SOAP individual.

El consumidor hace una consulta por corrida. Con ticket y respuesta 98/99 o
fallo recuperable de consulta publica el siguiente job con startAfter: tras el
intento 1 espera 5 minutos; tras el 2, 15; tras el 3, 30; luego una hora. El
contador sondeoIntento y ticketConsulta viajan en el payload persistido de
pg-boss, sin temporizador en memoria ni campos/tablas nuevos. Los sondeos
diferidos cotejan el ticket esperado antes de cualquier transporte: si falta o
cambió, no pueden convertirse en sendSummary. Al intento 24 no se publica otro:
se conserva POLLING con «Sondeo automático agotado tras 24 intentos… consulte el
ticket manualmente» y la causa última. La consulta manual permanece operativa.
Si falla publicar el siguiente job, se relanza para recuperación de
infraestructura; cualquier reentrega retoma el ticket, no una emisión.

Se preservan compuerta, artefactos, incertidumbre y persistencia de la Parte 2:
se usan cargar/pendiente existentes sin modificar su implementación. Un fallo
sin ticket conserva el circuito previo de infraestructura/DLQ y nunca se libera
su incertidumbre para reenviar a ciegas. Los 24 son los intentos programados del
payload: pg-boss conserva su semántica de entrega al menos una vez; una caída
entre publicar y completar el job padre puede repetir una consulta, siempre
con el mismo ticket. No se modifica ese contrato transaccional en esta parte.
Los trabajos ya agotados en DLQ antes del parche no se reactivan automáticamente;
el equipo puede consultar sus tickets manualmente, sin reenviar el agregado.

Front por ferry: solo consultarAgregado tiene timeout 120000; axios.ts global
sigue en 15000. El Monitor muestra «Consultando…» y deshabilita duplicados hasta
resolver/rechazar; después conserva el resultado o el motivo visible.

Pruebas: defecto/override/valores inválidos y aislamiento del timeout individual;
presupuesto efectivo de ambas operaciones y mensaje; tres recorridos completos
de 24 sondeos simulados (timeout, 98, 99), fechas de startAfter, instancia nueva
por corrida tras serializar payload, ticket fijo y un solo sendSummary;
consulta manual después del agotamiento, publicación fallida, metadatos inválidos,
ticket perdido y CDR finalizado. Front: timeout propio, global intacto y estado
visible durante promesa pendiente tanto con respuesta como con error. Ninguna
llamada real a SUNAT. Sin migraciones nuevas, PR, fusiones ni despliegues.

Cierre: back **258 suites / 2374 pruebas aprobadas** (+25), 12 snapshots intactos;
4 suites / 38 pruebas omitidas por las condiciones existentes. Front **100
archivos / 788 pruebas aprobadas** (+3). Build de ambos y lint de los archivos
front modificados aprobados; lint back solo conserva el aviso heredado en una
prueba de Contabilidad sin cambios. Cobertura local nueva (LCOV + diff frente a
cb878d9f): 42/42 líneas y 54/61 resultados de condiciones; combinado **93,20%**.
No se cambian umbrales/configuración de CI o Sonar. La prueba de integración
existente usó únicamente PostgreSQL local nuevo/desechable con las migraciones
existentes; el contenedor y su volumen ya se eliminaron. No se aplicó nada a
bases compartidas. Entrega front solo por `ferry/m1-resumenes-timeout` con su
FERRY.md; sin push al repositorio front.

### Parte 4 — Precio de venta real y almacén explícito (opción B)

Autorización de Jhordy comunicada por Emma: construcción desde dev af8584af,
con la deuda de las dos pruebas de Compras reconocida como línea base ajena.
Solo M1; sin modificar Inventario, Contabilidad ni Resiliencia, sin migración
nueva, sin operaciones reales ante SUNAT y sin cambios retroactivos.

**Contrato de precio:** `inventory_products.sale_price` es el precio unitario
FINAL en PEN, con IGV incluido. El catálogo M1 entrega `salePrice`, `vendible`
y el motivo «sin precio de venta configurado» para NULL/no positivo. El front
solo ofrece productos vendibles y nunca recurre a `/inventory/stocks` ni a
`average_unit_cost` para fijar el precio. Seleccionar sin editar conserva ese
precio final; para gravadas el servidor desglosa el valor / 1.18 con su precisión
unitaria existente y redondea los importes como antes. Exoneradas, inafectas y
gratuitas conservan su tratamiento fiscal (incluidos los valores referenciales
de las gratuitas). No se modifica la estructura ni las fórmulas del generador.

Ambas rutas pasan por la guarda común: un producto sin precio impide numerar,
persistir y encolar. Un precio de venta enviado que difiere del catálogo se
rechaza con petición de actualizarlo: tampoco se sustituye silenciosamente un
precio obsoleto. Los descuentos siguen su contrato existente. Las notas 07/08 quedan fuera del cotejo de precio de venta vigente y no se reprecian desde el catálogo. La precarga de la interfaz toma datos del comprobante de origen, pero el back no garantiza en todos los contratos la igualdad de sus precios unitarios con los del origen. Las guardas de referencia, saldo monetario y cantidades conservan su alcance; no equivalen a esa garantía de precios.

**Almacén:** los dos formularios muestran el selector, con ALM-01 inicial
explícito, y consultan los almacenes activos de la empresa en M1. No se elige
el primero ni el de mayor stock; si no existe/está inactivo el elegido, la
guarda devuelve una causa clara antes de numerar. Se normaliza el código y se
congela como `payload_ubl.almacen` en ambas rutas. La consulta del catálogo y
la validación de stock filtran ese almacén (sumando cantidades de SKU repetidos,
no saldos de otros almacenes). El consumidor lee el valor persistido y lo
entrega al puente M1, cuya interfaz existente lo transporta a Kardex. El costo
mantiene `quantity * previous_unit_cost` de los movimientos reales registrados
por ese puente: no se toma del precio de venta ni se cambia Contabilidad.
Los históricos sin este metadato conservan su comportamiento anterior; no se
reescriben XML, payloads, movimientos ni asientos ya emitidos.

**Pantalla:** Configuración → Precios de venta, protegida por ADMIN como la
configuración existente. Lista los productos activos, incluidos los que aún no
tienen precio, y edita solamente `sale_price` mediante el PATCH existente
`/inventory/stocks/products/:sku`, con importe positivo de hasta dos decimales,
estado de guardado y resultado visible. No se crea una tarifa paralela ni se
cargan precios demo: esa carga posterior corresponde a Emma. Entrega front
exclusivamente por `ferry/m1-precio-venta-almacen`, con rutas exactas y FERRY.md.

Verificación local usa únicamente una base PostgreSQL desechable nueva con el
juego de migraciones YA existente, bajo la excepción local previamente concedida;
no se genera/aplica una migración de esta parte ni se accede a bases compartidas.
El build back hereda un error de tipo en inventoryPurchasesController:55 por
`listPayables` inexistente, la misma deuda de Compras aceptada por Emma. El lint
front global hereda 64 errores/25 advertencias (idénticos en la base); no se
corrigen módulos ajenos ni se cambia configuración para ocultarlos.

Pruebas back completas (con cobertura, heap local 4 GB; sin cambiar CI):
base **259 suites / 2393 pruebas aprobadas**; cierre **260 suites / 2407 pruebas
aprobadas**, +14 pruebas. En ambos: exactamente 1 suite / 2 pruebas fallidas de
`test/unit/inventory/inventoryPurchaseService.spec.ts`, deuda de Compras aceptada;
4 suites / 38 pruebas omitidas. Los **12 snapshots fiscales pasan sin modificación**.
Cobertura local nueva contra af8584af: **18/18 líneas instrumentadas y 29/29
resultados de condiciones**, combinado 100%; estimación LCOV+diff, no resultado
remoto de Sonar. Lint back aprobado con tres avisos heredados; build back conserva
únicamente el error ajeno de listPayables descrito arriba.

Los tests cubren catálogo sin recambio de costo, precios nulos/cero/negativos,
precio obsoleto, aislamiento del almacén, bloqueo previo a numerar en ambas
rutas, payload congelado en ambas rutas, consumidor→puente con ALM-02, stock
agregado por SKU solo en el almacén elegido y costo desde previous_unit_cost,
así como ambas notas sin repricing aunque no exista precio de catálogo.

Front base: **100 archivos / 788 pruebas** (dev 7b60fe4). Cierre:
**101 archivos / 797 pruebas aprobadas**, +9, build aprobado. Nuevos tests:
selección→precio final→payload para afectaciones gravada/exonerada/inafecta/gratuita;
almacén principal explícito, selección de ALM-02 en página y modal y conservación
al reintentar; pantalla de precios (PATCH exclusivo de sale_price, éxito, error y
validación). Los harness previos incorporan la lectura de almacenes sin cambiar
sus aserciones tributarias/SPOT. La bandeja carga el catálogo principal al abrir
el modal; un cambio de almacén carga su stock y descarta respuestas obsoletas.
La base local desechable usada para la verificación ya se eliminó. Los precios
reales de los productos demo siguen pendientes de carga por Emma, fuera de esta
entrega; no se inventó ni sustituyó ningún precio.

### Reproceso del puente para comprobantes aceptados — 10 nov 2026

Autorización de Emma/Jhordy tras Fase 0: rama `fix/m1-reproceso-puente`, base
back dev `23981b1da5f3bb7889a36e25ff1de5ef707848e9` y front dev
`27731aa76de8f23d3de7ee05f35ff3833de3e905`. Línea base back: **263 suites /
2433 pruebas aprobadas, cero fallos**, 4 suites / 38 pruebas omitidas, 12
snapshots fiscales; build aprobado. Front: **101 archivos / 797 pruebas**.

**Objetivo operativo:** la F001-00000064 NO es un exhibit que deba permanecer
bloqueado. Tras el despliegue del equipo, Emma podrá ejecutar el endpoint nuevo
sobre el ID real de ESA factura y recuperar el movimiento de Kardex de ALM-02 y
el asiento de costo pendiente de S/ 15.00, conservando el asiento de venta
001-202611-039 existente. La F001-00000065 ya probó que el motor normal funciona:
esta ronda aporta la vía de recuperación que faltaba. No se ejecutó ese
reproceso contra producción ni se afirma aquí que la factura real ya esté
recuperada: la comprobación de ese resultado corresponde a Emma tras su tren.

**Una sola lógica:** `InvoiceBridgeCoordinatorService` concentra la carga del
comprobante/payload, liquidación de sus importes persistidos, invocación de
`InvoiceAccountingBridgeService` y respaldo del asiento de venta. El consumidor
usa ese coordinador y conserva la semántica de relanzar efectos pendientes
(M1_KARDEX_PENDING / revisión / fallo de respaldo); una reentrega aceptada no
vuelve a preparar ni enviar. La liquidación fiscal y los importes no se
recalculan desde el catálogo actual, y se respeta `payload_ubl.almacen`.

**Ruta exclusiva local:** `POST /api/v1/invoices/:id/reprocesar-puente`, ADMIN,
con empresa tomada del token, rechazo si falta empresa y 404 para un ID ajeno.
Solo ACEPTADO/OBSERVADO; los demás estados reciben 400 con causa clara, antes
de ejecutar el puente. El controlador y el coordinador no tienen dependencias
de cola, firma, consulta ni transporte SUNAT. `retry-cdr` y su lista de estados
reintentables permanecen intactos.

Respuesta: `{ completo, yaCompleto, asientoId, asientoOmitido, asientoCostoId,
costoVenta, kardex, movimientosRegistrados, movimientosOmitidos, errores }`.
Los campos de asiento/costo son opcionales según el caso. Se reutilizan las
guardas e identidades existentes por documento/producto y referencia contable;
solo se añade al resultado interno M1 `asientoCostoOmitido` para distinguir
costo ya existente de costo creado en esta pasada. «Ya completo» requiere no
haber creado movimiento ni asiento de venta/costo. No escribe marcas de
reproceso ni consume una capa adicional. Si falta FIFO, devuelve pendiente y
la causa; corregida la capa, otro reproceso completa lo que faltaba. Se
conserva la semántica actual por fases del puente, sin prometer una nueva
transacción global ni alterar la implementación de Inventario/Contabilidad.

**Front, solo detalle:** botón ADMIN «Reprocesar puente» para ACEPTADO/OBSERVADO,
deshabilitado mientras espera, con resultado completo / ya estaba completo /
sigue pendiente y motivos en la misma vista. Llama únicamente al endpoint nuevo;
no dispara «Consultar SUNAT», reenvío, `retry-cdr` ni otra pantalla. Entrega por
`ferry/m1-reproceso-puente` y FERRY.md; ningún push al repositorio front.

**Pruebas:** escenario equivalente a F001-64 con asiento de venta existente,
una unidad CEM-001 en ALM-02, capas FIFO reales del motor con repositorios
simulados, recuperación de Kardex y costo 15.00, y segunda ejecución sin
escrituras de movimiento, asiento, saldo ni consumo de capa. Sin capa: ninguna
escritura de salida/costo, resultado pendiente; añadida la capa simulada, el
mismo comprobante se recupera. Estados no admitidos, OBSERVADO, empresa ajena,
empresa ausente, autorización HTTP 401/403 y endpoint sin proveedores SUNAT.
Las pruebas previas del consumidor mantienen sus aserciones. Front: estados,
roles, éxito/no-op/pendiente, error HTTP, doble clic y endpoint exclusivo.

Sin migraciones nuevas ni cambios en Resiliencia, Inventario o Contabilidad;
no se reescriben estado fiscal, CDR, XML, numeración ni precios del comprobante.
La suite usa solo PostgreSQL local desechable con migraciones existentes bajo
la excepción local previamente autorizada. Sin emisiones reales, llamadas
reales a SUNAT, PR, fusiones ni despliegues.

Cierre: back **264 suites / 2445 pruebas aprobadas, cero fallos** (+1 suite,
+12 pruebas), con las mismas 4 suites / 38 pruebas omitidas y **12 snapshots
fiscales intactos**. Build y lint back aprobados. Cobertura local nueva contra
23981b1da: 153/160 líneas instrumentadas (**95,62%**) y 165/210 resultados de
condiciones; combinado **85,95%**, medido por LCOV + diff, sin cambiar umbrales
ni configuración de Sonar/CI. El harness de TA-58 ahora entrega los campos
obligatorios de ResultadoPuente (errores y contadores), sin debilitar ninguna
aserción de envío.

Front **102 archivos / 811 pruebas aprobadas** (+1 archivo, +14 pruebas), build
y lint de los cuatro archivos modificados aprobados. La base local desechable
utilizada para las pruebas ya se eliminó; ninguna base compartida fue tocada.
La acción productiva pendiente es exclusivamente de Emma tras el despliegue:
ejecutar el nuevo endpoint para la F001-00000064 y comprobar Kardex ALM-02,
asiento de venta conservado y asiento de costo de S/ 15.00. Esta entrega no
realiza esa operación ni la sustituye por una reentrega del comprobante.

### Parte 5 — Pulido final del recorrido (10 nov 2026)

Base back dev f8cea8c56314e61b575ed463b473ecbc50ccee37: 264 suites / 2445
pruebas aprobadas, cero fallos, 4 suites / 38 pruebas omitidas y 12 snapshots
fiscales intactos. Front dev 640d4b88ef8cfd81e7241874f184a13a5bf48cf1:
102 archivos / 811 pruebas aprobadas. Rama fix/m1-pulido-recorrido; front solo
por ferry/m1-pulido-recorrido. Sin migraciones nuevas ni operaciones reales.

**5A — Panel:** el neto del servidor incluía EN_COLA/ENVIADO/PENDIENTE mientras
la bandeja solo suma ACEPTADO/OBSERVADO. Ahora el dinero sigue los mismos tipos
01/03 + 08 - 07 confirmados; una EN_COLA de S/118 (escenario de F001-57) no lo
infla. Se añade total de documentos registrados en el período (todos los
estados), explícitamente rotulado en el panel junto a aceptados/observados.
Se preserva emitidos para consumidores anteriores y no se cambia la bandeja.
Pruebas: aceptadas, NC, ND, pendiente 118 y todos los tipos/estados sin confirmar;
conteo total y criterio visible en el panel. Validación focalizada aprobada; cierre completo de 5A–5D al final de esta sección.

**5B — Presentación del bloqueo local:** se deriva resultado_presentacion del
CDR y del historial ya persistidos, sin tocar estados ni datos históricos.
Marcador explícito «Bloqueado antes de enviar por la validación XSL» (incluye
los diagnósticos XSD del ejecutor) → VALIDACION_LOCAL. CDR de rechazo o SOAP
Fault reconocido → SUNAT. Código aislado o falta de CDR no prueban origen:
NO_DETERMINADO. Una decisión posterior no reconocida no revive un bloqueo
anterior. El listado consulta un historial acotado y el detalle usa el mismo
clasificador. Front transporta esa lectura, hidrata los datos del detalle y
unifica badge, motivo y auditoría: local no dice «SUNAT rechazó» ni «todavía
no respondió». La presentación de origen incierto es neutral.
Pruebas focalizadas: 3128, XSD, CDR, SOAP Fault, evidencia insuficiente,
cronología, marcadores operativos y conservación del estado RECHAZADO;
lectura coherente en listado y detalle, con motivo visible. Generador y
compuertas fiscales permanecen intactos.

**5C — Rescate DLQ efectivo. Excepción autorizada por Jhordy el 10 nov 2026,
para aviso a Oliver, dueño de Resiliencia:** el único cambio productivo fuera
de M1 es reenqueueInvoiceIfIdle en queue.service.ts. Se añade opción explícita
rescatarDlq; las llamadas automáticas sin ella conservan EN_DLQ, sin rescate
ni bucle automático de reinicio de intentos. El rescate manual verifica la
empresa del payload y exige callback M1 de estado/seguridad. Publica primero
en la cola principal con singletonKey y solo elimina DLQ cuando hay publicación
o trabajo vivo comprobado. Fallo de publicación conserva DLQ; fallo de limpieza
se puede retomar sin otra publicación. Sin publicación comprobada devuelve
EN_DLQ, nunca un éxito ficticio. Dos acciones concurrentes no duplican trabajo.

M1 usa la opción en el endpoint EXISTENTE de retry-cdr y completa la persistencia
de incertidumbre desconocida para los estados que ese endpoint ya admitía,
antes de publicar. No se cambia ESTADOS_REINTENTABLES ni se amplían estados:
ACEPTADO/OBSERVADO/ANULADO permanecen protegidos. Marcadores true/false existentes
se conservan. El consumidor y su conciliación previa al reenvío no se modifican;
la suite previa de intento incierto verifica consulta antes de sendBill y bloqueo
ante consulta inconclusa. No hay consulta real a SUNAT en estas pruebas.

El Monitor muestra «Reintentar» en DLQ y ERROR_RED permitidos, conserva resultado
y actualiza la etiqueta tras ENCOLADO. Prueba con PostgreSQL y pg-boss REALES,
sin registrar consumidor SUNAT: F001-57 simulada en EN_COLA/DLQ, marcador true
comprobado en base antes de boss.send, trabajo eliminado de DLQ, un único job
principal, segundo clic sin publicación y estado ACEPTADO protegido. También
fallos de publicación/limpieza, concurrencia, compañía ajena, callback ausente
y publicación no comprobada. La ejecución real sobre F001-00000057 corresponde
solo a Emma tras el despliegue; no se ejecutó en producción.

**5D — No reproducible en dev:** las seis pruebas nuevas cubren página estándar
y modal, cada uno con selección por clic, foco de sugerencia mediante Tab y
Enter (teclado nativo), y texto escrito sin confirmar selección. Preparan la
línea, eligen/escriben al cliente y pulsan Emitir UNA vez sin retocar nombre ni
documento. El primer payload contiene documento 20100070970, tipo 6 y razón
social Ferretería Los Andes S.A.C.; no aparece «Falta la razón social del
cliente». Se conservan los setters existentes: NO se cambia el código de
CustomerLookupField ni los formularios por una causa no demostrada. No se
agregan atajos ni confirmación implícita de sugerencias. Esto no niega el
síntoma verificado por Emma en el main desplegado de las emisiones -64/-65;
la evidencia nueva corresponde exclusivamente al dev probado.

Cierre completo: back **267 suites / 2469 pruebas aprobadas**, cero fallos
(+3 suites / +24 pruebas). Se conservan 4 suites / 38 pruebas omitidas y los
**12 snapshots fiscales intactos**. Front **105 archivos / 827 pruebas aprobadas**,
cero fallos (+3 archivos / +16 pruebas). Build de ambos aprobado; lint back sin
errores/avisos; lint front de archivos modificados sin errores y solo el aviso
preexistente de Fast Refresh por exportar estadoDeMonitor junto al componente.
Cobertura local nueva (LCOV + diff contra f8cea8c): **38/38 líneas (100%)**,
64/71 resultados de condiciones; combinado **93,58%**. No se modifican umbrales,
configuración de CI/Sonar, esquemas, compuertas ni matemática UBL.

Se entregan commits por 5A/5B/5C y la documentación/regresión de 5D. El único
cambio productivo en Resiliencia es el método reenqueueInvoiceIfIdle autorizado;
no se cambia retryDlq, políticas de reintentos, reconciliador automático ni
invoiceRetryService. En M1, retry-cdr conserva ruta y estados admitidos; solo
activa el rescate explícito y asegura el marcador previo a publicar en las
ramas ya existentes. La base PostgreSQL local desechable se eliminó tras las
pruebas. Ninguna base compartida fue tocada. Entrega front solo por ferry con
FERRY.md y manifest de rutas exactas. El rescate de la F001-00000057 real queda
para Emma después del despliegue; no se ejecutó en esta ronda.

### Parte 5b — Raíz de la incertidumbre de transporte (10 nov 2026)

Base back dev `f831ec68e9d105e3c4cb2a1f39e1956b51e8488c`; rama
`fix/m1-incertidumbre-transporte`. Base front dev
`793149f86a9f904f7d200bd2e5f08d281bda9610`; entrega exclusiva por
`ferry/m1-incertidumbre-transporte`, con manifiesto en FERRY.md.
Línea base ejecutada: **267 suites / 2469 pruebas back** aprobadas, 4 suites /
38 pruebas omitidas, 12 snapshots; **105 archivos / 827 pruebas front** aprobadas.

**Causa:** consultar ya devolvía RECUPERADO / NO_ENCONTRADO / INCIERTO, pero
consultarEstado convertía INCIERTO en ISSUER_STATUS_UNCERTAIN. La conciliación
previa capturaba esa excepción como fallo y terminaba en ERROR_RED/DLQ; la
posterior al envío la dejaba escapar para gastar reentregas de pg-boss. El
marcador true tampoco distinguía su origen: rescate presunto o envío real.

**Excepción autorizada por Jhordy el 10 nov de 2026, para aviso a Oliver:**
se modifica SOLO `src/modules/resilience/infrastructure/queue/invoiceRetryService.ts`
en Resiliencia, para ampliar el puerto a resultado estructurado y tratar las dos
conciliaciones. Fundamento: orden de solucionar el defecto de raíz. No se toca
ningún otro archivo productivo de Resiliencia, colas, circuito, política de
backoff, retry-cdr ni ESTADOS_REINTENTABLES. Los harness de pruebas se adaptan al
contrato nuevo y a la traza adicional, conservando las aserciones de los cuatro
envíos y esperas 5/15/45 s cuando la consulta confirma ausencia.

La clasificación inicial de Parte 5b se basaba en el historial completo, pero podía degradar una incertidumbre previa al aparecer un bloqueo local posterior. La Parte 8C-C1 corrigió esa limitación: separa evidencia histórica de envío e incertidumbre pendiente; un bloqueo local posterior no borra ninguna. Solo una resolución concluyente cierra la incertidumbre. M1_TRANSPORT_UNCERTAIN impide concluir que no hubo envío, pero no acredita por sí solo un envío.

Todo envío individual, incluido el flujo normal, confirma el evento durable
`M1_TRANSPORT_STARTED` en el historial antes de invocar sendBill. Si falla esa
escritura, NO se abre conexión. Se conserva el estado fiscal real de la factura.
La consulta devuelve el mismo contrato estructurado a su llamador: recuperado
persiste el CDR y no reenvía; ausencia confirmada permite reenviar; inconclusa
conserva el marcador, registra `M1_TRANSPORT_UNCERTAIN` con motivo y devuelve
resultado reintentable sin DLQ. No se duerme ni se consume un envío por consultar:
consulta previa inconclusa tiene 0 envíos; timeout seguido de inconclusa tiene
1 envío real y no genera otro. La reserva del circuito se libera como antes;
los resultados reales de transporte siguen alimentando el circuito existente.
El trabajo termina esa ejecución sin error y el comprobante permanece durable,
visible y recuperable mediante la acción existente; no se inventa otra cola ni
un ciclo de reintentos automáticos con una política nueva.

**Fixture REAL F001-00000057:** exportación completa proporcionada por Emma
(Supabase, solo lectura, 10 nov), guardada en
`test/fixtures/f001-57-transport-history.ts`. Invoice id
`e0796a65-3fca-40a1-8028-7dd59c378f36`, ERROR_RED, transport_uncertain true,
sunat_response_code null. Las tres filas literales de transaction_history son:
rescate EN_DLQ del 6 nov 15:38:26.753 UTC, rescate ENCOLADO del 10 nov
17:27:18.430 UTC y MAX_REINTENTOS / ISSUER_STATUS_UNCERTAIN del 10 nov
17:27:26.405 UTC. Todas tienen tiempo y HTTP null. No se inventan IDs ni
company_id no proporcionados, ni el bloqueo XSL ausente.

**Clasificación: EVIDENCIA_INSUFICIENTE.** No hay evento explícito del bloqueo
original ni inicio/resultado de transporte. La compuerta escribe su decisión en
transaction_history mediante persistFailure; no identifiqué en el código otro
registro durable del bloqueo original de esta factura en audit_logs o en sus
campos. No se consultó la base compartida para esta ronda. Un XML inválido o el
relato del bloqueo no sustituyen una traza durable para autorizar un reenvío.
La prueba usa exactamente esas tres filas, luego añade únicamente el evento
nuevo generado por la implementación y conserva esa clasificación. Consulta
beta inconclusa: queda pendiente accionable con motivo, no reenvía ni vuelve
a DLQ por fallo. Por tanto ESTA RONDA NO GARANTIZA EL REENVÍO de la F001-57
histórica: sin evidencia adicional o consulta concluyente, sería reenviar a
ciegas. Emma hará cualquier recuperación en vivo tras el despliegue.

**Presentación:** listado y detalle transportan el origen TRANSPORTE_INCIERTO
y su motivo con la proyección existente de resultado_presentacion. La ficha,
badge, filtros y Monitor muestran «Incertidumbre de transporte»; SIN_CONFIRMAR
ya no afirma «Error de red / No llegó a SUNAT». No se reescriben estados ni
históricos. El Monitor conserva la acción Reintentar también para un ENVIADO
incierto; usa el endpoint ya existente, que decide/conciliará antes de enviar.
Las pruebas recorren los mappers reales y el clic con transporte simulado.

**Verificación final:** **269 suites / 2493 pruebas back aprobadas**, cero fallos (+2 suites / +24 pruebas); 4 suites / 38 pruebas omitidas sin cambios y **12 snapshots fiscales intactos**. Front **105 archivos / 829 pruebas aprobadas**, cero fallos (+2 pruebas). Ambos builds aprobados; lint back sin errores/avisos; ESLint de archivos front modificados sin errores y dos avisos preexistentes de Fast Refresh. Cobertura local nueva (LCOV + diff contra f831ec6): **52/52 líneas (100.0%)**, combinado líneas/condiciones **93.89%**; no es una ejecución remota de Sonar ni cambia umbrales o CI.
La corrida global detectó un harness TA-58 que aún devolvía el contrato antiguo;
se adaptó a RECUPERADO sin cambiar sus aserciones de recuperación/envío único.
Otra corrida coincidió con el build y falló únicamente en la cota de latencia
TA-13 (7/10 bajo 800 ms; las diez respuestas fueron 202). La repetición completa aislada aprobó
sin compilaciones ni pruebas concurrentes, sin tocar el test ni su umbral.

Sin migraciones nuevas/generadas, PR, fusiones, despliegues, emisiones reales o
llamadas reales a SUNAT. Las migraciones ya existentes se aplicaron únicamente
a una base PostgreSQL local nueva y desechable para reproducir la suite bajo la
excepción local previamente autorizada; ninguna base compartida fue tocada.
SPOT, reglas fiscales, generadores UBL, Contabilidad e Inventario intactos.

### Parte 6 — Fase 0: cierre del recorrido (10 nov 2026, pendiente de aprobación)

SOLO reconocimiento y diseño. Rama back `fix/m1-cierre-recorrido` desde dev
`b20706f73ca2e0481cac3379cd1b5dc879c080c9`; front local en rama homónima desde
`a38c8729bf92e74ac5a6ae099872ae21938885c3`. Sin cambios de implementación,
commits, push, PR, fusiones, despliegues, emisiones ni consultas a servicios
transaccionales SUNAT. Las fuentes normativas consultadas son públicas.

Línea base completa ejecutada: **back 271 suites / 2501 pruebas aprobadas**, cero
fallos, 4 suites / 38 pruebas omitidas y 12 snapshots; **front 105 archivos /
829 pruebas aprobadas**, cero fallos. PostgreSQL exclusivamente local y
desechable, migraciones EXISTENTES bajo la excepción local previamente aprobada;
no se generó ninguna migración. MAYORISTA es carga de datos de Emma: no cambia
el contrato sale_price PEN final con IGV ni habilita otro precio por código.

#### Mapa y construcción propuesta por punto

**6A — Notas.** `front/src/modules/invoices/lib/invoiceEmitDraft.ts:134` inicia
el documento afectado VACÍO. `components/InvoiceEmitCampos.tsx:135` contiene
F001-0042 como PLACEHOLDER; no es una precarga persistida. Cambiarlo por una
instrucción neutra y comprobar reapertura/cambio de tipo sin referencias viejas.
`components/InvoiceItemsGrid.tsx:213` enlaza directamente un número al input:
step=0.01 no fuerza dos decimales visibles. Usar edición monetaria con texto
transitorio y formato de dos decimales al presentar/abandonar, sin redondear los
valores fiscales heredados ni recalcular precios de notas desde el catálogo.

Las fuentes YA coinciden: página `pages/InvoiceEmissionPage.tsx:173` y modal
vía `InvoiceList.tsx:104` usan `services/inventoryProductsApi.ts:64`, endpoint
GET /invoices/products por almacén. Pero `invoiceQueryService.ts:117` filtra
activos y `inventoryProductsApi.ts:20` elimina los no vendibles/sin sale_price;
además `:69` convierte un error de carga en []. El modal recibe [] mientras
carga (`InvoiceEmitModal.tsx:240`) y `invoiceStockLinea.ts:162` confunde ausencia
en esa lista con inexistencia en inventario, incluso promete que no habrá Kardex.
Una nota puede contener una línea histórica/inactiva perfectamente válida.
Propuesta: fuente M1 compartida y estado de carga/error explícito; distinguir
catálogo de venta, existencia de inventario y línea histórica del origen. Para
notas, recuperar existencia/stock desde esa misma consulta M1 con filtro adecuado
al origen, sin ofrecer productos no vendibles para nuevas ventas. La precarga debe conservar los valores fiscales del origen. La comparación obligatoria de precios contra el origen en todos los contratos del back queda como alcance pendiente, independiente de la validación de cantidades y saldo ya construida. Mantener advertencia específica cuando sea histórico y nunca afirmar inexistencia si la consulta falla o todavía carga.
Pruebas: placeholder vacío, reapertura, dos decimales sin mutación fiscal,
producto común, carga/error e histórico inactivo. Sin migración ni código de
Inventario; solo lectura de sus datos por la interfaz M1 actual.

**6B — Terceros, diagnóstico solamente.** `prisma/seeds/master-data.seed.ts:54`
define nueve ejemplos: 20100000001 Cementos Andinos; 20100000002 Aceros del Perú;
20100000003 Agregados Lima; 20100000004 Transportes Callao; 20100000005 Agencia
Pacífico; CN91440300MA5XYZ12 Shenzhen Construction Supplies; 20500000001
Constructora Los Andes; DNI 12345678 José Pérez; 20500000002 Inmobiliaria
Miraflores. También `prisma/seeds/customs.seed.ts:244` sincroniza proveedores
en business_partners. Esto identifica origen de SEED, no demuestra que las filas
existan en producción ni autoriza a eliminarlas.

`prisma/schema/invoicing.prisma:49` guarda identidad/nombre como snapshot, sin
FK al tercero; cruce por empresa + tipo/número, no por nombre. La cartera también
lee esos snapshots (`invoiceCustomerService.ts:93`). Solicité a Emma exportación
sanitizada: no hay conector de lectura a Supabase en este entorno. Hasta recibirla,
**pendiente el listado REAL de referenciados**. El cruce debe separar confirmados
ACEPTADO/OBSERVADO, otros documentos numerados y posibles snapshots legados con
identidad incompleta. No tener referencias M1 no demuestra ausencia de referencias
en Compras/Inventario/Aduanas. Ningún dato se limpia en esta ronda.
Consulta de diagnóstico para revisión/ejecución de Emma, nunca ejecutada aquí:

```sql
SELECT p.id, p.company_id, p.doc_type, p.doc_number, p.legal_name, p.is_active,
       count(i.id) AS comprobantes_con_identidad_exacta,
       count(i.id) FILTER (WHERE i.estado IN ('ACEPTADO','OBSERVADO')) AS confirmados,
       jsonb_agg(jsonb_build_object('id',i.id,'numero',i.serie || '-' ||
           lpad(i.correlativo::text,8,'0'),'estado',i.estado))
         FILTER (WHERE i.id IS NOT NULL) AS referencias
FROM business_partners p
LEFT JOIN invoices i ON i.company_id = p.company_id
 AND i.customer_identity_type = p.doc_type
 AND btrim(i.customer_identity_number) = btrim(p.doc_number)
GROUP BY p.id, p.company_id, p.doc_type, p.doc_number, p.legal_name, p.is_active
ORDER BY p.company_id, p.doc_number;
```

**6C — Duplicados.** `InvoiceEmissionPage.tsx:309` rellena vacía o añade;
`InvoiceEmitModal.tsx:355` agrega sin comprobar SKU repetido. Propuesta compartida
para emisión 01/03: al elegir o confirmar SKU ya presente, diálogo con cantidades
actual/nueva/resultante y botones Fusionar cantidades / Mantener separada /
Cancelar; nada se modifica hasta confirmar. Fusión solo con mismo SKU canónico,
unidad, afectación, precio y condiciones fiscales/comerciales equivalentes
(descuento, ICBPER, SPOT). Si difieren, explicar que no se pueden fusionar y
permitir separada solo con decisión explícita. Preservar precio de la línea
existente y recalcular cantidades/totales/stock agregado. Cubrir también SKU
introducido manualmente. No fusionar automáticamente líneas históricas de notas.
Pruebas en página y modal: fusionar/cancelar/separar, incompatibilidades y stock.
Sin migración ni otros módulos.

**6D — MTQ.** Evidencia directa: `assets/sunat-sfs/commons/cpe/catalogo/cat_03.xml:1650`
contiene MTQ=cubic metre; el XSD UN/ECE
`commons/xsd/2.0/common/CodeList_UnitCode_UNECE_7_04.xsd:6956` también lo admite.
La tabla oficial SUNAT de unidades incluye MTQ=METRO CUBICO:
[RS 169-2015, anexo de tablas](https://www.sunat.gob.pe/legislacion/superin/2015/anexo3-rs169-2015.pdf).
No cambiar el dato MTQ de ARE-001 a NIU ni convertir sus cantidades.
Causa: whitelist reducida front `invoiceItems.ts:40`, rechazo en :305; back
`sunatCatalogs.ts:151` también lo omite. Añadir MTQ en ambas y su presentación m³.
Pruebas seleccionar Arena MTQ, payload sin sustitución, XML generado por código
con unitCode MTQ y SFS real sin error de unidad; unidades ajenas siguen protegidas.
Sin migración ni cambios de Inventario.

**6E — Precio sugerido.** `InventoryProductSearchSelect.tsx:72` muestra
producto.valorUnitario (sin IGV); `inventoryProductsApi.ts:37-38` conserva valor
neto y precioUnitario final separados. Usar precioUnitario para la sugerencia,
mismo formato de dos decimales de la línea y etiqueta clara de IGV incluido.
Sin recambio por costo. Prueba catálogo 118 final / 100 base: sugerencia 118.00,
seleccionar sin editar, payload 118.00, notas mantienen origen. Sin migración.

**6F — Series ADMIN.** `InvoiceSettingsTab.tsx:25` solo lista.
POST ya existe en `invoiceConfigController.ts:86`, pero tiene SOLO AuthGuard de
clase (:51), no RolesGuard/ADMIN en el método (a diferencia de PUT config :65).
Propuesta: proteger también el back con ADMIN; formulario front de tipo
01/03/07/08, serie y correlativo, errores inline y refresco de useInvoiceConfig
más catálogo de series. El endpoint interpreta correlativo_inicial como último
usado (`invoiceSeriesService.ts:177`); la reserva incrementa en :99. UI debe
explicitarlo y mostrar siguiente: guardar 0 implica emitir 1. Reactivar nunca
reinicia un correlativo (:180). Pruebas ADMIN/403, tipos/series inválidos,
reactivación sin reset, éxito/refresco/error en UI. Sin migración.

**6G — Paquete docente.** Identidad ya tiene búsqueda en
`CustomerLookupField.tsx:94`; origen de notas usa datalist en
`InvoiceEmitCampos.tsx:124`, producto no tiene navegación explícita de flechas
(`InventoryProductSearchSelect.tsx:48`). Emisión combina errores globales con
algunos inline: completar requeridos marcados, aria-required/aria-invalid,
mensaje asociado y foco al primer inválido; mantener selecciones reales y no
confirmar una sugerencia por solo haber escrito texto. Selectores de tipo,
serie, unidad, afectación, motivo, medio SPOT y almacén; combobox de productos,
clientes y orígenes reales, sin inventar identificadores ni datos demo.

Límite: el alta de cliente de M1 reutiliza
`src/modules/customs/components/PartnerFormDialog.tsx:26`, invocado desde
`CustomerLookupField.tsx:110`. Sus campos :103 y botón deshabilitado :203 no
ofrecen validación requerida inline. **DETENIDO 6G-alta de terceros**: requiere
excepción puntual para ese componente de Aduanas compartido (o un rediseño
explícito), no se lo modifica por inferencia ni se duplica todo el formulario.
Propuesta de excepción: validación visual del modo de alta de cliente M1, sin
cambiar contratos/endpoints/persistencia de terceros ni otros flujos.

Atajos propuestos, visibles en ayuda de emisión y con aria-keyshortcuts:
Alt+C cliente; Alt+P producto; Alt+L nueva línea; Ctrl+Enter revisar emisión
(abre confirmación, no envía solo); Escape cierra sugerencias/diálogo secundario,
no descarta borrador ni interrumpe envío. Flechas arriba/abajo y Enter seleccionan
sugerencias; Tab conserva recorrido nativo. No disparar durante composición IME,
con otro modal activo o mientras envía; sin manejadores globales fuera de M1.
Pruebas click/teclado, errores por campo, foco, catálogos y atajos sin doble envío.
Sin migración; excepción fuera de M1 señalada, pendiente de aprobación.

**6H — OBSERVADO origen.** Bloqueos explícitos en back
`creditNoteBalanceGuard.ts:30` (ESTADOS_NOTABLES solo ACEPTADO) y
`creationGuards.ts:130` (segunda ruta transaccional). InvoiceNoteService usa el
servicio de saldo (:128). En front `invoiceNotaOrigen.ts:62` y
`invoiceEmitDraft.ts:288` también exigen ACEPTADO. Unificar ACEPTADO/OBSERVADO en
ambas rutas y selectores, actualizar mensajes/documentación por la nueva decisión
de Jhordy; conservar saldo, motivos, identidad, locks, control RA y exclusión de
notas como origen. Pruebas NC/ND de observado, exceso/concurrencia de saldo y
negativos para todos los demás estados. Sin migración ni Contabilidad/Resiliencia.

**6I — Reenvío forzado con constancia.** La consulta obligatoria actual vive en
`resilience/.../invoiceRetryService.ts:101-128`; el punto M1 inmediatamente anterior
es `invoiceJobConsumer.ts:208`, DESPUÉS de preparar/validar el XML. No se modifica
Resiliencia ni se miente devolviendo NO_ENCONTRADO desde una consulta.

Propuesta: POST /invoices/:id/forzar-reenvio, AuthGuard + RolesGuard ADMIN,
CurrentCompany y usuario autenticado; body motivo no vacío acotado y
confirmado=true. Solo incertidumbre de transporte pendiente en documento no
finalizado, sin CDR definitivo. Rechazar ACEPTADO/OBSERVADO/ANULADO y rechazos
SUNAT definitivos; aislamiento por empresa. En transacción con lock de invoice,
registrar M1_FORCE_RESEND_AUTHORIZED en historial existente: usuario, motivo,
fecha del servidor y versión de la decisión en mensaje estructurado. Mantener
transport_uncertain=true hasta que el consumidor reclame la decisión. Reutilizar
reenqueueInvoiceIfIdle/rescate DLQ existente; sin trabajos duplicados y sin tocar
retry-cdr. Si falla publicar, la constancia queda durable y se puede recuperar.

Tras preparación y compuerta exitosas, M1 reclama UNA autorización pendiente
bajo lock y registra consumo vinculado a su ID. Solo entonces establece false
para esa entrada al motor existente: omite la consulta previa y autoriza UN
nuevo intento. El motor vuelve a persistir true antes del transporte; la nueva
traza durable de inicio sigue obligatoria. Si ese intento queda incierto,
conciliación automática normal de Parte 5b; no reutiliza la autorización para
saltarse otra consulta. Caída tras consumir: conservación prudente, nunca permiso
infinito. Un job ya activo no se duplica y una constancia ya consumida no se usa
otra vez. Presentación: «Reenvío forzado por decisión registrada», quién/cuándo/
motivo, sin afirmar aceptación. Motivo no sustituye la compuerta SFS ni firma.

Pruebas: ADMIN/motivo/confirmación, tenant, finalizados, decisión durable antes de
publicar, concurrencia/publicación fallida, consumo único, caída/reentrega,
primera llamada sin consulta, timeout posterior vuelve a conciliar, puente solo
tras aceptación y comportamiento automático 5b intacto. Sin migración: historial
ya tiene mensaje e ID/fecha (`prisma/schema/resilience.prisma:3`); no cambia su
modelo. Sin cambios de código en Resiliencia; si la implementación revelara que
no se puede garantizar consumo único con esas interfaces, se detendrá.

#### 6J — Definición normativa SPOT y mínimo propuesto

Base: TUO del DL 940 (DS 155-2004-EF) y
[RS 183-2004/SUNAT](https://www.sunat.gob.pe/legislacion/superin/2004/183.htm)
con modificatorias. No tratar el HTML histórico de esa resolución ni un catálogo
SFS antiguo como consolidado completo. Contraste con orientación SUNAT vigente,
[RS 343-2014](https://www.sunat.gob.pe/legislacion/superin/2014/343-2014.pdf),
[RS 071-2018](https://www.sunat.gob.pe/legislacion/superin/2018/071-2018.pdf),
[RS 086-2025](https://emprender.sunat.gob.pe/sites/default/files/inline-files/RS%2086-2025.pdf)
y modificaciones 121/175-2025 relativas a traslados de minerales.

SPOT no es otro impuesto añadido al precio: el obligado deposita una parte del
importe en cuenta de detracciones del proveedor en el Banco de la Nación; el
saldo se paga al proveedor. El importe de la operación incluye IGV y cargos
aplicables, después de descuentos reales; no se limita a la base sin IGV.
En operaciones ordinarias el adquirente/usuario deposita; el proveedor tiene
supuestos propios cuando recibe todo sin acreditación del depósito. Los plazos
ordinarios consideran pago/anotación en Compras y quinto día hábil según sujeto;
Anexo 1 tiene reglas previas al traslado. Emitir XML no acredita un depósito.

Familias y tasas (la subpartida y definición legal, no el nombre comercial,
determinan la inclusión):

- Anexo 1: azúcar/melaza, alcohol etílico, minerales de oro/concentrados y minerales
  metálicos no auríferos, 10%. Minerales reubicados en 2025; existen exclusiones
  específicas de traslado. No aplicar automáticamente el corte de S/700 a este
  anexo (regla propia de importe superior a media UIT y demás supuestos legales).
- Anexo 2: arena/piedra y caña 10%; residuos y plomo 15%; carnes, maíz, madera,
  harina/pellets de pescado y leche 4%; aceite de pescado, renuncia a exoneración,
  páprika y minerales no metálicos 10%; bienes exonerados y oro/metales exonerados
  1,5%; oro gravado 10% en las subpartidas que permanecen en Anexo 2. Recursos
  hidrobiológicos tienen condiciones/padrón propios. La clasificación no se
  deduce de un SKU ni se extiende a todo producto de ferretería.
- Anexo 3: intermediación, mantenimiento/reparación, otros servicios empresariales
  y demás servicios gravados 12% por RS 071-2018; arrendamiento, movimiento de
  carga, comisión, fabricación por encargo y transporte de personas del anexo
  10%; construcción 4%; beneficio de minerales metálicos 12% desde 2025.

Fuentes de las familias y sus exclusiones:
[venta de bienes SUNAT](https://orientacion.sunat.gob.pe/3141-02-en-la-venta-de-bienes-empresas),
[servicios SUNAT](https://orientacion.sunat.gob.pe/3142-03-en-la-prestacion-de-servicios-empresas)
y las modificatorias anteriores. No se implementan todos esos regímenes en el
mínimo. Para Arena/piedra (Anexo 2 numeral 5, Catálogo 54 código **009**), tasa
**10%**, operación **mayor** a S/700: 700.00 no, 700.01 sí. Hay excepciones de
umbral para otros bienes del Anexo 2 y excepciones por clase de comprobante,
usuario público y documentos autorizados. Servicios ordinarios del Anexo 3
usan >700; transporte terrestre de carga tiene régimen separado (RS 073-2006,
umbral 400 y valor referencial), no se mete en la regla universal de 700.
Boleta ordinaria sin derecho a crédito/costo no se asimila a factura afecta;
no afirmar que todo documento tipo 03 es jurídicamente imposible bajo cualquier
supuesto. El mínimo propuesto soporta solo factura 01.

Cuenta BN: existe `Company.detraction_account` (`auth.prisma:39`), ya la lee
`emitirComprobanteService.ts:497`. Exponerla en configuración M1 mediante su
writer/reader, sin nueva columna. Sin cuenta real o clasificación/medio exigidos:
bloqueo antes de numerar. Los depósitos pueden redondearse a entero conforme a
la quinta disposición final incorporada por RS 178-2005; no es verdad que todo
importe XML deba ser entero (la regla 3208 controla moneda PEN). Mantener cálculo
exacto a céntimos y distinguir cualquier redondeo del depósito de la liquidación.
[Explicación oficial de importe y redondeo](https://orientacion.sunat.gob.pe/preguntas-frecuentes-detracciones).

UBL 2.1, conforme al
[Anexo VII oficial RS 114-2019](https://www.sunat.gob.pe/legislacion/superin/2019/anexoVII-114-2019.pdf),
no al ejemplo viejo de la guía 2017 cuando difieren:
InvoiceTypeCode listID 1001 para detracción ordinaria; Note con languageLocaleID
2006 y leyenda SPOT, conservando monto en letras en su leyenda propia. PaymentMeans
identificado Detraccion, PaymentMeansCode del catálogo 59 y PayeeFinancialAccount/ID
con cuenta BN. PaymentTerms con ID Detraccion, PaymentMeansID código Catálogo 54
(con atributos de catálogo), PaymentPercent tasa porcentual y Amount en PEN.
No confundir ID Detraccion con el código de bien/servicio. Total fiscal UBL
permanece bruto con IGV; el neto al proveedor se presenta aparte.

Catálogo 59: `cat_59.xml:4` = 001 depósito en cuenta; :6 = 003 transferencia;
:25 = 999 otros medios. **999 es un código válido, no un código inválido**, pero
su fallback silencioso no demuestra un medio real. No sustituirlo universalmente
por 001: selector explícito/validado; 001 solo cuando se declara depósito en
cuenta, 003 cuando corresponde transferencia; ausencia de selección bloquea.
Otros medios requieren alcance/evidencia explícitos, no un valor quemado.

Deuda exacta hoy: `sunatCatalogs.ts:177` no incluye 009; `xmlNodesHelper.ts:351`
usa 999 por defecto; `ublTaxBlocks.ts:172` omite PaymentPercent/atributos;
`ublGeneratorService.ts:157` pone montoEnLetras dentro de la leyenda 2006;
`emitirComprobanteAdapter.ts:286` aplica tasa de la primera línea a la base
sujeta, y `paymentTermsAndSpotValidator.ts:225` trata 700 como universal. Además
`assets/.../cat_54.xml` tiene tasas históricas (p.ej. 10% en servicios luego 12%):
no editar assets oficiales para forzar un verde ni usarlos como única norma.

**Mínimo recomendado sin migración:** factura PEN ordinaria, código 009 Arena y
piedra, 10%, clasificación explícita del usuario respaldada por la definición
arancelaria, cuenta real BN configurada, medio explícito, cálculo sobre importe
de la operación, leyenda y bloques completos. Una factura solo incluye operaciones
SPOT compatibles (art.19.1): no mezclar no sujetas ni códigos/tasas distintos;
separar documentos. Congelar clasificación/tasa/importe/cuenta/medio en payload_ubl,
que ya persiste esos datos fiscales; no modificar históricos. Formularios y ambas
rutas comunes validan antes de numerar. Productos nunca se clasifican como SPOT
solo por llamarse Arena.

Fuera del mínimo: depósitos reales/constancias bancarias y plazos automatizados,
moneda extranjera/valores referenciales, regímenes de transporte/hidrobiológicos/
minería, combinaciones de códigos/tasas, casos especiales de boleta/sector público,
ventas mixtas y automatización de ajustes SPOT de NC/ND. Deben bloquear con causa
cuando no estén soportados, nunca omitir una detracción exigible silenciosamente.

**DETENIDO el subalcance de flag/tasa persistidos POR PRODUCTO:** InventoryProduct
no tiene campos SPOT; attributes es un array de atributos de variación según el
DTO de Inventario, no un contrato tributario. No se lo reutiliza clandestinamente.
Agregar campos/tabla de tarifas exigiría migración y coordinación con Inventario;
no se genera ni aplica nada. La alternativa mínima anterior usa clasificación
por operación/línea y payload ya existente, dentro de M1 y sin migración.

Pruebas mínimas 6J: 699.99/700/700.01, tasa/base/centavos, BN/medio ausentes,
mezclas rechazadas, coherencia de ambas rutas/persistencia/UI/PDF, XML firmado
por generador con certificado ficticio → XSD y XSL SFS reales, snapshots SPOT
actualizados solo por cambios normativos aprobados y demás XML byte a byte
intactos. Sin llamadas transaccionales SUNAT.

Decisiones pendientes para construir: aprobación por punto/bloque; exportación
real 6B; excepción del formulario compartido 6G o alternativa acordada; elección
expresa del mínimo 6J sin migración frente a automatización por producto detenida.

#### Construcción aprobada — 6D

MTQ incorporado a los mapas M1 de back/front; dato de Inventario intacto. Prueba de generador firmado con certificado ficticio y SFS oficial. La Fase 0 anterior fue aprobada en bloque; límites 6G/6J resueltos en el hilo del 10 nov.

#### Construcción — 6E

Sugerencia de producto muestra precioUnitario final (no valorUnitario neto), con dos decimales y etiqueta explícita. Prueba 118 final / 100 neto, selección sin edición. Contrato sale_price intacto.

#### Construcción — 6H

Decisión de Jhordy del 10 nov: OBSERVADO sí es origen de NC/ND. Guardas de saldo y transaccional común unificadas con ACEPTADO; selectores/vinculación front actualizados. Se conservan locks, saldo, baja pendiente, identidad y límites de motivos; negativos de otros estados siguen protegidos. Sin migración.

#### Cierre 6B — exportación real recibida de Emma (10 nov)

Fuente: Supabase en solo lectura por Emma; 18 filas de business_partners de la
empresa demo. Contraste del seed anterior confirmado con una fila adicional
TAX_ID 91440300MA5 Shenzhen Tech Electronics del seed de Aduanas. Distribución:
10 filas de semilla (7 proveedores, 3 clientes), 3 clientes reales del 7 nov,
Empresa Demo doc 204813697 (9 dígitos, cinco roles, creada el 9 nov 16:43), y
4 proveedores exteriores de prueba de Aduanas (9 nov 21:37): Shenzhen Tech Global
CN91440300MA5XYZ12, Silicon Valley Components US942857193, Hamburg Logistics
DE301948275 y Taipei Semiconductor TW53892014. No se infiere que los dos registros
CN91440300MA5XYZ12 tengan el mismo tipo documental ni que se deban deduplicar.

Los 27 comprobantes referencian identidades en payload_ubl.cliente.numeroDocumento:
12345678, 20100070970, 20131312955, 20481234566 y 45896325. La consulta ilustrativa
anterior basada solo en columnas planas NO basta para los históricos: el cruce
real usa también el snapshot cliente del payload, como verificó Emma.

Referenciados del maestro (PROTEGER): José Pérez 12345678 (semilla pero usado),
Ferretería Los Andes 20100070970, Distribuidora Callao 20131312955 y Supermercados
Peruanos 20481234566. Receptor histórico 45896325 Juan Perez Gonzales NO está en
el maestro; no se crea ni reescribe nada. Clientes de seed no referenciados por
M1: Constructora Los Andes 20500000001 e Inmobiliaria Miraflores 20500000002.
Empresa Demo no aparece entre los receptores; al tener cinco roles no se presume
segura la eliminación de toda su fila: requiere decisión del equipo por sus
otros usos. Ningún proveedor está referenciado por M1, pero Compras/Aduanas
son sus dueños y no los toca Emma en esta limpieza. La limpieza autorizada de
Emma se limita al lado cliente de ejemplos no referenciados; no la ejecuta Codex.

6B queda diagnosticado con la exportación real: sin cambios de datos ni código.

#### Construcción — 6A

Placeholder fiscal obsoleto eliminado. Campo monetario compartido presenta dos decimales sin mutar precisión histórica por foco/blur. Catálogo histórico M1 incluye inactivos sin volverlos vendibles; emisión mantiene filtro de sale_price. Ambas pantallas usan el mismo endpoint por almacén; carga fallida ya no simula una lista vacía exitosa. Avisos distinguen carga/error/histórico de inexistencia; notas no se reprecifican ni se validan como descarga de venta nueva. Sin migración ni cambios de Inventario.

#### Construcción — 6C

La grilla compartida por página y modal pide Fusionar/Mantener separada/Cancelar al seleccionar o confirmar un SKU repetido. Fusión exige misma unidad, precio y condiciones fiscales/comerciales; cantidades se suman y sigue activa la validación de stock agregado. Condiciones diferentes deshabilitan fusión. Notas históricas excluidas de fusión automática. Pruebas de decisión explícita y SKU manual.

#### Construcción — 6F

POST /invoices/series exige ADMIN también en back; front muestra creación/reactivación solo para ADMIN. Tipos 01/03/07/08, serie y último correlativo usado (0 → siguiente 1), refresco de configuración, sin reiniciar numeración al reactivar. Endpoints y servicio de reserva existentes; sin migración. Pruebas de RolesGuard real y formulario con transporte simulado.

#### Construcción — 6G y excepción autorizada del 10 nov

Excepción puntual autorizada por Emma/Jhordy el 10 nov para aviso al equipo: `front/src/modules/customs/components/PartnerFormDialog.tsx` SOLO presentación. Se conservan exactamente campos, reglas (documento/nombre no vacíos y roles) y mutationFn/envío/botón deshabilitado; se añaden marcadores, aria-required/invalid/describedby, mensajes asociados y foco al primer inválido. Ningún otro archivo ajeno a M1 se modifica.

M1 asocia errores de cliente y campos fiscales, ofrece navegación de productos/clientes por flechas/Enter y mantiene escritura sin selección como escritura, no selección implícita. Ayuda visible de atajos Alt+C/P/L y Ctrl+Enter para revisión explícita (no envío directo); Escape no descarta el borrador. Manejadores ligados al formulario/dialog activo, ignoran IME y emisión en curso. Pruebas de presentación/foco, bloqueo del alta intacto, selección teclado, revisión sin envío y regresiones de selección de cliente.

#### Construcción — 6I

Nuevo POST /invoices/:id/forzar-reenvio ADMIN, motivo escrito y confirmado=true. Usuario se toma de sub del token, no del body. Bloquea empresa ajena, estados finales y CDR existente. Constancia inmutable en historial, marcador true antes de publicar, singleton de cola existente y reutilización de autorización pendiente (no se sobrescribe por un segundo clic). Publicación fallida conserva la constancia.

El consumidor M1 consume la autorización bajo lock DESPUÉS de preparación/SFS y justo antes de InvoiceRetryService. Consumo vinculado al ID, una sola vez; marcador false solo para la entrada autorizada, luego el motor existente vuelve a true antes de abrir transporte. Timeout posterior retoma conciliación normal 5b y no reutiliza la constancia. Si ya hay un trabajo activo, la respuesta informa que no confirma envío/aceptación y la constancia queda pendiente recuperable. Historial presenta usuario/motivo y fecha real. No cambia retry-cdr, estados admitidos, colas ni ningún archivo de Resiliencia. Sin migración.

#### Construcción — 6J, mínimo SPOT aprobado sin migración

Factura PEN de arena/piedra, Catálogo 54 código 009, 10%, solo si el importe final
es estrictamente mayor a S/700. Clasificación explícita en cada línea; no se
infiere por nombre ni SKU. Ambas entradas comunes rechazan mezcla de líneas sin
clasificar, otros códigos/regímenes, documentos distintos de factura y líneas
no gravadas. Por debajo del umbral no hay detracción efectiva ni cuenta exigida.
Las tablas de códigos anteriores se conservan para lectura/regeneración histórica;
no son una oferta de regímenes nuevos en el formulario.

Cuenta propia exclusivamente de Company.detraction_account, editable en
Configuración M1 (campo existente de 11 dígitos); ausencia o discrepancia bloquea
antes de reservar número. Nuevas altas efectivas exigen 001 depósito o 003
transferencia: no se acepta 999 ni se sustituye una selección ausente. El
adaptador congela código, tasa, importe, cuenta y medio en payload_ubl. La
lectura en InvoiceConfigService consulta únicamente la cuenta existente y por
empresa. IssuerConfigResolver, credenciales, respaldo y firma quedan intactos.

UBL incluye PaymentPercent y Amount en PaymentTerms de detracción, cuenta en
PayeeFinancialAccount y leyenda 2006 «Operación sujeta al Sistema de Pago de
Obligaciones Tributarias con el Gobierno Central», no monto en letras (estos se conservan en su leyenda 1000). El total
fiscal sigue siendo bruto; neto pendiente descuenta la detracción. Dos snapshots
SPOT cambian intencionalmente por porcentaje/leyenda; los snapshots no SPOT
permanecen idénticos. Las pruebas generan XML, lo firman con certificado ficticio
y pasan XSD/XSL SFS real para 009 con ambos medios 001/003.

Deuda expresa DIFERIDA: clasificación/tasa persistida POR PRODUCTO requiere
migración y coordinación con Inventario; no se usa attributes ni otra tabla
paralela. Fuera de este mínimo: otros bienes/servicios, divisas, transporte
especial, ventas mixtas, depósitos/constancias bancarias y ajustes automáticos
SPOT de notas. No se realizaron depósitos, emisiones ni llamadas reales SUNAT.

#### Verificación final de Parte 6 (10 nov)

Bases congeladas de Fase 0: back dev b20706f73ca2e0481cac3379cd1b5dc879c080c9;
front dev a38c8729bf92e74ac5a6ae099872ae21938885c3. Una revisión por punto;
fixups locales consolidados antes de publicar.

| Verificación | Base | Final |
|---|---:|---:|
| Back, suites aprobadas | 271 | 274 |
| Back, pruebas aprobadas | 2501 | 2532 |
| Back, omitidas | 4 suites /38 pruebas | 4 suites /38 pruebas |
| Back, snapshots | 12 | 12 |
| Front, archivos de prueba aprobados | 105 | 112 |
| Front, pruebas aprobadas | 829 | 848 |

Cero fallos finales. Back: test:cov --runInBand, integraciones obligatorias en
PostgreSQL 16 local desechable; únicamente migraciones YA existentes, ninguna
nueva, ninguna conexión ni aplicación en bases compartidas. Base local eliminada
tras la corrida. Build y lint back OK, sin avisos. Front: suite completa y build
OK. ESLint del front conserva exactamente los 2 errores set-state-in-effect y
5 avisos anteriores en dev en los archivos revisados; comprobados sobre las
fuentes base por stdin, sin cambios de reglas/configuración ni silenciamientos.
No se presenta ese lint previo como verde.

Cobertura local de código nuevo back respecto de b20706f, intersección diff/LCOV:
90/92 líneas (97.83%); 105/117 condiciones; combinada 195/209 = 93.30%. Es la
medición local reproducible con scripts/m1/coverage_new_code.py, no un resultado
remoto de Sonar. XML firmado con certificado ficticio → SFS real, errores []:
Arena MTQ y SPOT 009 para 001/003. Snapshots no SPOT intactos; exactamente dos
snapshots SPOT actualizados por PaymentPercent/leyenda normativa.

| Punto | Resultado | Commit back | Commit front local |
|---|---|---|---|
| 6A | Construido, notas/precio/catálogo | 70c92f3 | 935b50d |
| 6B | Diagnóstico real completo; limpieza solo Emma | 99e9b6e | — |
| 6C | Decisión explícita/fusión compatible | 384433f | 6687654 |
| 6D | MTQ, mapa M1 y SFS oficial | eef7633 | cbc3828 |
| 6E | Sugerencia al precio final | 9ff24fe | ae83349 |
| 6F | Gestión de series ADMIN | 8b8f8c4 | 9ab0d63 |
| 6G | Validación, selección y atajos; excepción documentada | 58df551 | 6dbab5b |
| 6H | OBSERVADO con saldo y guardas intactos | 2c942ec | 67c5f5b |
| 6I | Decisión ADMIN durable, un uso, sin tocar Resiliencia | 5a21da5 | a02aab2 |
| 6J | Mínimo SPOT aprobado; flag por producto diferido | Este commit | 4cd1e97 |

Entrega front exclusivamente mediante ferry/m1-cierre-recorrido: 44 rutas,
manifiesto SHA256 y conteos en FERRY.md; no se empuja al remoto front.
No hay cambios de Resiliencia, Contabilidad, Inventario, esquema o migraciones.
La única excepción de código fuera de M1 es la presentación de PartnerFormDialog
aprobada expresamente; resolver compartido SUNAT intacto. Documentos históricos
y datos maestros no se reescriben. Perfil MAYORISTA, limpieza y carga de cuenta BN
son datos del equipo. No PR, fusión, despliegue, emisión ni llamada real SUNAT.

### Parte 6b — Fase 0, pulido de presentación (10 nov 2026)

Rama back fix/m1-pulido-6b creada desde dev
fecbe44ab6b5d6d969dd3a7ff1acf0a9123959a2. Front de Carlos, clon local en
/workspace/work/front, dev 95cf0586080422ef532be18449f8d43033734007 y rama
local fix/m1-pulido-6b. Entrega futura SOLO por ferry/m1-pulido-6b en el remoto
back. Aún sin construcción, commits o push: se espera confirmación de bloque.

Línea base front: 112 archivos /849 pruebas aprobadas, cero fallos. Línea base
back: 276 suites /2544 pruebas aprobadas, 4 suites /38 pruebas omitidas;
12 snapshots aprobados, cero fallos (280 suites /2582 pruebas totales).
Corridas completas secuenciales para evitar interferir en el
presupuesto temporal TA-13. Back usa únicamente PostgreSQL 16 local desechable,
con migraciones existentes, conforme a la excepción local ya autorizada. No se
conecta ninguna base compartida ni se genera una migración.

#### 6b-1 — Detracción/retención persistida en la bandeja (back + front)

Causa: InvoiceQueryService ya selecciona payload_ubl (invoiceQueryService.ts:56),
pero aListado solo publica condiciones de pago (invoiceQueryMapper.ts:121),
no montoDetraccion/montoRetencion; faltan esos campos en el DTO
(invoiceQueryDto.ts:34). Además el adaptador front fija detraccion y retencion a
0, con comentario obsoleto de no persistencia (invoiceApiMapper.ts:178-180).
InvoiceTableRow.tsx:102-117 muestra «—» al recibir ambos ceros.

Plan: proyectar ambos importes guardados del payload en listado/detalle, sin
recalcular tasas, umbral ni totales; transportarlos por invoiceMapper/modelo y
invoiceApiMapper. Ausente/inválido queda como no registrado, no se inventa tasa
ni se reconstruye desde el catálogo. No modificar el importe total del documento.
Pruebas: proyección de 009/S73.02 literal, retención literal, combinación,
ausencia/invalidación defensiva y fila visible sin alterar totales. Archivos:
back invoiceQueryDto.ts/invoiceQueryMapper.ts; front invoice.types.ts,
invoiceMapper.ts/invoiceApiMapper.ts (y contrato crudo si corresponde), pruebas
de mapper y tabla. La celda ya sabe dibujar ambos importes.

#### 6b-2 — Pago directo según depósito BN (front)

Causa: InvoiceEmissionPage.tsx:220-222 pasa detraccion.monto exacto a repartirPago;
InvoiceEmissionPage.tsx:803 muestra un depósito distinto, redondeado mediante
roundDetraccion (invoiceRetentions.ts:34-35), y :825 muestra el pago directo
calculado con el importe exacto. InvoiceEmitResumen.tsx:53/91 también diferencia
neto exacto y depósito redondeado. El redondeo del depósito vive en el FRONT, no
hay que cambiarlo en el motor fiscal back.

Límite importante: reparto.pagoDirecto también alimenta el cronograma fiscal
(InvoiceEmissionPage.tsx:231-233). El back exige neto exacto en
paymentTermsAndSpotValidator.ts:94/167-174 y mantiene importePagar exacto en
emitirComprobanteAdapter.ts:321. NO cambiar repartirPago, calcularFlujo, cuotas,
payload o XML. Separar un cálculo exclusivamente visual del pago directo:
total − depósito BN redondeado − retención. Con S730.17 y S73.02: depósito S73.00,
pago directo S657.17. El neto fiscal S657.15 se conserva, rotulado como tal cuando
se muestra el cronograma. No se afirma que un depósito bancario ya se ejecutó.
Archivos: componente de resumen, página y helper nuevo de presentación M1.
Pruebas: suma depósito+pago directo(+retención)=total, ambos sentidos de redondeo,
sin SPOT y regresión de cuotas/payload/XML fiscal idénticos.

#### 6b-3 — Actualización comprobable de lista y contadores (front)

El cableado del clic SÍ existe: InvoiceFiltersBar.tsx:125 →
InvoiceList.tsx:195-197 → refetch de ['invoices',1] (:123). Los contadores locales
se derivan de esa lista (:142/150-157). invoicesApi.ts:121-124 intenta GET real;
no hay evidencia en este camino de que un éxito de red omita la petición.

Brechas comprobadas: no invalida las otras consultas de métricas M1
(InvoiceSettingsPage.tsx:36 e InvoicesDashboardPage.tsx:14), descarta el resultado
y error del refresco; y el wrapper común cachedGet devuelve la copia anterior
si falla la red (offlineCache.ts:67-70), sin señalarlo a la bandeja. Esto permite
que «Actualizar» parezca exitoso sin cambiar datos. No se atribuye sin pruebas
ese fallo de red concreto al incidente de producción.

Plan: refresco explícito desde M1 que fuerce lectura de red, invalide lista y
métricas pertinentes y muestre cargando/éxito/error; no presentar fallback viejo
como actualización nueva. Reutilizar mecanismos existentes, sin modificar
src/lib/offlineCache.ts ni otros módulos. Prueba con respuesta anterior/nueva:
clic → GET nuevo → fila y contadores nuevos; error con caché → aviso honesto;
evitar doble petición/publicación y comprobar invalidaciones de métricas. Si el
caso online ya funciona, conservarlo con regresión y acotar el cambio al defecto
de coherencia/fallo silencioso identificado.

#### 6b-4 — Próximo correlativo informativo (front)

El dato YA existe: invoiceSeriesService.ts:194-203 expone current_correlative;
aSerieFe en useInvoiceConfig.ts:101-110 ya lo interpreta como último usado +1.
Pero la página solo dibuja las opciones de serie
(InvoiceEmissionPage.tsx:544-548), y el modal reduce la configuración a tipo,
serie e is_active (InvoiceEmitModal.tsx:82) y usa una estimación desde el listado
(:241; invoiceEmitDraft.ts:150-161, base artificial 100). No debe usarse ese
estimador para afirmar numeración real.

Plan: mostrar junto a la serie seleccionada el current_correlative+1 de esa
configuración, para ambos formularios; mantener ese dato al pasar props al
modal y refrescar su lectura. Sin dato: indicar no disponible, nunca usar 100 ni
inferir de la página visible. Avisar que es informativo y el número definitivo
se asigna al emitir. No tocar reservarCorrelativo, que incrementa de forma atómica
(invoiceSeriesService.ts:98-105). Pruebas 66→67, 0→1, cambio de serie/tipo,
dato ausente y ninguna reserva/alta al abrir/cambiar el formulario.

#### 6b-5 — CDR y contador con origen honesto (front)

La regla 5B YA existe: backend presentarResultado en invoiceResultPresentation.ts:23-42;
front lecturaRechazo en lib/invoiceResultPresentation.ts:7-23. La ficha la usa,
pero el bloque inferior conserva el encabezado incondicional «Respuesta oficial
CDR SUNAT (billService)» (InvoiceCdrModal.tsx:273-281), incluso al pintar un motivo
local. No se encuentra allí un literal independiente «Rechazado por SUNAT» fuera
del helper que corresponde al origen SUNAT: el defecto comprobado es la
atribución incondicional del bloque, aunque la etiqueta superior ya distinga.

El contador sí es inequívoco: invoiceMetrics.ts:78-80 suma todo RECHAZADO y
InvoiceKpiCards.tsx:112 lo rotula «Rechazos SUNAT». El dashboard de métricas remoto
usa la etiqueta neutral «Rechazados» (InvoicesDashboardPage.tsx:30); no se cambia
la semántica fiscal ni el agregado de estados del servidor para resolver una
etiqueta de presentación.

Plan: reutilizar resultadoPresentacion para encuadrar el bloque como bloqueo
local, rechazo real SUNAT o rechazo de origen no confirmado; mostrar causa real
y ausencia de CDR, conservando cualquier CDR auténtico sin editar sus bytes.
Separar contadores visuales SUNAT/local/no confirmado, manteniendo el total y
los estados internos. Archivos: InvoiceCdrModal.tsx, invoiceMetrics.ts,
InvoiceKpiCards.tsx y sus pruebas. Casos B001-5/FD01-1 simulados con evidencia de
bloqueo local, rechazo con CDR/SOAP y origen insuficiente; el motivo local nunca
se atribuye a SUNAT por el mero estado RECHAZADO.

#### Puerta y alcance

NINGÚN punto requiere migración: se leen payload_ubl, historial/resultado y
current_correlative ya existentes. 6b-1 requiere back/front; 6b-2/3/4/5 son front.
Nada de Resiliencia, Contabilidad, Inventario ni caché común. Tras aprobación:
un commit por punto con pruebas y conteos; suites completas, snapshots fiscales
intactos, ferry con FERRY.md y push de ambas ramas. Sin PR, merge, despliegue,
emisión ni llamada real SUNAT. Esta sección es solo el diagnóstico/diseño previo.

#### Construcción aprobada — 6b-1

Proyección literal de montoDetraccion/montoRetencion del payload persistido en
listado y detalle; inválido/ausente conserva null en contrato. Normalizadores
transportan los importes hasta la celda sin tasas ni reglas nuevas. Total fiscal
intacto. Pruebas focales: back 1 suite/8 tests, front 1 archivo/1 test.

#### Construcción — 6b-2

Helper exclusivamente visual de depósito/pago directo; página y resumen lo usan.
Reparto fiscal, neto de cuotas, payload y XML intactos. Depósito indicado es un
cálculo de presentación, no constancia bancaria. Focales: front 2 archivos/10
pruebas aprobadas, incluida regresión del neto fiscal S657.15 y pago S657.17.

#### Construcción — 6b-3

Clic explícito usa GET de red sin fallback, cancela/invalida listado, publica
respuesta nueva y marca obsoletas métricas M1. Cargando/resultado visibles;
fallo conserva la lista con aviso honesto. Lecturas normales conservan caché
offline; archivo común intacto. Focales: front 2 archivos/3 pruebas aprobadas,
incluidos clic repetido, invalidaciones y lectura estricta que propaga fallo.

#### Construcción — 6b-4

Número visible proviene de configuración en ambos formularios; sin dato muestra
«no disponible». Retirada toda llamada al estimador desde el modal; correlativo
interno no enviado queda 0, nunca se presenta como reserva. Lectura de configuración
se refresca al abrir desde bandeja. Focal: front 1 archivo/3 pruebas aprobadas
(66→67, 0→1, sin dato y cableado de ambas pantallas), sin escritura de numeración.

#### Construcción — 6b-5

Bloque de respuesta reutiliza la clasificación 5B: local y no confirmado dejan
de presentarse como respuesta oficial SUNAT. Contador desglosa los tres orígenes
sin alterar rechazados totales, estados ni documentos CDR. Agregado remoto con
etiqueta neutral intacto. Focales: front 2 archivos/9 pruebas aprobadas, incluidos
los casos locales de la ronda 5B y rechazo SUNAT confirmado.

#### Cierre de Parte 6b — verificación y entrega

Construcción completa tras la confirmación de bloque de Emma/Jhordy. Bases:
back fecbe44ab6b5d6d969dd3a7ff1acf0a9123959a2; front Carlos
95cf0586080422ef532be18449f8d43033734007. Cinco commits separados por punto
(también en el ferry); los puntos exclusivamente front llevan constancia en back.

| Suite completa | Base aprobada | Final |
|---|---:|---:|
| Back, suites aprobadas | 276 | 277 |
| Back, pruebas aprobadas | 2544 | 2552 |
| Back, omitidas | 4 suites /38 pruebas | 4 suites /38 pruebas |
| Snapshots fiscales | 12 | 12, intactos |
| Front, archivos aprobados | 112 | 118 |
| Front, pruebas aprobadas | 849 | 866 |

Cero fallos finales. Back ejecutado con cobertura e integraciones obligatorias
en PostgreSQL 16 local desechable; sin SUNAT real. Builds back/front OK y lint
back limpio. ESLint del front conserva 2 errores y 5 avisos de la base; se
contrastaron las mismas fuentes base por stdin. No se relajan reglas ni se
presenta ese lint previo como verde. La base local de pruebas se elimina al cerrar.
Ninguna migración nueva, ningún cambio en esquema ni aplicación en base compartida.

Regresión adicional 6b-2: el resumen real muestra depósito BN S73.00 y pago directo
S657.17, manteniendo neto fiscal/cuota S657.15. Los cinco casos de aritmética y
payload más esa prueba de UI pasan (6 pruebas nuevas de ese punto). El XML,
las reglas tributarias, cuotas y estados fiscales no tienen cambios. El contador
antiguo que atribuía un rechazo sin evidencia a SUNAT ahora espera origen no
confirmado, en coherencia con la 5B.

| Punto | Commit back | Commit front de origen | Evidencia focal |
|---|---|---|---|
| 6b-1 | 3561414 | 276acb4 | Back 1 suite/8 tests; front 1 archivo/1 test |
| 6b-2 | 27bfd30 | 61b72bf | 6 pruebas nuevas, incluida UI y neto fiscal intacto |
| 6b-3 | f3c3572 | c145168 | 2 archivos/3 tests: red estricta, error visible e invalidación |
| 6b-4 | 79c2929 | 78db515 | 1 archivo/3 tests: configuración, ambos formularios y ausencia |
| 6b-5 | Este commit | 43fa338 | 2 archivos/9 tests: local/SUNAT/no confirmado |

Entrega front exclusiva por ferry/m1-pulido-6b en el remoto back, con cinco commits
y FERRY.md completo (23 rutas exactas, hashes SHA256, bases y resultados).
No se empuja al remoto front. Solo M1 y esta documentación: caché común,
Resiliencia, Contabilidad e Inventario intactos. Sin emisiones reales, llamadas
reales SUNAT, PR, fusiones o despliegues.

### Parte 6c — Fase 0, cierre pre-revisión del docente (10 nov 2026, Lima)

Rama nueva fix/m1-cierre-6c creada desde dev back
bdb50766a3354980e399459811b0d4d067744526. Clon front de Carlos en
/workspace/work/front: dev 8c3c6880eb5c744ed88af1df9c4f1884c4740b1f,
rama local fix/m1-cierre-6c. Entrega futura del front solo por ferry/m1-cierre-6c
en el remoto back. No construcción, commits ni push: espera confirmación de bloque.

| Línea base completa | Aprobadas | Omitidas | Fallos |
|---|---|---|---:|
| Back | 278 suites /2555 pruebas; 12 snapshots | 4 suites /38 pruebas | 0 |
| Front | 118 archivos /866 pruebas | 0 | 0 |

Back ejecutado con cobertura e integraciones obligatorias en PostgreSQL 16
local desechable, aplicando solo migraciones existentes conforme a la excepción
local autorizada. Ninguna conexión a bases compartidas; ninguna migración nueva.
Logs locales: /workspace/work/6c-back-base.log y 6c-front-base.log.

#### 6c-1 — Hora de actualización exitosa (front)

Causa: useInvoiceRefresh.ts:9/23 conserva resultado textual, no la hora del éxito;
InvoiceFiltersBar.tsx:127-130 solo presenta botón/estado en curso. El mensaje de
éxito en dev YA se escribe después de GET estricto e invalidaciones, no al montar.
Falta dato temporal demostrable y ubicación junto al botón, no rehacer la red.
Plan: guardar fecha únicamente en el camino exitoso del refresco explícito y
mostrar «Actualizado a las HH:MM:SS», hora America/Lima, junto a Actualizar.
Inicialmente no afirmar un éxito manual; durante carga/error conservar la última
hora buena. Pruebas con reloj controlado: inicial, pendiente, éxito, fallo y nuevo
éxito; fallo/doble clic no adelantan la hora. Archivos: hook, FiltersBar y cableado
InvoiceList. Caché común intacta.

#### 6c-2 — Etiquetas en español (front, solo M1)

Close procede del botón automático compartido (src/components/ui/dialog.tsx:51,
70-79), usado por InvoiceEmitModal.tsx:441. El componente común YA ofrece
showCloseButton=false y exporta DialogClose (index.ts:10), por lo que NO requiere
excepción ni modificación fuera de M1. Plan: cierre equivalente compuesto dentro
del modal M1 con etiqueta Cerrar. Mantener foco/cierre y comportamiento existente.
InvoiceIssuerConfigForm.tsx:69/76 contiene los textos MOCK (simulado); sustituir
solo etiqueta visible por SIMULADO (pruebas), conservando value='MOCK'. Pruebas
de nombre accesible del cierre y valor enviado/configurado, sin cambiar entorno.

#### 6c-3 — Panel legible y semántica del contador (front)

InvoicesDashboardPage.tsx:36 contiene el subtítulo COMPLETO, incluido «más ND»;
no falta ese literal en dev. El recorte reportado es de presentación; no se
atribuye a una supuesta cadena incompleta. PageHeader común usa distribución flex
(page.tsx:160-170); se comprobará ancho estrecho y se presentará el párrafo completo
en un bloque M1 con ajuste de línea, sin editar el componente común.

Matiz comprobado: la tarjeta :29 usa m.pendientes. InvoiceMetricsService declara
ESTADOS_PENDIENTES=['EN_COLA','ENVIADO','PENDIENTE','ERROR_RED'] (:70,133,139), NO
solo incertidumbre. Rotular únicamente «Incertidumbre de transporte» sería falso.
Propuesta: «Sin confirmación SUNAT (incluye cola)» y ayuda «Incluye comprobantes
en cola o enviados sin respuesta definitiva». Así En Cola Outbox es claramente
un subconjunto; no cambian fórmula, valor ni estados. Pruebas de texto completo,
ajuste responsive y rótulo sin alterar las cifras recibidas.

#### 6c-4 — Detalles coherentes de Configuración (back, presentación del DTO)

invoiceConfigService.ts:100-102 calcula correctamente configurado, pero siempre
adjunta la orden «Complete…». La entrada endpoints (:104-105) no tiene detalle.
Plan: detalle condicionado al MISMO resultado existente: si completo, describir
local anexo, ubigeo y domicilio cargados; si falta, mantener instrucción honesta.
Mostrar endpoints efectivos de emisión/consulta o texto de ausencia usando
publicEndpoint (:157-166), que elimina usuario, contraseña, query y fragmento.
No cambiar endpointCoherente, criterios fiscales, checklist booleano ni compuerta.
Pruebas true/false, URL efectiva sanitizada y ausencia; mismos estados/listo.

#### 6c-5 — Un filtro visual de incertidumbre (front)

InvoiceMonitorPage.tsx:53 incluye ERROR_RED en estados solicitados al back;
:255 añade INCERTIDUMBRE_TRANSPORTE y rotula AMBOS como el mismo texto. :74 compara
valores literalmente, por lo que borrar una etiqueta sin ajustar el filtro
ocultaría parte de las filas. Plan: una opción visual que incluya los dos valores
al filtrar. Mantener ESTADOS_EN_VUELO y consultas originales: no dejar de pedir
ERROR_RED ni cambiar estados. Pruebas de una única opción y ambas clases visibles.

#### 6c-6 — Acción de CDR solo con transporte acreditado (back lectura + front)

InvoiceTableRow.tsx:160-169 muestra la acción solo por RECHAZADO/EN_COLA/SIN_CONFIRMAR,
sin atender al origen local. resultado_presentacion distingue validación local,
pero no acredita por sí solo que TODOS los demás casos se transportaron.
SELECT_LISTADO (invoiceQueryService.ts:59-60) limita historial a 20 y el front
no recibe un indicador de transporte acreditado. No asumir envío por ERROR_RED,
marcador incierto ni consulta inconclusa.

Plan: proyección M1 de lectura de evidencia ya persistida (CDR, evento explícito
M1_TRANSPORT_STARTED o resultado de transporte/SOAP), sobre historial suficiente,
sin reescribirlo. Exponer el indicador al listado/detalle y usarlo solo para
presentar la acción, manteniendo la condición de estado vigente. Las reglas de
evidencia ya están en invoiceTransportEvidence.ts:11-29; no modificar su lógica
ni el flujo de conciliación. Si falta prueba, no afirmar transporte. Consulta
incierta/rescate manual no son prueba de envío. No tocar retry-cdr ni sus estados,
colas, validaciones o política de reintento.

Pruebas de escenarios FD01-1 (bloqueo local sin transporte → oculta) y FD01-2
(con transporte acreditado → conserva), además de historial antiguo >20 entradas,
evidencia insuficiente y consulta inconclusa sola. Son escenarios de regresión,
no se presentan fixtures inventadas como exportación literal de producción.
Archivos: proyección/query DTO/mapper M1 y adaptadores/tabla front; sin esquema.

#### 6c-7 — Detalle de selección RA (front)

EnviarBajaPanel.tsx:34 imprime solo serie/correlativo y estado. El payload YA
incluye tipoComprobante y total: invoiceSummaryService.ts:309-317, contrato front
LineaResumen en invoiceResumenes.ts:34-48; ETIQUETA_TIPO existe en :70-75.
Plan: mostrar tipo (código/nombre), número, total y estado de cada fila, sin
recalcular importe ni tocar selección/motivos/exclusiones. NO requiere back.
Pruebas de distintos tipos y totales tal como los devuelve la vista previa.

#### 6c-8 — Ayuda de origen de notas (front)

InvoiceEmitCampos.tsx:177 conserva «Factura o Boleta aceptada» mientras el selector
ya admite aceptada u observada. Cambiar únicamente la ayuda a «aceptada u observada».
Prueba de texto y regresión de origen OBSERVADO; ninguna guarda modificada.

#### 6c-9 — Primera carga, vacío y error diferenciados (front)

(a) InvoicesDashboardPage.tsx:25-31 usa ??0 antes de metricas.data y :42-43 afirma
«Sin rechazos» sin datos. Plan: Cargando/skeleton hasta respuesta; error real
visible, ceros solo cuando la API confirmó cero. Alertas y métricas tienen
consultas independientes y no deben fingir la respuesta de la otra.
(b) InvoiceAggregateMonitor.tsx:7/10 inicia rows=[] y ocupado=false; :24 pinta vacío
incondicionalmente, y el efecto difiere cargar a una microtarea (:13). Plan:
primer render en carga, vacío solo tras éxito con [] y error separado; mantener
filas previas al refrescar, con indicador de actualización.
(c) InvoiceEmissionPage.tsx:129-143 inicia series=[] sin estado de petición; :550/553
muestran ausencia como conclusión inicial. El modal recibe configuración sin la
señal cargando disponible en useInvoiceConfig.ts:151 (InvoiceList.tsx:99/340).
Plan: llevar estado de carga/error a ambos formularios y a InvoiceNextNumber;
mostrar «Cargando configuración…» hasta saber, «Sin serie activa» solo tras
respuesta vacía, y error si falló. No cambiar reserva, validación ni envío.
Pruebas con promesas diferidas para pendiente/éxito vacío/éxito con datos/error.

#### 6c-10 — Precio visible y numeración uniforme (front)

InvoicePricesPage.tsx:15-16 copia el precio recibido y :76 lo pone crudo en el
input. Plan: borrador de edición inicial de dos decimales (81.129997… → 81.13),
blank para ausente. No PATCH automático ni cambio en catálogo al cargar; Guardar
sigue siendo explícito y envía el valor visible con la validación existente
(:26-35), sin alterar condiciones, impuestos ni reglas de precio.

InvoiceTableRow.tsx:61 usa padStart(4); sus etiquetas accesibles (:49/136/145/154/164)
y InvoiceOutboxMonitor.tsx:90 usan correlativo sin relleno. EnviarBajaPanel.tsx:34
también. En cambio invoiceApiMapper.ts:173 y InvoiceCdrModal.tsx:125 ya usan 8.
Unificar formato visual en listados/monitor/notas/selección y rótulos accesibles
con 8 dígitos, sin cambiar serie/correlativo almacenados, IDs, rutas, numeración
fiscal o XML. Pruebas F001-00000066, FC01-00000013 y detalle consistente; precio
inicial dos decimales, ninguna escritura al montar y validaciones intactas.

#### Puerta y alcance

NINGÚN punto requiere migración ni código fuera de M1. Solo 6c-4 y la proyección
de lectura de 6c-6 requieren back; los restantes son front. 6c-7 ya tiene todos
los datos y no requiere ampliar el payload. Para Close se usa la interfaz común
existente sin tocarla. Históricos y datos del equipo intactos.

Tras confirmación: un commit por punto con pruebas/conteos; suite completa y
snapshots fiscales intactos; ferry por punto con FERRY.md. No emisiones reales,
SUNAT real, PR, merges, despliegue ni cambios en reglas fiscales/validaciones.
Esta Fase 0 solo añade documentación; no se ha construido ninguno de los puntos.

#### Construcción aprobada — 6c-1

Hora America/Lima solo en el éxito de red, visible junto a Actualizar. Fallo y
carga conservan la última hora buena. Focales front: 2 archivos/3 pruebas verdes.
La Fase 0 fue aprobada en bloque; no cambian reglas, estados ni XML.

#### Construcción — 6c-2

Cierre Cerrar compuesto desde M1 con API compartida existente, sin editar UI común.
SIMULADO (pruebas) solo cambia texto; MOCK sigue siendo el valor. Focales front:
2 archivos/13 pruebas aprobadas, incluidos guardado y secretos de configuración.

#### Construcción — 6c-3

Subtítulo completo en párrafo M1 multilinea; contador «Sin confirmación SUNAT
(incluye cola)» y explicación de su alcance. Fórmula y cifras intactas. Focal
front: 1 archivo/3 pruebas aprobadas. No se modifica PageHeader compartido.

#### Construcción — 6c-4

Detalle fiscal condicionado al mismo booleano previo, con datos cargados; endpoints
siempre con texto efectivo sanitizado/ausencia. Criterios y compuerta intactos.
Focal back: 1 suite/10 pruebas aprobadas, incluyendo ausencia y secretos en URL.

#### Construcción — 6c-5

Una opción de incertidumbre incluye ERROR_RED y la clase visual explícita;
consultas y estados del servidor intactos. Focal front: 1 archivo/11 pruebas
aprobadas; ajustada la selección de la opción antigua al nuevo rótulo único.

#### Construcción — 6c-6

Proyección booleana de lectura de CDR/historial completo (sin límite de 20), con
campos de evidencia de transporte. Consulta incierta, rescate y bloqueo local no
acreditan envío. La tabla usa la evidencia junto al estado existente; ni retry-cdr
ni su guarda ni Resiliencia cambian. Focales: back 1 suite/5 pruebas y front
1 archivo/3 pruebas aprobadas. Escenarios FD01-1 sin transporte y FD01-2 con inicio.

Esta proyección debe leerse con la corrección posterior de 8C-C1: no acreditar envío por una consulta incierta no autoriza a descartar la incertidumbre que esa consulta mantiene pendiente.

#### Construcción — 6c-7

Selección RA muestra tipo/código, total y estado desde la vista previa ya existente.
Sin ampliar payload ni cambiar selección/reglas. Focal front: 1 archivo/9 pruebas
aprobadas, incluidos selección y envío simulado de la maquinaria existente.

#### Construcción — 6c-8

Ayuda «Factura o Boleta aceptada u observada», alineada al selector ya existente.
Sin cambiar guardas ni saldo. Focales front: 2 archivos/28 pruebas aprobadas.

#### Construcción — 6c-9

Panel no pinta cifras/cero ni «Sin rechazos» sin datos. Monitor de agregados
parte en carga y distingue respuesta vacía de fallo. Configuración pendiente/error
viaja a los dos formularios y numeración. Focal front: 1 archivo/7 pruebas aprobadas
con promesas diferidas. Reserva, guardas, consultas y datos fiscales intactos.

#### Construcción — 6c-10

Borrador inicial de precio a dos decimales, sin PATCH al cargar; Guardar explícito
conserva las validaciones previas y aplica el visible. Formato visual central de
8 dígitos en filas/selección/monitor y etiquetas accesibles. Identidad, correlativo,
rutas y XML intactos. Focal front: 1 archivo/3 pruebas aprobadas, con guardado
simulado y rechazo intacto de más de dos decimales. Selectores de pruebas ajustados
al nuevo número visible.

#### Cierre de Parte 6c — verificación y entrega

Construidos los diez puntos tras confirmación de bloque. Bases congeladas:
back bdb50766a3354980e399459811b0d4d067744526; front Carlos
8c3c6880eb5c744ed88af1df9c4f1884c4740b1f.

| Suite completa | Base aprobada | Final |
|---|---:|---:|
| Back, suites aprobadas | 278 | 279 |
| Back, pruebas aprobadas | 2555 | 2561 |
| Back, omitidas | 4 suites /38 pruebas | 4 suites /38 pruebas |
| Snapshots fiscales | 12 | 12, archivos intactos |
| Front, archivos aprobados | 118 | 123 |
| Front, pruebas aprobadas | 866 | 885 |

Cero fallos finales. Builds back/front OK; lint back limpio. ESLint de los archivos
front revisados conserva los 2 errores y 6 avisos de su base, contrastados por
stdin; no se cambian reglas/umbrales ni se silencian problemas. El conjunto revisado
incluye Monitor (su aviso FastRefresh también existía); no se atribuye como nuevo.
Regresión focal adicional tras consolidación: 2 archivos/9 pruebas, cierre
compartido preservado en posición/icono/comportamiento con etiqueta Cerrar y carga.
Cobertura local back del código nuevo intersectado con LCOV respecto de bdb5076:
9/9 líneas (100%) y 32/35 condiciones, combinada 41/44 = 93.18%; no es un resultado
remoto Sonar. Integraciones en PostgreSQL 16 local desechable; base eliminada al
terminar. Solo migraciones YA existentes en esa base aislada; ninguna nueva,
ninguna generación/aplicación en base compartida.

| Punto | Commit back | Commit front de origen |
|---|---|---|
| 6c-1, hora real | d1ae508 | 4b52aa0 |
| 6c-2, etiquetas | 54ed2b1 | 6fcfac9 |
| 6c-3, panel | 0891e23 | 5d1bd1e |
| 6c-4, detalles diagnósticos | 0dce3b2 | — (solo back) |
| 6c-5, filtro único | c9d6709 | 360d4bb |
| 6c-6, evidencia para vista | 2e8f903 | af992a4 |
| 6c-7, detalle RA | 8619a02 | 68025fd |
| 6c-8, ayuda notas | 43b0982 | 4d76a8b |
| 6c-9, cargas honestas | fdf7666 | ae5a059 |
| 6c-10, formato | Este commit | 390d549 |

Entrega front exclusiva por ferry/m1-cierre-6c en el remoto back: diez commits
separados (6c-4 documenta la dependencia exclusivamente back), FERRY.md completo,
31 rutas exactas con SHA-256 contrastado byte a byte con el clon front. No push
al remoto front. No cambios en UI común, Resiliencia, Contabilidad, Inventario,
esquema, reglas fiscales, estados ni XML. retry-cdr/ESTADOS_REINTENTABLES intactos;
la nueva evidencia solo se lee para presentar la acción. Nada de datos históricos
reescritos, emisiones reales, SUNAT real, PR, merges o despliegues. No queda
ningún punto abierto dentro del alcance aprobado.

## Parte 7 — puente y guardas (autorización de Jhordy)

Base reconciliada: back dev `7ac5cbbc` (merge #277), front dev `c20a639`
(merge #188). Back: 279 suites / 2561 pruebas aprobadas, 4 suites / 38
pruebas omitidas, 12 snapshots. Front: 123 suites / 885 pruebas aprobadas.
La medición anterior 276/2552 sobre bdb50766 omitía adicionalmente
`pulidoDlq.integration.spec.ts` (1 prueba) y
`sireDashboardMetrics.integration.spec.ts` (2), por TEST_DATABASE_URL ausente.
La referencia origin/dev quedó antes desfasada porque el refspec del clon
solo actualizaba main; se corrigió con fetch explícito del ref de dev.
Pruebas DB únicamente en PostgreSQL 16 local desechable (127.0.0.1:5436),
con migraciones existentes; ninguna migración nueva o base compartida.

### 7A — costo desde el movimiento real

El puente toma total_cost persistido por Kardex. No recalcula el costo de
venta leyendo las capas restantes ni las consume una segunda vez.
Regresión focal: TA-68, 1 suite / 41 pruebas aprobadas, incluida FIFO con
costo ya consumido y aserciones de cero lecturas/consumos adicionales.
La suite completa se repite al cierre de la ronda; XML fiscal intacto.

### 7B — cantidad física agregada por SKU

Una descarga por SKU suma todas sus líneas con Decimal. Un movimiento histórico
con cantidad distinta deja pendiente la conciliación, sin omitirlo como completo
ni publicar otra descarga que duplique lo anterior. Focal: 2 suites / 43 pruebas
aprobadas (SKU repetido, decimales, regresiones del puente).

### 7C — tipos y devolución a costo histórico

ND no genera movimiento físico ni exige stock de salida. La NC física acredita
costo y almacén desde la salida original (total_cost / quantity), nunca desde
el precio de venta. La idempotencia consulta la operación 05 para devoluciones.
El reverso contable usa el total_cost de la devolución persistida; no vuelve a
crear capas. Sin movimiento original/costo acreditado queda pendiente con motivo.
La evidencia de Emma (FD01-3 sin salida y FC01-13 sin devolución) no se reescribe:
esta ronda corrige el motor para la recuperación explícita posterior.
Focal: 2 suites / 44 pruebas aprobadas; se corrige la prueba antigua que exigía
incorrectamente salida de ND. Tipado de producción aprobado.

### 7D — cantidades y pertenencia de notas

La guarda común exige que todos los SKU pertenezcan al origen. Bajo FOR UPDATE
del origen suma unidades originales, líneas repetidas y NC físicas anteriores
(incluidas pendientes); no permite devolver más unidades reduciendo su precio.
Las notas económicas no consumen devoluciones físicas acumuladas. OBSERVADO
conserva las mismas reglas monetarias. Focal: 3 suites / 77 pruebas aprobadas.

### 7E — reserva durable derivada y exclusión del stock

La reserva de stock se deriva de ventas persistidas no descargadas y se computa para los estados distintos de RECHAZADO y ANULADO. ERROR_RED conserva esa reserva pendiente; una aceptación con puente pendiente también. La reserva no se descuenta de nuevo si la descarga ya existe. Esta regla no garantiza conservar stock para un documento RECHAZADO que mantenga una incertidumbre de transporte: el filtro actual lo excluye por estado. La separación entre estado fiscal e incertidumbre no modifica por sí sola esa guarda.

Usa invoice/items/movimientos existentes, sin tabla nueva ni reservas volátiles; no se reparan saldos históricos.
Focal: 3 suites / 26 pruebas aprobadas. PostgreSQL real local: stock 1 y dos
creaciones simultáneas confirman solo una; dos NC simultáneas sobre OBSERVADO
confirman solo una devolución. Sin SOAP ni consumidor. La exclusión compartida
con la descarga se completa en 7K.

### 7F — gratuitas con entrega física

Las afectaciones gratuitas ya no excluyen la entrega física. Kardex valoriza
con el método/costo real de Inventario, no con el valor referencial fiscal.
No se modifica el adaptador tributario ni el ICBPER. Focal: 3 suites / 88
pruebas aprobadas, incluyendo liquidación fiscal y ausencia de mutación de línea.

### 7G — acciones operativas ADMIN

retry-cdr y los POST de envío RA/RC exigen RolesGuard + ADMIN, además de la
autenticación existente. No cambian estados admitidos, retry-cdr ni Resiliencia.
Focal de metadatos y guardia real: 2 suites / 6 pruebas aprobadas.

### 7H — exclusión distribuida por documento

Coordinador compartido por endpoint/consumidor toma advisory lock transaccional
por invoice y vuelve a comprobar el estado antes de ejecutar el puente. Dos
procesos no intercalan el mismo documento. Se mantiene la recuperación por etapa
con las claves contables existentes. Focal: 2 suites / 15 pruebas aprobadas;
PostgreSQL real confirma máximo un puente activo por documento, y las pruebas
F001-64 mantienen recuperación, no-op, ausencia de capa y OBSERVADO.

### 7I — RA sin notas asociadas aceptadas

Vista previa y revalidación de reserva excluyen origen con cualquier NC/ND
aceptada u observada, aunque sea parcial. Motivo: «Tiene notas asociadas».
Se conserva la exclusión por nota pendiente y las demás guardas del agregado.
Focal: 2 suites / 63 pruebas aprobadas, incluida selección anterior no elegible.

### 7J — replay de constancia y nueva decisión humana

El POST exige decisionId estable. La identidad, episodio durable y referencia
a la constancia anterior quedan en el JSON del historial existente. Replay con
otro motivo da conflicto; replay consumido no crea autorización ni publica.
Una clave nueva tras consumo devuelve REQUIERE_NUEVA_DECISION sin escribir:
se exige renovar expresamente la constancia anterior. Front conserva la clave
al repetir; «Preparar una nueva decisión explícita» vacía motivo/confirmación y
genera identidad nueva. No modifica la conciliación automática ni Resiliencia.
Focal back: 1 suite / 16 pruebas aprobadas. Front: 1 suite / 2 pruebas aprobadas.
Front se entrega exclusivamente por ferry/m1-puente-guardas.

### 7K — entradas y salidas con capas atómicas (excepción autorizada)

Jhordy autoriza el cambio acotado de Inventario y la edición puntual de
purchasesService.ts (Compras): la capa al unitCostNet nace dentro de la misma
transacción existente. No se cambia cálculo de compra, IGV, saldo ni promedio.
El puente InventoryPurchaseService permanece intacto. Avisar a los dueños de
Inventario y Compras en revisión.

Ingreso manual e importación usan los repositorios existentes ligados al mismo
cliente transaccional; movimiento/capas/saldo hacen commit o rollback juntos.
Apertura conserva su motor y transacción. El servicio de capas acepta cliente
transaccional, bloquea almacén/saldo y comprueba disponibilidad completa antes
de consumir. Usa source_movement_id existente: no requiere migración.

Toda entrada crea capa al costo acreditado y toda salida mantiene cantidades
simétricas, también en PROMEDIO. FIFO traslada piezas al costo original en orden;
PROMEDIO conserva exactamente la valorización previa y crea la capa destino a
ese costo promedio. La capa no redefine el motor de promedio. Falta de costo
explícito admite el promedio del saldo previo como costo acreditado (ajustes y
manual); ausencia de ambos bloquea atómicamente, nunca precio de venta/cero
por defecto. No se reconstruyen capas/saldos históricos: la carga espejo y las
correcciones de datos son de Emma. Si falta alguna descarga, el asiento de costo
queda pendiente; no se guarda como completo un costo de documento parcial.

Focal: 8 suites / 100 pruebas aprobadas, 11 casos de PostgreSQL real incluidos
(rollback tras movimiento, consumos, traslado FIFO/PROMEDIO, ajustes y carencia
de capas/costo). Regresiones adicionales: 8 suites / 84 pruebas aprobadas.
Se actualizan dobles para el puerto transaccional nuevo; la prueba de RA de
fecha fija congela el reloj para no fallar al cruzar el plazo real de siete días.
La primera corrida completa detectó esos harness obsoletos; el cierre completo
se reporta al final, sin ocultar fallos ni cambiar configuración/umbrales.

### 7L — cuentas de respaldo retiradas

El puente exige todas las cuentas realmente usadas por VENTA/costo/reverso.
Un mapeo parcial no cae a cuentas PCGE fijas: informa la cuenta faltante y deja
trabajo recuperable. El coordinador solo reconoce asientos previos por sus
referencias/idempotencia; no construye otro asiento ni borra el motivo original.
El adaptador de respaldo queda retirado para escrituras. Contabilidad intacta.
Focal: 5 suites / 93 pruebas aprobadas, incluida reparación del mapeo seguida de
reproceso sin repetir la descarga física ni consumir otra capa.

### 7M — publicación null revierte creación

Si enqueueInvoiceInTx devuelve null, la transacción de creación falla con el
contrato OUTBOX_WRITE_FAILED; no confirma respuesta idempotente ni comprobante
sin trabajo. Resiliencia no se modifica. Focal: 2 suites / 33 pruebas aprobadas;
PostgreSQL real confirma cero facturas persistidas tras insertar y recibir null.

### 7N — catálogo vendible coherente con guardas fiscales

Vendible exige activo, sale_price positivo, unidad SUNAT soportada y afectación
admitida por la misma matriz de emisión. El listado entrega motivo concreto y
no sustituye precio por costo. Los históricos siguen consultables para notas.
Focal: 2 suites / 28 pruebas aprobadas; incluye MTQ válido, unidad ausente/no
soportada y afectación ausente/inválida aun con precio positivo.

### Barrido de fronteras: deuda de equipo expresamente aparcada

Por resolución del bloque de Parte 7, NO se construyen:
- Ítem 3: cambio de método/recalculo de Inventario concurrente o retroactivo.
  inventoryCostLayerService.updateCostMethod/recalculateCosting requieren
  coordinación con su dueño y períodos contables; no se recalculan históricos.
- Ítem 4: fallback compartido de almacén explícito inexistente a principal en
  manual/importación. Modificarlo cambia conducta compartida de Inventario.
- Ítem 6: numeración contable por leer último + 1 en
  prismaAccountingRepository.getNextEntryNumber. Exclusión 7H no reemplaza
  coordinación de numeración entre documentos/módulos distintos.
- Ítem 7: carrera entre cierre/apertura de período y saveEntry. Requiere una
  decisión/interfaz transaccional del dueño de Contabilidad.
- Ítem 9: ventanas entre guardar agregado/resultado y publicar/programar su
  trabajo. Ticket/artefacto conservados permiten recuperación, sin prometer
  reanudación automática durable; requiere diseño coordinado de publicación.
- Ítem 11: rol/actividad del usuario en access token vigente hasta 15 minutos;
  revocación inmediata requiere política de identidad, no cambio unilateral M1.
- Hallazgo 10c: ajuste de depósitos SPOT en notas fuera de alcance por decisión.

La edición de Compras se limita a la capa al costo neto dentro de su transacción
existente; no se amplía a su contabilidad, precios, IGV o saldos. Ningún archivo
de Resiliencia o Contabilidad se modifica en esta ronda.

### Verificación final de Parte 7

Back final: **284 suites / 2604 pruebas aprobadas**, cero fallos;
**4 suites / 38 pruebas omitidas** por sus condiciones existentes;
**12 snapshots fiscales aprobados**, sin editar generadores/XML ni snapshots.
Son +5 suites y +43 pruebas aprobadas respecto de dev actualizado (279/2561).
Incluye regresión de servicio gratuito con SKU sin descarga física y devolución
física basada en salida histórica aun si el catálogo cambió a servicio.
Último foco conjunto de puente/reproceso/idempotencia: 3 suites / 64 pruebas.
Build y lint back aprobados, sin nuevos avisos.

Corrida completa con cobertura y PostgreSQL local aislado. La primera corrida
instrumentada agotó el heap de Node (2 GiB); la corrida final usó únicamente
NODE_OPTIONS=--max-old-space-size=6144 en el proceso local. No se modifica CI,
Sonar ni umbrales. Medición contra dev 7ac5cbbc con el script existente
scripts/m1/coverage_new_code.py sobre LCOV: 232/242 líneas nuevas cubiertas
(**95,87%**), 241/278 resultados de condición cubiertos; combinado
(**90,96%**). Es medición local, no un resultado remoto de SonarCloud.

Front final: **123 suites / 886 pruebas aprobadas** (base 123/885), build
aprobado. ESLint de los dos archivos cambiados sin errores/avisos. Lint global
contrastado con worktree limpio c20a639: ambos arrojan **129 errores / 31
avisos**, todos en archivos sin cambios de esta entrega; no se corrigen módulos
ajenos. El único cambio front es 7J y se entrega por ferry/m1-puente-guardas,
con rutas exactas, manifiesto FERRY.md y SHA-256 por archivo.

Catorce commits funcionales A–N. Sin migraciones nuevas, sin cambios en
Resiliencia/Contabilidad, sin modificar datos del equipo/producción. Las
migraciones existentes solo prepararon la base local desechable autorizada.
Ninguna emisión, llamada real a SUNAT, PR, merge o despliegue. La ejecución
operativa y correcciones históricas siguen a cargo de Emma tras su revisión.

## Parte 8A — Descuento y redondeo

Bases: back dev `4877dc1c6dac306c187be043e765612a81134a33` (284 suites / 2604 pruebas aprobadas; 4 suites / 38 pruebas omitidas; 12 snapshots); front dev `315f50ccf2e9de73e5cef713d03121febf63d8d9` (123 suites / 886 pruebas). Sin migraciones ni llamadas reales a SUNAT.

### 8A-1 — Precio alternativo neto

El adapter conserva el precio bruto del catálogo y no cambia su contrato. Solo el precio alternativo 01 de líneas con descuento pasa a informar el neto unitario con impuestos, HALF_UP a dos decimales; gratuitas 02 y XML sin descuento se conservan. El descuento de línea añade `MultiplierFactorNumeric` (monto/base). La hoja del repositorio valida ese factor **si existe**: su ausencia no era por sí sola prueba de rechazo.

El descuento global se atribuye proporcionalmente a las bases de línea (02 solo gravadas, excluyendo gratuitas), HALF_UP a céntimos; residuo a la mayor base y empate a la primera. El IGV reducido de cabecera se atribuye con la misma regla. Esta atribución solo informa el precio alternativo: **no** vuelve a reducir `LineExtensionAmount` ni `TaxTotal` de línea; el allowance global de cabecera sigue siendo la única deducción en los totales. Ejemplo global: bases de línea 35.00 menos allowance 3.50 = base de cabecera 31.50; IGV 5.67; total 37.17. Reducir además las bases XML de línea descontaría dos veces. El código 01/03 conserva sus bases/impuesto y reduce el precio neto con la rebaja no afecta.

Pruebas focales: 3 suites / 18 pruebas. XML generado y firmado con certificado ficticio pasa XSD/XSL SFS real tanto con descuento de línea equivalente al caso F001-68 como global 02 y no afectos 01/03. Dos hashes SHA256 tomados del generador previo prueban igualdad byte a byte sin descuento, incluido SPOT 009 contado. No se actualiza ningún snapshot fiscal.

Bordes previos detectados, fuera de esta corrección: una gratuita con dos bolsas ICBPER produce total 1.00 en el adapter y 0.00 en el generador (el agregador omite ICBPER de gratuitas); resolverlo cambiaría XML sin descuento. Una prueba exploratoria mixta gravada/exonerada obtuvo SFS 2992 en el tributo 9997; no se cambia su categoría fiscal en esta ronda. La distribución de bases mixtas tiene prueba matemática; los casos SFS exigidos de descuento son gravados.

### 8A-2 — Paridad de redondeo front/back

El front usa Decimal HALF_UP para redondear y, crucialmente, **antes** del redondeo para multiplicar/dividir: 7.1 × 1.15 = 8.17. `decimal.js` 10.6.0 pasa de dependencia transitiva de pruebas a dependencia directa de producción; sin cambios de versión del paquete. Se alinean `invoiceTaxes`, `invoiceItems` y la rebaja de IGV de `invoiceDescuentoGlobal`. La línea con descuento 01 también sigue la rama de IGV recalculado que usa el adapter, en vez del complemento del bruto reservado a líneas sin descuento. No cambia la guarda de precio del catálogo.

Contrato compartido de 17 casos (cantidades fraccionarias, gravadas/exoneradas/inafectas, descuentos 00/01 y precios con precisión persistida sin redondear prematuramente la unidad): fixture verificada por el adapter y el PayableAmount generado del back, y copiada literalmente al ferry para comprobar el front. Back focal: 1 suite / 17 pruebas. Primera corrida completa del front en este punto: 124 suites / 902 pruebas aprobadas (base 123/886). El borde preexistente de gratuita+ICBPER descrito arriba queda fuera: no se presenta como paridad XML resuelta.

### 8A-3 — Edición decimal del descuento

`InvoiceItemsGrid` e `InvoiceDescuentoGlobal` reutilizan `InvoiceMoneyInput`: borrador textual durante la edición, entrada decimal de hasta dos posiciones y formato a dos decimales al abandonar. No cambia la matemática fiscal ni la validación de importes. Pruebas con formulario controlado real y userEvent: escritura secuencial `4.` → `4.13`, pegado, borrado, reescritura `7.1` y blur `7.10` para ambos campos. Focal: 3 suites / 14 pruebas aprobadas, incluidas las regresiones existentes de grilla y descuento global.

### 8A-4 — SPOT al crédito: comportamiento conservado y validado

No se cambia la fórmula ni el validador: cuotas = PayableAmount − detracción exacta − retención cuando concurren ambas. Casos: 1180.00 − 118.00 = 1062.00; con retención 35.40, cuotas 1026.60. Caso con diferencia de depósito BN: 730.17 − detracción exacta 73.02 = 657.15 de cuotas; **no** 657.17 (pago directo presentado después de depósito redondeado a 73.00). El generador rechaza tanto cuotas por el total íntegro como por el neto del depósito redondeado.

Focal: 2 suites / 16 pruebas aprobadas. Los dos casos de crédito con solo detracción se generan, firman con certificado ficticio y pasan XSD + hoja oficial SFS sin errores. SPOT+retención simultánea tiene regresión estructural de cuotas, conforme a la decisión explícita de Emma. La hoja local no sustituye la validación del servicio SUNAT vigente: se verifican también importes y sumas directamente.

### Cierre de verificación 8A

- Back final: **287 suites / 2635 pruebas aprobadas**, 4 suites / 38 pruebas omitidas; **12 snapshots aprobados, ninguno actualizado**. Build y lint global oxlint aprobados.
- Front final: **125 suites / 908 pruebas aprobadas**, cero fallos. Build aprobado; ESLint de todos los archivos TS/TSX modificados sin errores ni avisos. No se atribuye a esta entrega la limpieza del lint global ajeno a M1.
- Una corrida concurrente con builds falló la barra temporal de TA-13; la corrida completa final se ejecutó sin esa carga concurrente y pasó, sin modificar tests ni umbrales.
- Ferry: `ferry/m1-descuento-redondeo`, diez archivos del front en sus rutas exactas y manifiesto `FERRY.md` con SHA-256. 8A-1 y 8A-4 no requieren cambios de front; 8A-2 y 8A-3 se transportan en commits separados.
- Resto fiscal expresamente sin corregir aquí: gratuita+ICBPER (adapter vs total XML) y exoneradas con SFS 2992 por `TaxCategory/Percent` ausente (la hoja lo exige en `ValidaExprRegFactura-2.0.1.xsl:3100–3104`). No se alteran reglas de gratuitas/exoneradas ni los XML sin descuento para resolverlos de forma incidental.
- Sin migraciones, emisiones, llamadas reales a SUNAT, PR, fusiones ni despliegues.

## Parte 8B — Guardas de notas

Bases aceptadas: back dev `b4b8febd497db0a1b3572c44d2fc9acec216f680`, 287 suites / 2635 pruebas aprobadas, 4 suites / 38 pruebas omitidas y 12 snapshots; front dev `316e681ec89c72f5de0ac4e6bac71a8ee992d1a3`, 125 suites / 908 pruebas. Sin migraciones, emisiones ni llamadas reales a SUNAT.

### B1 — Devolución total física y monetaria

El motivo 06 exige todas las unidades pendientes de cada SKU y el saldo monetario exacto. Se extrae el cálculo Decimal por SKU de la Parte 7 a `noteQuantityBalance`, reutilizable por la proyección de lectura. Se mantiene el lock del origen dentro de la transacción de creación, antes de leer notas vigentes; 01/06/07 reservan cantidades sin esperar su CDR y RECHAZADO/ANULADO no consumen saldo. No se inventa identidad entre líneas: se acumula por SKU. Los otros motivos conservan su control anterior.

Focales B1: 3 suites / 74 pruebas aprobadas. Casos en ambos contratos de creación: 1 de 2 unidades al saldo completo se rechaza; todas las unidades y dinero exacto sobre OBSERVADO se admiten; devolución parcial previa; dinero incompleto; SKU omitido y repetido. Prueba secuencial de segunda solicitud con primera nota ya reservada y verificación de que el bloqueo precede a leer las notas (no se presenta esta prueba unitaria como carrera real de dos conexiones).

Suite completa tras B1: **288 suites / 2645 pruebas aprobadas**, 4 suites / 38 pruebas omitidas; 12 snapshots intactos. Front sin cambios de este punto: baseline 125/908.

### B2 — Motivo oficial/habilitado e importes positivos

Los dos contratos de creación comparten ahora la validación de motivo y positividad, antes de numerar. Se distingue `MOTIVO_INVALIDO` (fuera de catálogo oficial 09/10) de `MOTIVO_NO_HABILITADO` (oficial pero no habilitado en M1). Los catálogos habilitados se extraen sin cambiar sus códigos ni banderas `total`, manteniendo reexportaciones compatibles desde invoiceNoteService; las autorizaciones separadas de notas usan la misma distinción. Una prueba contrasta la lista oficial con los assets SFS y fija exactamente el conjunto habilitado anterior.

Toda nota exige total finito mayor que cero; cada línea onerosa exige precio positivo. Las gratuitas quedan fuera de esta última guarda: precio cobrado cero requiere su referencia positiva real. El adapter conserva ese cero y usa `valorUnitario` como referencia, sin confundirlo con precio oneroso ni inventar una referencia. El cambio del adapter está acotado a esa entrada gratuita explícita cero; las rutas de precio bruto y la guarda de catálogo de ventas no cambian. No se modifica tratamiento de IGV, descuentos o XML de los casos existentes.

Se verifican NC/ND y ambos contratos, incluyendo línea onerosa cero dentro de total positivo y descuento que dejaría total cero. El HTTP fiscal ya rechazaba cabecera cero por CreateInvoiceDto; esta protección se conserva y no se atribuye como nueva. Dos fixtures históricas de ND usaban incorrectamente motivo 07 de NC: pasan a 02, conservando las aserciones de precios históricos y OBSERVADO. Focales B2: **4 suites / 130 pruebas aprobadas**.

Suite completa tras B2: **289 suites / 2666 pruebas aprobadas**, 4 suites / 38 pruebas omitidas; 12 snapshots intactos. Front sin cambios de este punto: baseline 125/908.

### B3 — Saldo físico proyectado y tope en la interfaz

`GET /invoices/:id/saldo` añade `cantidades_pendientes: [{codigo, original, pendiente}]`, calculadas desde invoice_items y las NC vigentes de la empresa. Reutiliza el mismo cálculo Decimal por SKU de B1. Solo 01/06/07 descuentan unidades; las demás NC sí consumen su importe monetario según la regla ya existente, pero no inventan devoluciones físicas. El pendiente mostrado se limita a cero ante sobrededucción histórica, sin alterar los datos ni relajar la guarda de creación. No hay identidad ficticia de línea origen.

El formulario NC usa el pendiente para 01/06/07 y el original para motivos que no devuelven unidades (por ejemplo 13), conservando el comportamiento del servidor. Por fila, el máximo resta lo solicitado en las otras filas del mismo SKU. Hay atributo max, aria-invalid, error visible junto al campo y bloqueo de emisión; no se recorta la cantidad silenciosamente. Antes de publicar se consulta de nuevo el saldo y se verifica el límite con los datos frescos. El servidor, bajo el lock del origen, sigue siendo la autoridad ante carreras posteriores. ND y la emisión de ventas no cambian sus campos de cantidad.

Una respuesta sin cantidades o con cantidades inválidas no se reemplaza por un máximo inventado: se bloquea la NC con causa visible. Back y ferry deben integrarse coordinadamente; el front nuevo requiere la proyección nueva del back. Los mocks existentes de saldo se actualizan al contrato aditivo.

Focales B3: **3 suites / 44 pruebas** en el back y **4 suites / 22 pruebas** en el front. Casos: original/pendiente por SKU; exclusión de devoluciones monetarias sin movimiento físico; notas en curso; decimal fraccionario; tope 3 contra 2 aunque el importe quepa, en ambos contratos; SKU repetido; error visible y botón bloqueado; cambio del saldo al confirmar sin publicar; respuestas incompletas rechazadas.

Suite completa tras B3 (back): **290 suites / 2672 pruebas aprobadas**, 4 suites / 38 pruebas omitidas; **12 snapshots fiscales intactos**, sin actualizaciones. Build y lint global del back aprobados. Build del front aprobado. El lint de los archivos del ferry conserva **1 error y 2 avisos previos** de InvoiceEmitModal; contraste por stdin contra la base 316e681: mismas reglas, mensajes y fragmentos (set-state-in-effect, exhaustive-deps y only-export-components), sin incidencias añadidas. No se desactivan reglas ni se tocan configuraciones.

Front final tras B3: **126 suites / 913 pruebas aprobadas**, cero fallos (base 125/908). Ferry `ferry/m1-guardas-notas`: nueve archivos del front en rutas exactas y FERRY.md con manifiesto y SHA-256. B1/B2 no cambian la UI ni amplían motivos; B3 conserva las opciones visibles. No hay cambios en Resiliencia, Inventario o Contabilidad, migraciones, emisiones reales, llamadas a SUNAT, PR, merges o despliegues.

## Parte 8B-bis — Notas con descuento y pulido del formulario

Bases: back main `da61217c24c3ffe2f31a1912779a51a2d0986b02` (290 suites / 2672 pruebas, 4 suites / 38 omitidas y 12 snapshots); front main `be2c1cde8b790e1b67b3dc1574a7b751f4b7a233` (126 suites / 913 pruebas). El front incluye #195 y #196; este último solo toca Colecciones, sin diferencias en M1. Sin migraciones ni otros módulos.

### B1 — Construcción de certificación NO certificada

Commit aislado `bcbb33cdc12fd9cf849967f3f40ebcd8a697c367`. Solo notas 07/08, descuento de línea 00: Price unitario neto y sin su AllowanceCharge; AlternativeConditionPrice, impuestos, totales y payload se conservan. Adapter, descuento 01, facturas y boletas intactos. Caso real monetario: 41.30 − descuento base 3.50 → Price/LineExtensionAmount 31.50, IGV 5.67, precio alternativo/total 37.17.

**NO se declara cerrado 3271.** El XML anterior también pasa el set SFS local; este set no ejecuta 3271 y su comprobación equivalente 4288 es no bloqueante. Emma certificará después del despliegue con UNA NC total sobre F001-00000069, cuyo saldo sigue intacto según su evidencia porque FC01-00000015 fue rechazada. Si beta acepta, se cierra; si reaparece 3271, se revierte exclusivamente B1 y se replantea. Codex no ejecuta esa prueba real.

[Nota de certificación congelada en el commit B1](https://github.com/Jhordy-Salirrosas/Sistema-gestion-mype-sunat/blob/bcbb33cdc12fd9cf849967f3f40ebcd8a697c367/docs/m1/certificacion-8b-bis-notas-descuento.md). Se mantiene independiente de este documento de estado y de F1/F2 para que su reversión no arrastre el front.

B1: focales 3 suites / 24 pruebas; completa **291 suites / 2684 pruebas aprobadas**, 4 suites / 38 pruebas omitidas; **12 snapshots intactos**. Ocho hashes del XML previo comprueban igualdad byte a byte fuera del caso candidato. Build y lint del back aprobados.

### F1 — Precarga capada y prorrateada

El formulario espera detalle y cantidades antes de precargar la NC, consume el pool por orden original y excluye filas agotadas. F001-00000067, origen 2+3 y pendiente 4 del mismo SKU, inicia en 2+2, sin la pareja inicial de máximos condicionales 1/2. Motivos 01/06/07 usan pendiente; los motivos que no devuelven físicamente unidades conservan el pool original. ND conserva su precarga previa.

Con la regla fijada por Emma, en una fila recortada se prorratean el descuento de línea y el importe de ICBPER por cantidad nueva / original con Decimal HALF_UP a dos decimales. Precios/valores unitarios y referencias no se alteran. Si un descuento prorrateado redondea a cero se omite, en vez de enviar un descuento cero que el DTO prohíbe. Se conservan las validaciones existentes de bolsas y tarifa ICBPER, sin habilitar fracciones de bolsa. No se reprorratea una fila no recortada.

Una precarga tardía no sustituye una edición del usuario; refrescar el saldo no vuelve a precargar el borrador. Cambiar origen/tipo inicia otro intento de precarga con protección frente a respuestas antiguas. El backend mantiene la autoridad sobre saldo/cantidades, incluido el motivo 06. Focales F1: 4 suites / 22 pruebas; la nueva spec contiene ocho casos.

F1 completa: **127 suites / 921 pruebas aprobadas** en el front (base 126/913); back se mantiene en 291/2684, con 12 snapshots. Build front aprobado. ESLint del alcance conserva el error previo set-state-in-effect y el aviso previo only-export-components del modal; desaparece el aviso anterior de dependencias de la precarga. No hay incidencias nuevas ni supresiones/configuraciones modificadas.

### F2 — Causas de error visibles

`mensajeErrorEmision` reutiliza el extractor común existente, sin modificar ese módulo. Los 400 muestran `response.data.detail`/`message` en vez de `Request failed with status code 400`; la edición se conserva. El texto de clave reutilizada solo se presenta para 409 identificado como `IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_BODY` (código o detalle efectivo). Otros 409 muestran su causa; si no hay detalle se indica conflicto genérico, sin afirmar reutilización de clave. No cambian claves, reintentos, envío offline ni estados.

Focales F2: **2 suites / 13 pruebas aprobadas**. La spec nueva contiene cuatro casos: detalle de 400; conflicto específico; otros 409/sin detalle; nota parcial motivo 06 que recibe un 400, conserva datos y vuelve a usar exactamente la misma solicitud/clave al reintentar. Build del front y ESLint de los dos archivos F2 aprobados. Se mantienen los dos diagnósticos heredados del modal descritos en F1 (1 error y 1 aviso), sin incidencias nuevas.

F2 completa y cierre: **128 suites / 925 pruebas aprobadas** en el front; back permanece en **291 suites / 2684 pruebas**, 4 suites / 38 omitidas y **12 snapshots intactos**. Builds aprobados; lint back aprobado, lint de F2 limpio y sin nuevas incidencias en F1. Se comprobó en seco la reversión del parche B1 sin modificar el árbol de trabajo; no se ejecutó ninguna reversión real. La aceptación del candidato XML sigue pendiente de la única prueba de producción de Emma. Ramas `fix/m1-notas-descuento` y `ferry/m1-notas-descuento`; ferry con F1/F2 separados, archivos en rutas exactas, manifiesto y SHA-256. Sin migraciones, emisiones, llamadas reales a SUNAT, PR, merges o despliegues por Codex. Las ramas de 8B ya mergeadas no se modifican.

## Continuación: preparación local de notas — 11 de noviembre de 2026

Base de construcción: main a4534b91768902392c2c3bba31a873d52817e006; rama fix/preparacion-local-notas. Fase 0 y decisiones conservadas.

### P1 — Descripción canónica y recuperación del legado

El helper compartido `descripcionCanonicaNota` valida primero el motivo con las mismas guardas de Parte 8B. Deriva ausentes/blancos de noteCatalogs en el adaptador de pantalla, conversión fiscal y preparación de creación; preserva literalmente descripciones personalizadas no vacías y no amplía catálogos habilitados.

El worker completa la descripción de notas 07/08 almacenadas antes de generar XML. Bloquea/relee la fila y persiste payload e historial en una sola transacción, con `M1_NOTE_DESCRIPTION_COMPLETED`, etapa y texto derivado. Si la auditoría falla, no continúa. Una reentrega no duplica el evento cuando la descripción ya existe. No cambia estado fiscal, saldo ni marcador de transporte.

Pruebas nuevas: 1 suite / 5 casos (matrices 07/08 × ausente/blanca/personalizada para ambas rutas, motivo inválido/no habilitado y trabajo que continúa tras la reparación auditable). Se adaptaron fixtures de pruebas antiguas a la validación anticipada, conservando sus aserciones de negocio.

P1 verificado: suite general 289 suites / 2680 pruebas aprobadas más 3 suites / 15 pruebas PostgreSQL activadas explícitamente: **292 suites / 2695 pruebas; 12 snapshots**. Las restantes 4 suites / 38 pruebas quedan omitidas como en la base. TypeScript back aprobado tras regenerar el cliente Prisma del esquema vigente. No se añadió ni aplicó migración; se materializó el esquema existente exclusivamente en PostgreSQL local desechable.

### P2 — Contenido fiscal antes del correlativo

`validarContenidoFiscal` es una función pura compartida por el generador y `AtomicInvoiceCreationService.runEmission`. Valida campos obligatorios con los datos reales del emisor, después de las guardas de negocio y antes de reservar número; acepta el número provisional 0. El generador mantiene separada su exigencia de correlativo positivo. No se invoca el generador sobre el cálculo previo.

Focal P2: **3 suites / 34 pruebas aprobadas**, incluidas **2 pruebas sobre PostgreSQL real**, una por ruta HTTP: razón social del emisor blanca produce `Dato fiscal ausente: razonSocialEmisor`; la serie permanece en 69, no existen comprobante ni respuesta idempotente y no se llama a publicación de trabajo. El esquema vigente se materializó en una base local desechable; no hay migraciones nuevas ni acceso a producción. TypeScript back aprobado. Se añaden 2 suites / 13 pruebas al total de P1.

### P3 — Causa durable y presentación honesta

Un fallo de preparación registra en TransactionHistory un código `M1_PREPARATION_*` y JSON con `codigo`, `etapa`, `categoria`, `recuperable` y `causa`. Las etapas distinguen carga, reparación de descripción, generación UBL, configuración del emisor, firma, ZIP, persistencia XML y validación local. La causa usa una lista cerrada de textos saneados: no persiste mensajes crudos de drivers, credenciales, XML ni payload. El puerto existente CdrPersistenceService escribe ERROR_RED e historial atómicamente y protege estados finales concurrentes. Si falla esa escritura, se propaga el fallo; no se despacha ni se simula una auditoría exitosa.

El back presenta `PREPARACION_LOCAL` y «Bloqueado en preparación local», con categoría y recuperabilidad. Un evento posterior de transporte impide revivir un bloqueo antiguo. La incertidumbre explícita conserva máxima prioridad. En el front, lista/detalle/bitácora/Monitor muestran esa lectura; la bitácora distingue datos inválidos de certificado/configuración/infraestructura recuperables. El Monitor conserva Reintentar y añade filtro de preparación local. No hay estado fiscal nuevo, cambios de guarda de saldo ni liberación de reservas: ERROR_RED sigue consumiendo. Descarte terminal fuera de alcance.

Focal P3 back: 5 suites / 65 pruebas más 1 suite / 10 pruebas de compuerta no concluyente aprobadas. Focal front: 2 suites / 19 pruebas aprobadas. Suite completa front final: **128 suites / 928 pruebas**, build aprobado. ESLint de los siete archivos: 0 errores, 1 aviso heredado de only-export-components en InvoiceMonitorPage.tsx; sin supresiones ni cambios de configuración. TypeScript y lint back aprobados.

Cierre back: la corrida completa activando TEST_DATABASE_URL local obtuvo 293 suites / 2712 pruebas aprobadas y 2 fallos, 4 suites / 38 pruebas omitidas, 12 snapshots aprobados. Se corrigió únicamente la expectativa antigua de la prueba de fallo de auditoría (ahora se propaga el fallo durable) y su suite completa pasó 10/10. La suite outbox tuvo un fallo de umbral de latencia mientras corrían build/front; repetida aislada, sin cambiar umbral ni implementación, pasó 3/3 en PostgreSQL real. **Total validado final: 295 suites / 2714 pruebas; 12 snapshots**, incluidos ambos reruns. No quedan fallos pendientes. Primera corrida P1 agotó el heap predeterminado; las completas siguientes usaron NODE_OPTIONS=--max-old-space-size=6144.

### Acción de producto: reanudación de FC01-00000016

Tras el despliegue del back, FC01-00000016 se reanuda desde el Monitor: con rol ADMIN de la empresa, buscar el documento y pulsar **Reintentar**. Equivalente exacto: `POST /api/v1/invoices/{UUID-de-FC01-00000016}/retry-cdr`, con autenticación normal del tenant. El parámetro es el UUID del documento, no el número fiscal. La ruta existente rescata DLQ con rescatarDlq:true; si ya existe un trabajo activo no lo duplica. Revisar la respuesta encolado/resultadoCola antes de repetir.

La preparación completa `descripcionMotivoNota` con «Devolución total» y registra `M1_NOTE_DESCRIPTION_COMPLETED` en el historial antes de generar. No editar el payload ni crear otra nota para sustituirla. No cambia transport_uncertain: si es true o histórico desconocido, el flujo existente concilia antes de cualquier reenvío; si la consulta no concluye, seguirá pendiente. Reanudar no garantiza aceptación fiscal y no libera saldo. Esta acción no se ejecutó en producción durante el encargo.

Entrega front por `ferry/preparacion-local-notas` en el repositorio back, con siete rutas exactas y FERRY.md con hashes SHA-256. Base front actual: f7c4191b0c4dbf57364a6a56ed031f82752f4497; clon front validado: ed31e1e33526b90b3f94dacf3cf262c0faba2fa5. Sin push al repositorio front. Sin migraciones nuevas o aplicadas, emisiones reales, PRs, merges ni despliegues.

## Parte 8B-ter — totalidad de cantidades de NC

Base back: main `68575577abed679326f2bb116c15151bb12a0044`; base front: main `59cbbb48fba579b10917dcf151151f637fcfad54`. Baselines verificados: back 301 suites / 2734 pruebas y 12 snapshots (4 suites / 38 pruebas omitidas); front 128 suites / 930 pruebas. Construcción limitada a P1 y P2, sin migraciones ni emisiones.

### P1 — Una sola fuente de totalidad

`esMotivoCreditoTotal` consulta el flag `total` de noteCatalogs y es consumido por las guardas de dinero y cantidades y por InvoiceNoteService. Se elimina la comparación manual con motivo 06. Para NC totales, la guarda exige igualdad por SKU contra el pool pendiente: incluye SKU omitidos, suma filas repetidas y mantiene el máximo y la precisión Decimal existentes. Se usa el pool pendiente también al validar motivo 02, sin cambiar qué notas anteriores reservan unidades físicas.

ND y motivos parciales conservan su comportamiento. La clasificación física de 02, el Kardex y la reversión de costo quedan expresamente fuera de esta parte; no se cambian devuelveUnidades ni los filtros de la proyección de cantidades_pendientes. No se reinterpretan notas históricas 02 como devoluciones físicas.

Focal P1: **3 suites / 61 pruebas aprobadas**; la suite nueva contiene 34 casos, incluidos ambos contratos de alta atómica con dinero exacto/unidades parciales para 01, 02 y control 06, ausencia de reserva/publicación al bloquear, SKU omitido, filas repetidas, pool consumido, precisión decimal y controles de ND/07. TypeScript back aprobado. Sin cambios de esquema.

### P2 — Metadatos del saldo y mínimo visible en el front

La respuesta existente de saldo añade `motivos_totales`, calculado desde noteCatalogs mediante el helper único. El cliente valida ese arreglo y lo pasa a `limitesNota`; no se añade una lista de motivos totales al código del front ni se amplían las opciones del selector. Si faltan los metadatos o son inválidos, la consulta bloquea la creación de la NC con un error visible. Desplegar el back antes de aplicar el ferry del front.

`limitesNota` suma las cantidades solicitadas por SKU con Decimal y compara contra todos los SKU de cantidades_pendientes, incluidos los que no aparecen en el borrador. Para motivos totales exige el mínimo pendiente y conserva el tope máximo existente. El motivo 02 usa el pendiente para esta validación de totalidad; esto no lo convierte en devolución física ni cambia el cálculo histórico del pool. La precarga y el prorrateo de la parte anterior permanecen intactos.

El cableado existente incorpora el mensaje a los pendientes del formulario, deshabilita Emitir y vuelve a comprobar con saldo fresco justo antes de publicar. ND no entra en ese cableado de NC. No se cambian Kardex, costos, devuelveUnidades, estados fiscales ni exclusiones de saldo; P3 queda expresamente fuera.

Focal P2 back: **2 suites / 41 pruebas aprobadas**, incluida la comprobación del nuevo contrato y la conservación del pool físico de notas históricas 02. Focal front: **2 suites / 21 pruebas aprobadas**, con mínimo, máximo, filas repetidas, SKU omitido, decimales, metadatos recibidos sin lista fija, respuesta incompleta, bloqueo visible y revalidación antes de publicar. Build del front y TypeScript del back aprobados.

Cierre P1/P2: **back 302 suites / 2769 pruebas y 12 snapshots aprobados**, 4 suites / 38 pruebas omitidas como en la base. **Front 128 suites / 938 pruebas aprobadas** en la corrida completa final. La prueba antigua que intentaba publicar media unidad con motivo total se adaptó a cantidades completas y edición conservada; mantiene su intención de verificar el rechazo tardío del servidor y la reutilización de la misma clave. Lint back aprobado; lint front conserva únicamente el error y aviso heredados del modal, reproducidos en la base. Build front y TypeScript back aprobados. Entrega en `ferry/m1-8b-ter-cantidades-totales`, con diez archivos y hashes SHA-256 en FERRY.md. La adenda P3 se construye después, en un commit separado.

### P3 — Adenda aprobada: coherencia física de motivo 02

Esta adenda sustituye la exclusión de P3 indicada al cerrar P1/P2. `notePhysicalReturnPolicy.devuelveUnidades` centraliza la clasificación física 01/02/06/07 y es consumida por el pool, la guarda de creación, Kardex y reversión de costo. Se mantiene separada de `esMotivoCreditoTotal` y su conjunto 01/02/06: el motivo 07 devuelve unidades pero no exige totalidad.

El pool descuenta unidades de notas 02 anteriores, incluidas las históricas. Las notas nuevas 02 creadas con esta versión quedan selladas por el servidor, exclusivamente en el INSERT transaccional del repositorio, con `payload_ubl.politicaDevolucionFisica02 = 1`. El valor no depende del cliente ni se añade al preparar XML, reintentar, recuperar una respuesta idempotente o reprocesar documentos existentes. No se modifica el esquema ni se hace backfill.

Al aceptarse u observarse una 02 sellada, se usa el mismo circuito que para 01: entrada de Kardex con operación 05, capa de entrada al costo histórico acreditado por la salida original, reversión de venta y reversión de costo. Se conservan las claves de idempotencia existentes. ND no mueve existencias y los motivos 01/06/07 conservan su circuito.

Una 02 sin el sello se considera histórica para los efectos locales. El puente devuelve una omisión explícita antes de crear cualquier movimiento o asiento, sin ejecutar el respaldo contable. El coordinador registra una única constancia `M1_LEGACY_02_NO_RETROACTIVITY` en el historial y expone `motivoOmision` en la respuesta. No cambia el payload histórico ni fabrica efectos faltantes al reprocesarlo, incluso por reentrega del worker. El cambio de lectura del pool no implica regularización física ni contable retroactiva.

Regresiones: 40 casos en la suite de guardas, incluidos ambos contratos con nota 02 previa, mínimo/máximo del pool, saldo monetario agotado y sello exclusivo de creación. PostgreSQL local desechable: 6 casos, con entrada/capa/costo histórico y reversos reales persistidos para 01/02/06/07, control 02 en PROMEDIO y FIFO, reentrega sin duplicación, pool con 02 histórica y nuevo total ajustado a 8 unidades; reprocesos repetidos de la histórica sin movimientos ni asientos y con una sola constancia durable. TypeScript y lint back aprobados, sin supresiones.

### Archivos de la Parte 8B-ter (P1/P2/P3)

- `docs/m1/auditoria-solucion.md`
- `src/modules/invoices/application/services/creationGuards.ts`
- `src/modules/invoices/application/services/creditNoteBalanceGuard.ts`
- `src/modules/invoices/application/services/invoiceAccountingBridgeService.ts`
- `src/modules/invoices/application/services/invoiceBridgeCoordinatorService.ts`
- `src/modules/invoices/application/services/invoiceNoteService.ts`
- `src/modules/invoices/application/services/kardexBridge.ts`
- `src/modules/invoices/application/services/noteCatalogs.ts`
- `src/modules/invoices/application/services/notePhysicalReturnPolicy.ts`
- `src/modules/invoices/application/services/noteQuantityBalance.ts`
- `src/modules/invoices/infrastructure/persistence/prismaInvoiceRepository.ts`
- `src/modules/invoices/invoicePayload.ts`
- `test/fixtures/8bTerAtomicHarness.ts`
- `test/integration/invoices/8b-ter-physical-02.integration.spec.ts`
- `test/unit/invoices/8b-cantidades-saldo.spec.ts`
- `test/unit/invoices/8b-ter-totales.spec.ts`

Front: los diez archivos de producción/pruebas se enumeran con sus rutas exactas y hashes SHA-256 en FERRY.md de `ferry/m1-8b-ter-cantidades-totales`. P3 es exclusivamente back; no requiere otro cambio de front.

Cierre final de la adenda: **back 303 suites / 2781 pruebas y 12 snapshots aprobados**, 4 suites / 38 pruebas omitidas; corrida completa sin fallos. **Front 128 suites / 938 pruebas aprobadas**, sin cambios posteriores de front por P3. TypeScript/lint back aprobados; build front aprobado, con el diagnóstico de lint heredado del modal ya descrito. P1, P2 y P3 quedan separados en tres commits de la rama `fix/m1-8b-ter-cantidades-totales`; ferry de P2 y actualización documental de P3 en `ferry/m1-8b-ter-cantidades-totales`. Sin migraciones, emisiones reales, PRs, merges ni despliegues durante el encargo.


## Parte 8C — transporte, puente y resúmenes RA/RC

Construcción sobre back `311b02aaf709383aff899a1171ece060b612e788` y front `c146b716d1cbab7b3456e8186625c6f1021cee6a`. Orden de commits: C1, C4, C5, C2 y C3. Sin migraciones ni cambios de código fuente en Inventario, Contabilidad o la cola compartida; sin emisiones reales, PRs ni despliegues.

### C1 — evidencia de transporte y resolución de incertidumbre

El clasificador separa la evidencia de envío de la incertidumbre pendiente. Un bloqueo local posterior no borra ninguna de ellas. Solo una respuesta concluyente resuelve la incertidumbre; `M1_TRANSPORT_UNCERTAIN` impide concluir que no hubo envío, pero por sí mismo no acredita un envío. Se conserva la prioridad de transporte sobre causas de preparación antiguas en la presentación.

### C4 — RA aceptada y reversión durable del puente

El CDR recibido se conserva antes de materializar la aceptación local. La aceptación de la RA registra trabajo específico `REVERSE_RA_BRIDGE` por miembro en el JSON existente del agregado y el evento documental `M1_RA_REVERSAL_PENDING`. No depende del job ordinario del comprobante, que considera ANULADO un estado final.

El servicio de reversión de M1 procesa cada documento en su propia transacción y comparte la exclusión del puente. Revierte únicamente movimientos y asientos realmente registrados: contramovimientos con referencia estable y costo histórico acreditado, y contraasientos referenciados con debe/haber invertidos. Las claves estables evitan duplicados. Un fallo contable revierte también los movimientos de esa transacción; los miembros completados permanecen completados. El intento y la próxima fecha quedan durables, con recuperación interna. La aceptación fiscal y el CDR se conservan aunque falle la reversión local. Detalle y Monitor de agregados muestran la reversión pendiente; al completarse se registra `M1_RA_REVERSAL_DONE`.

Regresiones PostgreSQL: cuatro casos cubren movimientos/capas/contraasientos reales e idempotencia, efectos ausentes, rollback ante fallo y aislamiento entre miembros. La lógica de recuperación conserva el CDR para continuar la materialización sin otra llamada de envío.

### C5 — recuperación de POLLING y exclusión de consultas

La recuperación incorpora agregados POLLING con ticket. El JSON existente persiste intentos, próxima fecha, agotamiento y una exclusión con vencimiento compartida por consulta manual, worker y recuperación. Se mantienen los intervalos de 5/15/30 minutos y luego una hora, con máximo de 24 consultas automáticas. El intento se consume antes de consultar; la recuperación no reinicia el presupuesto ni rearma un agregado agotado. Las publicaciones pendientes se deduplican y un ticket existente impide repetir `sendSummary`.

Para trabajos anteriores se adopta la evidencia disponible en la cola. Si el historial fue eliminado y no permite conocer el presupuesto, se expone esa incertidumbre sin inventar un contador nuevo; continúa disponible la consulta manual. La consulta manual tampoco reinicia el presupuesto automático. El Monitor muestra intentos, próxima fecha y agotamiento. Siete pruebas PostgreSQL verifican concurrencia, vencimiento, presupuesto, recuperación y deduplicación.

### C2 — reintento de rechazo final

`retry-cdr` responde `encolado: false` y código `INVOICE_REJECTED_FINAL` para RECHAZADO, con un mensaje explícito de estado fiscal final. No publica trabajo ni reabre el comprobante. Los caminos de ERROR_RED e incertidumbre conservan su comportamiento. El front ya presenta el mensaje del servidor; no requiere cambios por este frente. Tres regresiones verifican rechazo final y caminos conservados.

### C3 — omisión durable de descarga por clasificación como servicio

Ambas rutas de creación atómica guardan en el payload una instantánea de clasificación de inventario por SKU obtenida del servidor. Un servicio acreditado desde la creación conserva su omisión normal. Si era inventariable y ahora es servicio, el puente registra `M1_BRIDGE_INVENTORY_OMITTED` con causa `PRODUCT_CHANGED_TO_SERVICE`. Si falta la instantánea histórica, la causa es `INVENTORY_CLASSIFICATION_UNKNOWN`: no se afirma que hubo un cambio. Un movimiento ya registrado se reconoce y no se convierte en una omisión nueva.

El evento y la marca de pendiente del payload se escriben juntos. El resultado del puente permanece incompleto; el worker conserva su contrato de trabajo pendiente. El detalle conserva el resultado fiscal y muestra la condición local. El Monitor consulta el filtro `puente_pendiente=true`, muestra el pendiente y permite usar la acción existente `reprocesar-puente`. Al verificar o completar la descarga, el reproceso registra `M1_BRIDGE_INVENTORY_RESOLVED` y retira la marca cuando no quedan SKU pendientes. No se duplica la descarga ni el evento al repetir el trabajo. No se fabrica una regularización histórica ni se cambia el estado fiscal.

Cuatro regresiones PostgreSQL verifican el cambio acreditado, el servicio original, la ausencia de evidencia histórica y la descarga ya realizada; incluyen consulta del filtro real, reprocesos repetidos y resolución durable. Las pruebas de interfaz verifican detalle, causa visible y acción del Monitor.

Propuesta para el equipo de Inventario, exclusivamente documentada: bloquear el cambio producto→servicio cuando existan descargas del puente pendientes, con una comprobación transaccional y una disciplina de concurrencia compartida que impida una carrera con la aceptación/reproceso. Antes de habilitar el cambio debe definirse la resolución explícita y auditada de los pendientes históricos. No se implementa esta restricción ni se modifica el controlador o los servicios de Inventario en la Parte 8C.

### Verificación y archivos de la Parte 8C

Corridas completas finales: **back 307 suites / 2803 pruebas / 12 snapshots aprobados**, con 4 suites / 38 pruebas omitidas como en la base; **front 130 suites / 943 pruebas aprobadas**. PostgreSQL local desechable habilitado para las integraciones; SUNAT real no habilitado. Builds `npx nest build` y `npm run build` del front aprobados; TypeScript back aprobado. Lint back sin errores, con cuatro advertencias menores (dos variables/importaciones sin uso en la prueba C4 y dos respaldos vacíos de spread en C5); lint de los archivos front cambiados sin errores, con la advertencia de exportación para Fast Refresh ya existente en el Monitor.

Bases verificadas de fase 0: back 303 suites / 2781 pruebas / 12 snapshots aprobados y front 128 suites / 938 pruebas aprobadas. La entrega conserva un commit back por frente. Los archivos front se trasladan mediante `ferry/m1-8c-puente-resumenes`, con manifiesto y SHA-256; aplicar después del back. El código fuente de producción modificado permanece dentro de `src/modules/invoices`.


#### C1 — archivos back

- `src/modules/invoices/application/services/invoiceTransportEvidence.ts`
- `test/unit/invoices/m1-incertidumbre-transporte.spec.ts`

#### C4 — archivos back

- `src/modules/invoices/application/services/invoiceResultPresentation.ts`
- `src/modules/invoices/application/services/raBridgeReversalService.ts`
- `src/modules/invoices/application/services/summaryAggregateStore.ts`
- `src/modules/invoices/application/services/summaryEnvioService.ts`
- `src/modules/invoices/invoicesModule.ts`
- `test/fixtures/summaryAggregateHarness.ts`
- `test/integration/invoices/8c-ra-reversal.integration.spec.ts`
- `test/unit/invoices/summaryAggregateStore.spec.ts`

#### C5 — archivos back

- `src/modules/invoices/application/services/summaryAggregateStore.ts`
- `src/modules/invoices/application/services/summaryDispatchService.ts`
- `src/modules/invoices/application/services/summaryEnvioService.ts`
- `src/modules/invoices/application/services/summaryPollingCoordinator.ts`
- `src/modules/invoices/summaryJobConsumer.ts`
- `test/fixtures/summaryDispatchHarness.ts`
- `test/integration/invoices/8c-summary-polling.integration.spec.ts`
- `test/unit/invoices/summaryAggregateStore.spec.ts`
- `test/unit/invoices/ta67-resumenes-en-cola.spec.ts`

#### C2 — archivos back

- `src/modules/invoices/application/dto/invoiceQueryDto.ts`
- `src/modules/invoices/application/services/invoiceQueryService.ts`
- `test/unit/invoices/8c-retry-final.spec.ts`

#### C3 — archivos back

- `docs/m1/auditoria-solucion.md`
- `src/modules/invoices/application/dto/invoiceQueryDto.ts`
- `src/modules/invoices/application/services/atomicInvoiceCreationService.ts`
- `src/modules/invoices/application/services/emitirComprobanteService.ts`
- `src/modules/invoices/application/services/invoiceAccountingBridgeService.ts`
- `src/modules/invoices/application/services/invoiceBridgeCoordinatorService.ts`
- `src/modules/invoices/application/services/invoiceBridgeOmission.ts`
- `src/modules/invoices/application/services/invoiceQueryFilters.ts`
- `src/modules/invoices/application/services/invoiceResultPresentation.ts`
- `src/modules/invoices/infrastructure/controllers/invoiceQueryController.ts`
- `src/modules/invoices/invoicePayload.ts`
- `test/integration/invoices/8c-bridge-omission.integration.spec.ts`
- `test/unit/invoices/ta68-puente-kardex-contabilidad.spec.ts`

#### C4 — archivos front (ferry)

- `src/modules/invoices/components/InvoiceAggregateMonitor.tsx`
- `src/modules/invoices/components/InvoiceAuditTrail.tsx`
- `src/modules/invoices/components/InvoiceCdrModal.tsx`
- `src/modules/invoices/components/InvoiceStatusBadge.tsx`
- `src/modules/invoices/lib/invoiceResultPresentation.ts`
- `src/modules/invoices/types/invoiceAggregate.types.ts`
- `test/unit/modules/invoices/invoicePulidoPresentacion.test.tsx`

#### C5 — archivos front (ferry)

- `src/modules/invoices/components/InvoiceAggregateMonitor.tsx`
- `src/modules/invoices/types/invoiceAggregate.types.ts`
- `test/unit/modules/invoices/invoice8cAggregateMonitor.test.tsx`

#### C3 — archivos front (ferry)

- `src/modules/invoices/components/InvoiceAuditTrail.tsx`
- `src/modules/invoices/components/InvoiceCdrModal.tsx`
- `src/modules/invoices/components/InvoiceStatusBadge.tsx`
- `src/modules/invoices/lib/invoiceResultPresentation.ts`
- `src/modules/invoices/pages/InvoiceMonitorPage.tsx`
- `src/modules/invoices/services/invoicesApi.ts`
- `test/unit/modules/invoices/invoice8cBridgePending.test.tsx`

C1 y C2 no requieren archivos front. El manifiesto FERRY.md añade las instrucciones de traslado y los SHA-256 finales de todos los archivos front.

## Parte 8D — línea gratuita completa

Corrección posterior: la guarda de stock reutiliza la política compartida de D1 para admitir la discrepancia de afectación de una gratuita válida, recibiendo precio cobrado y referencia; las regresiones PostgreSQL recorren ambas rutas con producto inventariable y entrada real, conservando el mensaje de discrepancia onerosa y el control de existencias.

Construcción sobre back `95b6687d5843588e10f34b43b7f6d0eb850a6bca` y front `4b94d22f769b788aca001295ae1e066f92f0c4ed`, en orden D1, D2, D3 y D4, con un commit back por frente. Sin emisiones reales, PRs, migraciones ni columnas nuevas. Los cambios de producción permanecen en M1. El front se entrega mediante `ferry/m1-8d-linea-gratuita`, con sus archivos originales y SHA-256 en FERRY.md.

### D1 — gratuidad explícita y contratos de creación

El formulario permite declarar una línea gratuita conservando el producto, la unidad y el valor referencial, con precio cobrado cero y elección explícita del motivo fiscal. El selector de motivos no queda bloqueado por la afectación heredada; las notas conservan su clasificación histórica. Al retirar la gratuidad de una línea convertida se recuperan los datos onerosos originales. Una referencia inválida o un motivo pendiente bloquean la validación del formulario, incluso si existe ICBPER. Las pruebas anteriores de selección gratuita se actualizan para exigir precio cobrado cero, manteniendo el valor referencial y el control de edición de la grilla.

Ambas rutas de creación pasan por la misma guarda. Los códigos gratuitos se reconocen mediante el helper que consulta `AFECTACIONES_GRATUITAS`; se elimina la lista duplicada del adaptador. Una gratuita exige precio cobrado cero y referencia finita positiva. La guarda conserva la unidad y las restricciones del contrato oneroso; no compara el cero cobrado con el precio oneroso del catálogo. El maestro no se modifica. Las notas siguen exigiendo coincidencia con su origen y un importe positivo conforme a sus reglas existentes.

El contrato fiscal admite monto_total cero exclusivamente para factura/boleta íntegramente gratuita, con cantidad y referencia positivas y precio cobrado cero en todas las líneas. La guarda común también impide liquidar un documento oneroso en cero, por ejemplo mediante un descuento total. La excepción no se aplica a notas ni a un payload sin líneas o sin evidencia de gratuidad.

Se conserva la representación UBL existente: PriceTypeCode 02, precio referencial positivo, precio cobrado cero y 9996/GRA/FRE. Los códigos 11–16 declaran tasa referencial 18%; 21 y 31–37 declaran cero. Las onerosas 20/30 conservan 9997/9998. Se añade la leyenda 1002 para la transferencia gratuita. No se cobra al cliente el valor referencial ni el IGV del retiro gratuito. El puente físico no se modifica.

Validación focal D1: 45 pruebas nuevas del back, incluidas ambas rutas con una gratuita cuyo maestro no tiene precio oneroso configurado. Cuatro pruebas nuevas del front verifican selección, motivo, referencia, restauración del precio oneroso, validación y payload.

### D2 — ICBPER y TaxTotal de cabecera

La gratuita también aporta su ICBPER al agregado tributario: dos bolsas declaradas suman S/ 1.00, conforme al gravamen por adquisición bajo cualquier título de la Ley 30884, artículo 12. El adaptador reutiliza el calculador existente de ICBPER, y los totales XML ya no excluyen ese impuesto por la gratuidad de la línea.

El comprobante con ICBPER genera un único TaxTotal de cabecera y sus subtotales, incluido 7152, eliminando el doble TaxTotal que provocaba SFS 3024. Se mantienen separados el impuesto a las bolsas y las referencias de las operaciones gratuitas. El total cobrable coincide con el adaptador. Esta corrección estructural no se aplica al RC.

Validación focal: 33 pruebas, incluidas ocho comprobaciones XSD/SFS con certificado ficticio para factura/boleta y naturalezas gravada, gratuita gravada, gratuita exonerada e inafecta, además del control mixto. Los 24 hashes de XML sin ICBPER, capturados después de D1 y antes de D2, se conservan byte a byte para 01/03/07/08 y seis naturalezas no afectadas por D3. No se reescriben snapshots para cubrir diferencias. La aserción previa de m1-money se ajusta a un único TaxTotal, conservando la comprobación de suma de impuestos.

### D3 — tasa cero de exonerada onerosa

La categoría 9997 de la línea onerosa exonerada declara Percent 0.00, conservando categoría E y afectación 20. El cambio se limita a esa rama del helper; las demás categorías no cambian. La representación sin ICBPER de las otras seis naturalezas mantiene los controles SHA-256 anteriores. La diferencia de XML de una exonerada onerosa corresponde exclusivamente a este frente, no a D2.

Ocho casos XSD/SFS verifican factura, boleta, NC y ND exoneradas puras y mixtas; ya no se reproduce el 2992 de la línea 9997.

### D4 — regresiones de paridad con RC

No se modifica código de producción del resumen. Quince pruebas verifican referencia e impuesto gratuito, ICBPER, total cobrable y ausencia de mutación del payload entre boleta y RC, con gratuitas gravadas, exoneradas e inafectas, puras/mixtas y con/sin bolsas. El RC conserva su BillingPayment y sus bloques por tributo. Cada pareja de XML de boleta y RC de la matriz pasa XSD/SFS local con firma ficticia; un total persistido discordante se rechaza explícitamente.

### Certificación y límites

Las pruebas XSD/SFS son locales y no constituyen certificación SUNAT. La certificación posterior en beta deberá conservar XML firmado, hash y CDR para factura/boleta con las tres naturalezas gratuitas, puras/mixtas, con/sin ICBPER y con exoneradas onerosas; el RC requiere su propio ticket/CDR. No se realizaron envíos en este encargo. No se cambia el catálogo de RC por analogía con la factura ni se amplía el alcance a sus cambios normativos futuros.

### Verificación final y archivos por frente

Corrida completa final back: **311 suites / 2907 pruebas / 12 snapshots aprobados**, con 4 suites / 38 pruebas omitidas como en la base. PostgreSQL local desechable habilitado; SUNAT real deshabilitado. Front completo: **131 suites / 947 pruebas aprobadas**. Bases de fase 0: back 307 suites / 2806 pruebas / 12 snapshots; front 130 suites / 943 pruebas. Las pruebas nuevas suman 101 casos back y cuatro front.

Build back `npx nest build` y build front `npm run build` aprobados. Lint back sin errores, con las dos advertencias preexistentes de respaldos vacíos de spread en servicios de resúmenes de 8C; lint de todos los archivos front cambiados aprobado sin advertencias. El ferry contiene exactamente los cinco archivos front probados, más el manifiesto FERRY.md. El control final de alcance no muestra cambios de código fuente fuera de `src/modules/invoices`.

#### D1 — archivos back

- `src/modules/invoices/application/dto/createInvoiceDto.ts`
- `src/modules/invoices/application/services/creationGuards.ts`
- `src/modules/invoices/application/services/emitirComprobanteAdapter.ts`
- `src/modules/invoices/freeInvoicePolicy.ts`
- `src/modules/invoices/ublGeneratorService.ts`
- `test/unit/invoices/8d-free-creation.spec.ts`

#### D2 — archivos back

- `src/modules/invoices/application/services/emitirComprobanteAdapter.ts`
- `src/modules/invoices/ublTaxBlocks.ts`
- `src/modules/invoices/ublTotalesHelper.ts`
- `test/fixtures/8d-no-icbper-hashes.json`
- `test/fixtures/8dFiscalHarness.ts`
- `test/unit/invoices/8d-icbper.spec.ts`
- `test/unit/invoices/m1-money.spec.ts`

#### D3 — archivos back

- `src/modules/invoices/xmlNodesHelper.ts`
- `test/unit/invoices/8d-exempt-percent.spec.ts`

#### D4 — archivos back

- `test/unit/invoices/8d-summary-parity.spec.ts`
- `docs/m1/auditoria-solucion.md`

#### D1 — archivos front (ferry)

- `src/modules/invoices/components/InvoiceItemsGrid.tsx`
- `src/modules/invoices/lib/invoiceItems.ts`
- `test/unit/modules/invoices/inventoryProductsApi.test.ts`
- `test/unit/modules/invoices/invoice8dFree.test.tsx`
- `test/unit/modules/invoices/invoiceItemsLayout.test.tsx`

D2, D3 y D4 no modifican archivos del producto front. FERRY.md añade únicamente el manifiesto e instrucciones de traslado y los SHA-256 finales de los cinco archivos front.

## Parte 8E — presentación

Base back `76e043eb4d0b9dd1cbf20af34d898e35c81cc440`; front `1f03cbd73026f79f53c303162f5299996b369d9e`. Orden de construcción E1, E2, E3 y E4. Los cambios de producto front se entregan por ferry. Sin emisiones reales, PRs ni migraciones.

### E1 — corrección fronteriza autorizada en Inventario

Se autoriza expresamente el ajuste aditivo y compatible de Inventario por su efecto directo sobre M1. Las vistas de Kardex y movimientos usan un formateador de representación que conserva un número completo y añade la serie cuando recibe un correlativo suelto. Se conservan los fallbacks de cada vista y las referencias manuales completas. Los exportadores separan el prefijo únicamente cuando coincide con la serie declarada; los PLE 12.1/13.1 reciben el número sin la serie duplicada. No se modifica document_number guardado, el contrato persistido de M1, la lógica de movimientos, el costo ni el saldo. La composición se reutiliza en las vistas relacionadas y en los CSV/PLE front. Diez regresiones back prueban ambos PLE y la ausencia de mutación de sus inputs; siete front cubren formatos, fallbacks y el render real del Kardex.

### E2 — glosa de reversión de venta

El asiento nuevo de una NC tipo 07 usa «Reverso de venta según…». Las ventas de otros tipos, el cliente por defecto, el máximo de 200 caracteres y la elipsis conservan su comportamiento. No cambian importes, cuentas, claves de idempotencia ni la glosa de reversión de costo. El asiento 63 histórico conserva su glosa: no se renombra ningún asiento guardado. Siete regresiones ejercitan la generación del asiento y el reconocimiento de un asiento ya existente.

### E3 — edición coherente del valor unitario

El campo muestra y rotula valor unitario sin IGV; en gratuitas muestra el valor referencial. Al editar esa base, actualizarItem deriva el precio con la afectación de la línea: gravada onerosa × 1.18, exonerada/inafecta igual a la base; gratuita conserva precio cobrado cero. Se mantiene la conversión inversa de un cambio explícito de precio y la precisión unitaria existente. Catálogo y precargas de notas actualizan total y payload de forma coherente. La grilla gratuita de 8D mantiene referencia editable e ICBPER independiente. No se relajan las guardas comerciales del servidor. Las expectativas anteriores de etiqueta/precio mostrado se adaptan al contrato de base sin IGV, conservando la intención de los controles.

### E4 — invalidación conjunta de identidad confirmada

Al editar documento o razón social de un cliente previamente seleccionado, el formulario conserva lo que se escribe y limpia el dato complementario de esa selección y su identidad/condiciones comerciales. Página y modal reutilizan la misma función de transición; el modal también retira tipo documental y dirección de la identidad anterior. La entrada manual sin selección previa conserva sus dos campos y no se transforma en una selección implícita. No cambia la identidad histórica de una nota vinculada deshabilitada. El componente CustomerLookupField, el debounce, la coincidencia campo/texto y el descarte de respuestas antiguas permanecen sin modificaciones.

Siete regresiones nuevas recorren ambos formularios, solicitudes pendientes, edición de documento/nombre, entrada manual y respuestas invertidas. La batería focal conjunta de clientes pasa veinte casos. Se corrige la incoherencia reproducida de nombre nuevo con RUC anterior; no se presenta como reproducido ni corregido un flash de sugerencias antiguas distinto de ese caso.

### Verificación y archivos de la Parte 8E

Corridas completas finales: **back 314 suites / 2931 pruebas / 12 snapshots aprobados**, con 4 suites / 38 pruebas omitidas; **front 134 suites / 967 pruebas aprobadas**. Bases: back 312 suites / 2914 pruebas / 12 snapshots y front 131 suites / 947 pruebas. PostgreSQL local desechable habilitado para las integraciones; no se habilitó SUNAT real.

Build back `npx nest build` y build front `npm run build` aprobados. Lint back sin errores, con las dos advertencias anteriores de 8C. En los archivos front incluidos, lint mantiene seis errores y cuatro advertencias que ya tenía la base; se compararon por archivo, regla y severidad, sin diagnósticos nuevos. Se conserva esa deuda previa de efectos React y tipos any de pantallas existentes, sin correcciones incidentales ni supresiones.

Un commit back por frente; E3/E4 son documentales porque su producto cambia únicamente en el front. Ferry con un commit de producto por cada frente que lo requiere (E1/E3/E4), incorporando FERRY.md al cierre E4. Los dieciocho archivos front del manifiesto son idénticos al árbol probado. Sin datos históricos renombrados ni modificaciones de la lógica de movimientos; sin emisiones reales, PRs, migraciones o columnas nuevas.

#### E1 — archivos back

- `src/modules/inventory/infrastructure/adapters/ple12_1FlatFileWriterAdapter.ts`
- `src/modules/inventory/infrastructure/adapters/ple13_1FlatFileWriterAdapter.ts`
- `src/modules/inventory/presentation/documentReference.ts`
- `test/unit/inventory/8e-document-reference.spec.ts`

#### E2 — archivos back

- `src/modules/invoices/application/services/invoiceAccountingBridgeService.ts`
- `test/unit/invoices/8e-sale-reversal-description.spec.ts`

#### E3 — archivos back

- `docs/m1/auditoria-solucion.md`

#### E4 — archivos back

- `docs/m1/auditoria-solucion.md` (cierre de auditoría y verificación).

#### E1 — archivos front (ferry)

- `src/modules/inventory/components/MovementDetailModal.tsx`
- `src/modules/inventory/components/PleExportModal.tsx`
- `src/modules/inventory/lib/documentReference.ts`
- `src/modules/inventory/pages/ElectronicBooksPage.tsx`
- `src/modules/inventory/pages/InventoryConfigPage.tsx`
- `src/modules/inventory/pages/InventoryKardexPage.tsx`
- `src/modules/inventory/pages/InventoryMovementsPage.tsx`
- `src/modules/inventory/pages/ProductKardexPage.tsx`
- `test/unit/modules/inventory/inventory8eDocumentReference.test.tsx`

#### E3 — archivos front (ferry)

- `src/modules/invoices/components/InvoiceItemsGrid.tsx`
- `src/modules/invoices/lib/invoiceItems.ts`
- `test/unit/modules/invoices/invoice8eUnitValue.test.tsx`
- `test/unit/modules/invoices/invoiceItemsLayout.test.tsx`
- `test/unit/modules/invoices/invoiceNotasLineasOrigen.test.tsx`

#### E4 — archivos front (ferry)

- `src/modules/invoices/components/InvoiceEmitCampos.tsx`
- `src/modules/invoices/lib/invoiceCustomerIdentity.ts`
- `src/modules/invoices/pages/InvoiceEmissionPage.tsx`
- `test/unit/modules/invoices/invoice8eCustomerIdentity.test.tsx`

E2 no necesita archivos front. E3 y E4 son correcciones de producto exclusivamente front; sus commits back son documentales. FERRY.md contiene el manifiesto completo de los dieciocho archivos front y sus SHA-256, y se añade al cierre E4 del ferry.

## Parte 8F — higiene y robustez

Bases de construcción: back main `7faef9767949c91666d9267561694f14acd2c58f`; front main `dc626d34234334a4a1026d0c6460d5382a62a162`. Sin migraciones, columnas nuevas, emisiones reales ni modificación de datos históricos. Los cambios de front se entregan por ferry.

- **F1:** se conservan ambos clasificadores de CDR, que se complementan. Se retiran exclusivamente `getStatusCdrLegacy`, sus imports TA-28 y la operación sin llamadores operativos; TA-30 permanece intacta.
- **F2:** SFS oficial es el único motor del validador y del diagnóstico de disponibilidad. Se retiran el árbol XSL legado y el selector `SUNAT_XSL_DIR`; conservar una variable antigua ya no selecciona otro motor. Las regresiones usan las hojas del juego SFS oficial. La indisponibilidad del motor sigue bloqueando el envío.
- **F3:** el bypass demo exige NODE_ENV development/test explícito y contexto MOCK local. La omisión solo se autoriza después del registro durable AVISO_DEMO; un fallo de auditoría se propaga. BETA y PRODUCCION no admiten bypass.
- **F4:** los endpoints mutantes de M1 que carecían de guarda exigen ADMIN u OPERADOR_FACTURACION. Las acciones ya exclusivas de ADMIN conservan ese alcance. AUDITOR mantiene lectura y vista previa de baja; la descarga de XML de auditor entrega el archivo existente sin regenerar ni persistir uno ausente. El login de un clic no recibe excepciones por ser demo.
- **F5:** el alta de series usa DTO validado y los filtros/paginado rechazan valores no escalares con 400 y mensaje específico. Los fallos internos genuinos no se convierten en errores de entrada.
- **F6:** el chequeo puro compartido, antes de reservar número, valida los máximos oficiales de los nodos serializados: descripción y motivo 500, nombres comerciales/razones sociales 1500, AddressLine 200, ciudad/departamento/distrito 30 y orden de compra 20. No hay recortes silenciosos ni topes nuevos para textos sin máximo identificado. PostgreSQL verifica ambas rutas sin avance de serie, documento ni publicación ante descripción sobredimensionada.
- **F7:** la reserva conserva el mismo UPDATE atómico y añade el límite de 99999999. El agotamiento responde 409/SERIE_AGOTADA; alta/reactivación valida el correlativo inicial y no reinicia series usadas. El endpoint y la presentación del siguiente número no anuncian un noveno dígito. La regresión PostgreSQL concurrente acredita una última reserva válida y un bloqueo.
- **F8:** se corrigen las garantías documentales de precios de notas, clasificación de transporte y alcance de la reserva en RECHAZADO. La deuda XSL original queda cerrada por TA-70; resúmenes reflejan el trabajo de Parte 2; ACTIVO/HABIDO del padrón RUC sigue abierto y separado del padrón de retención.
- **F9:** datosPdf prefiere DigestValue del XML conservado. payload.hashCpe queda solo como respaldo cuando ese XML no está disponible. Se conservan los dos generadores de PDF y no se modifica la trama QR, la fecha ni su padding. **Verificación abierta:** contrastar la paridad de ambas representaciones y su normalización con el anexo aplicable de SUNAT; las pruebas internas no equivalen a esa certificación normativa.
- **F10:** solo el precio alternativo calculado conserva hasta cinco decimales; los importes monetarios y el precio neto de notas conservan su precisión previa. El caso exacto 37.17 mantiene el XML completo y su SHA-256 previo al cambio. Las regresiones de cantidades 3/7 y descuentos 00/01/global pasan SFS local; no se reescriben XML guardados.
- **F11:** el importador de agentes de retención exige ruta explícita y rechaza el CSV de ejemplo, enlaces al mismo y copias de contenido idéntico antes de abrir conexión a base. No se ejecutó la siembra ni se importaron datos. **Deuda de datos abierta:** acreditar procedencia oficial, fecha de actualización y vigencias del padrón efectivo; aceptar una ruta no certifica su contenido. El contenido productivo no se deduce del ejemplo versionado. Se conserva la decisión manual auditada cuando falta dato vigente y no se modifica el maestro existente.

### Validación final de Parte 8F

Corrida completa back con PostgreSQL local y conexión beta real deshabilitada: **321 suites aprobadas / 4 omitidas (325 totales); 2998 pruebas aprobadas / 38 omitidas (3036 totales); 12 snapshots aprobados**. Front completo: **135 archivos / 970 pruebas aprobadas**. Build Nest del back, typecheck `tsc -b` y build Vite del front aprobados. Lint del back sin errores; conserva dos avisos previos en el coordinador/almacén de resúmenes, fuera de los archivos modificados.

La corrida completa final del back se ejecutó con heap Node de 6 GB y sin la carga simultánea del front: el primer intento agotó el heap de 2 GB y había reportado un fallo de latencia del outbox. La corrida final conserva el umbral de esa prueba y pasa sin cambios en ella. Los cambios se distribuyen en un commit por frente; el ferry solo contiene la presentación de agotamiento de F7, su regresión y el manifiesto de archivos con SHA-256.

## Formularios de M1: validaciones compartidas

Bases sincronizadas: back `d5115adc109e311a29f84b86203028887f8f0118`; front `73af439c48d1e8937133b52f8b525bbecfe7540f`. Línea base completa: back 321 suites aprobadas y 4 omitidas, 2998 pruebas aprobadas y 38 omitidas, 12 snapshots; front 136 archivos y 972 pruebas aprobadas.

### Grupo 1 — Contenido de emisión

Página y modal comparten las validaciones de identidad del cliente, descripción (500), razón social (1500), cantidad positiva con hasta tres decimales y valor oneroso positivo. Se conserva la excepción explícita de notas y documentos íntegramente gratuitos. Un descuento global que deja un documento oneroso en cero bloquea el envío con error visible. No se modifica el back ni el circuito ICBPER. Verificación focal: 46 pruebas aprobadas y typecheck del front.

### Grupo 3 — Series y configuración

La pantalla valida las series según el tipo documental, incluidos FC/BC/FD/BD, y limita el correlativo inicial a 99999999; la vista previa no ofrece un noveno dígito. El writer y el formulario del emisor comparten máximos de domicilio 200 y departamento/provincia/distrito 30; ubigeo y local anexo se conservan como texto de seis y cuatro dígitos. No hay cambios de esquema ni de numeración atómica. Verificación focal: 51 pruebas del back y 20 del front aprobadas.

### Grupo 4 — Depósitos de detracción

El editor monetario admite importes positivos con dos decimales como máximo y hasta la detracción del comprobante; muestra el error junto al monto y bloquea Guardar. El servicio rechaza subcéntimos con 400 antes de escribir, sin redondearlos, y reutiliza la validación ISO estricta de cuotas. Se mantienen las reglas de constancia y fechas anteriores/futuras. Verificación focal: 17 pruebas del back y 10 del front aprobadas.

### Grupo 5 — Maestro compartido de clientes y proveedores

La validación documental ya no queda anulada para tipos distintos de RUC: DNI exige ocho dígitos, RUC once y módulo 11, CE/TAX ID conservan documentos alfanuméricos no vacíos. La guarda aditiva del servicio cubre también llamadas sin ValidationPipe; las actualizaciones parciales validan solo campos aportados. Razón social y nombre comercial aportado no pueden estar vacíos ni superar 200 caracteres; país tiene dos caracteres y email formato válido. Nombre comercial y email siguen siendo opcionales. La pantalla reutiliza el mismo validador de email que el back y bloquea guardar valores inválidos. No se amplía el contrato ni se reescriben datos históricos. Se sustituye un RUC ficticio inválido en la prueba previa de duplicados por uno válido, conservando sus aserciones. Verificación focal: 34 pruebas del back y 16 del front aprobadas.

### Grupo 6 — Período y filtros

PeriodInput conserva un borrador de edición inválido sin propagarlo: año entero de cuatro dígitos y mes 1–12, sin el antiguo rango arbitrario 2000–2100. Bandeja y reporte de ventas muestran el error de Desde/Hasta y no consultan un rango invertido; se permiten rangos amplios sin imponer un máximo de días. Las guardas del back se conservan como autoridad. La prueba anterior de separación de notas usa ahora un rango válido que excluye sus documentos, manteniendo las aserciones de ambas secciones. Verificación focal: ocho pruebas aprobadas.

El grupo 2 (bolsas e ICBPER) permanece fuera de construcción. La auditoría adicional identifica una línea sintética con SKU ICBPER que el contrato comercial rechaza si no existe en el catálogo; su solución requiere confirmación conjunta con ese grupo. No se crean productos, no se omiten líneas ni se relajan guardas. Tampoco se construyen cambios en el hook de atajos o navegación desde resúmenes; el paso nativo de cantidad sí se corrige como parte del grupo 1 autorizado.

### Validación final de formularios

Back completo con PostgreSQL local y conexión beta real deshabilitada: **322 suites aprobadas y 4 omitidas (326 totales); 3034 pruebas aprobadas y 38 omitidas (3072 totales); 12 snapshots aprobados**. Front completo: **141 archivos y 1030 pruebas aprobadas**. Builds Nest y Vite, y typecheck del front `tsc -b`, aprobados. Lint del back y lint focal del front sin errores; conservan avisos previos fuera de la lógica añadida. Sin migraciones, emisiones reales ni PRs.

El ferry `ferry/m1-formularios-validacion` parte de `73af439c48d1e8937133b52f8b525bbecfe7540f`; FERRY.md contiene los archivos por grupo y sus 29 SHA-256 verificados. La rama de construcción del back es `fix/m1-formularios-validacion`. La promoción y batería en vivo quedan fuera de esta ejecución.

## Pantalla de emisión y acceso desde agregados

Bases sincronizadas: back `d5115adc109e311a29f84b86203028887f8f0118`; front `73af439c48d1e8937133b52f8b525bbecfe7540f`. La promoción de formularios aún no está en estos main: esta construcción parte de main y no incorpora aquel tren.

### B1 — Bolsas sobre líneas registradas

La cantidad de bolsas y su ICBPER se declaran sobre la línea del producto, sin fabricar SKU ni precio. El botón suma una bolsa al producto seleccionado en la grilla; se retira el auxiliar de cabecera que no viajaba por sí solo. Cantidad entera no negativa, impuesto derivado y coincidencia validada antes del envío; no se truncan fracciones. La cantidad de productos sigue siendo independiente de las bolsas entregadas. Se retira la excepción de catálogo que presentaba el SKU sintético desconocido como conforme. El contrato API certificado y las guardas del back no cambian. Verificación focal: 21 pruebas del front aprobadas, incluidas ambas vías de emisión con producto elegido del catálogo y payload cantidadBolsas=2/icbper=1.

El contraste de la auditoría antigua conserva deudas fuera de B1–B3: selector Crédito para boleta aunque el XML no declara PaymentTerms; PDF local de fila con numeración a cuatro dígitos y detalle vacío (ya usa DigestValue del XML firmado, no el hash hexadecimal alegado); etiqueta CDR sobre exportación CSV RVIE; y adición de segunda fila en modal frente a reemplazo de vacío en página. El toggle gratuito, su catálogo y la excepción de stock quedaron resueltos por 8D y su corrección; no se relajan guardas ni se cambia la afectación heredada onerosa.

### B2 — Atajos con ámbito de página

Alt+C, Alt+P y Alt+L se reconocen por key/code desde cualquier foco de la página de emisión; Alt+P usa una marca estable del buscador real. Ctrl+Enter abre la revisión y confirmar conserva requestSubmit y las validaciones del formulario. No se captura el atajo de la página cuando hay un diálogo abierto; el modal conserva su ámbito propio. El listener se elimina al desmontar y no duplica acciones al recibir eventos dentro del formulario. Verificación focal: siete pruebas aprobadas, incluida confirmación con un único POST simulado. No se cambia la navegación inicial con flecha arriba, deuda separada de este encargo.

### B3 — Miembros del agregado y acceso al comprobante

El listado de RA/RC proyecta de forma aditiva los miembros como id, número fiscal completo, tipo, monto y estado actual del comprobante. Una sola consulta en lote contrasta los ids del snapshot contra comprobantes de la misma empresa; no se exponen los datos adicionales del JSON ni se reutilizan montos/estados no acreditados del snapshot. Miembros inexistentes o ajenos no se proyectan. Los controles de ticket, sondeos, incertidumbre y reversión pendiente se conservan.

La tarjeta muestra los miembros y permite abrir el detalle existente por id, consultado desde el back, con error visible si no está disponible; no se fabrica un detalle ni se depende de que el comprobante esté en la página actual de la bandeja. Durante la carga se bloquean aperturas simultáneas. Verificación focal: 40 pruebas del almacén del back y cinco del Monitor del front aprobadas. No hay migración ni modificación del envío fiscal.

### Validación final de B1–B3

Back completo con PostgreSQL local y conexión beta real deshabilitada: **321 suites aprobadas y 4 omitidas (325 totales); 3001 pruebas aprobadas y 38 omitidas (3039 totales); 12 snapshots aprobados**. Front completo final: **139 archivos y 986 pruebas aprobadas**; el typecheck identificó el número obligatorio ausente en el fixture nuevo de miembros, que se completó sin modificar aserciones; se repitió la corrida completa sobre ese fixture final. Builds Nest/Vite y `tsc -b` aprobados. Lint del back y focal del front sin errores; el back conserva dos avisos previos en el área de resúmenes.

Ramas `fix/m1-bolsas-atajos-resumenes` y `ferry/m1-bolsas-atajos-resumenes`, un commit por arreglo en cada rama. Los commits B1/B2 del back son documentales: su construcción funcional es de front. FERRY.md incluye SHA-256 verificados de 20 archivos únicos (21 entradas por compartir la página entre B1 y B2) y detalla la base pendiente de promoción de formularios. No se ejecutaron emisiones reales, migraciones ni PRs. La certificación en vivo queda para la promoción posterior.

## Integración B1–B3 sobre main con formularios y SIRE

Cabezas verificadas antes de construir: back main `4e21f3e3583dc8c892d53a47788499ee116cae09`, front main `39d55f3a08d25cce5a5aafa7af8c744b89e659a0`, back fuente `199c0f1a3bd35981b8ad9622afae70e869ff09fd` y ferry fuente `2d20be2389bbb6482b6199e835b0aa506f0ad56b`. Las secciones anteriores describen construcciones históricas; esta integración incorpora ambos comportamientos sobre los main actuales.

Se porta el delta original, sin reconstruir B1–B3. Rama back `fix/m1-bolsas-atajos-resumenes-int`; transporte front `ferry/m1-bolsas-atajos-resumenes-int` en el repositorio back. Los archivos funcionales del back coinciden con la fuente. Los archivos front sin solape también coinciden con la fuente y los archivos ajenos al cambio conservan el main actual. SIRE y el esquema permanecen idénticos a main.

| Archivo con solape | Resolución |
|---|---|
| `docs/m1/auditoria-solucion.md` (back) | Se conservan las secciones de formularios y B1–B3; esta sección registra la integración sobre las bases actuales. |
| `src/modules/invoices/components/InvoiceEmitModal.tsx` | Se mantiene `problemasContenidoEmision`; el botón de bolsas actualiza la línea elegida mediante `actualizarItem`. |
| `src/modules/invoices/components/InvoiceItemsGrid.tsx` | Se conservan `cantidadValida`, máximo 500, paso 0.001 y avisos de validación; las bolsas usan cantidad entera no negativa y selector de producto. |
| `src/modules/invoices/lib/invoiceItems.ts` | Se conservan Decimal, límites de descripción y precisión; se añaden `cantidadBolsas`, validación y sincronización del impuesto. |
| `src/modules/invoices/pages/InvoiceEmissionPage.tsx` | Se mantiene el validador compartido; se añade el ámbito de página al hook y se reemplaza el alta de línea sintética por actualización de bolsas del producto. |

| Suite | Línea base | Integrada |
|---|---|---|
| Back Jest | 326 aprobadas / 4 omitidas; 3139 pruebas aprobadas / 38 omitidas | 326 aprobadas / 4 omitidas; 3142 pruebas aprobadas / 38 omitidas |
| Front Vitest | 141 archivos / 1030 pruebas aprobadas | 144 archivos / 1044 pruebas aprobadas |
| Back E2E | 3 aprobadas / 4 fallidas / 1 omitida; 11 pruebas aprobadas / 21 fallidas / 10 omitidas | Mismos conteos y mismas pruebas fallidas |

Jest conserva 12 snapshots aprobados. Las cuatro suites opcionales omitidas son agregados (20 pruebas), configuración del emisor (10), búsqueda de terceros (7) y conexión real SUNAT beta (1). E2E falla previamente en los dobles de cola de auth, customs, invoices e invoiceQuery: falta `registerSirePeriodsWorker`. No se modifica SIRE ni se corrigen esos dobles en esta integración. No hay fallos nuevos.

Builds Nest y Vite, incluido `tsc -b`, aprobados. Lint back: cero errores y dos avisos previos. Lint focal front: los mismos dos errores `react-hooks/set-state-in-effect` y un aviso `react-refresh/only-export-components` que en main, verificados sobre un worktree de la base exacta.

```sh
# Back: PostgreSQL local aislado con las migraciones existentes aplicadas.
NODE_OPTIONS=--max-old-space-size=6144 TEST_DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/sunat_test RUN_INTEGRATION_TESTS=required RUN_SUNAT_BETA_INTEGRATION=false npm test -- --runInBand --json
TEST_DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/sunat_test RUN_SUNAT_BETA_INTEGRATION=false npm run test:e2e -- --runInBand --setupFiles="$PWD/test/setup.ts" --json
# Front
npm test -- --reporter=json
# Ambos repos
npm run build
```

FERRY.md contiene los veinte SHA-256 finales del front. No se abren PRs, no se despliega y no se ejecutan emisiones reales.

## RUC propio del emisor M1

Sobre back main `40b77ce9f15bd72207f1e085087610ab5ddadc8e` y front main `ee5086b592761632ed4d2ebbdbb12fb5e497544f`, M1 permite fijar `companies.issuer_ruc` sin cambiar `companies.ruc`, compartido con SIRE. Sin pin se conserva el RUC de empresa. La identidad efectiva se reutiliza en contexto/SOL, emisión/UBL/persistencia, guarda API y cabeceras/snapshots RA/RC; el writer valida el certificado contra esa identidad. GET informa `ruc`, `origen_ruc` y el origen en el checklist, sin redefinir el origen de SOL o certificado.

El pin acepta exclusivamente once dígitos numéricos, sin módulo 11: omitido conserva, null retira, vacío se rechaza y reset de credenciales conserva el pin. `CreateInvoiceDto.ruc_emisor` sustituye `IsRucValid` por el patrón `^[0-9]{11}$`; la guarda de identidad efectiva sigue rechazando RUC ajenos antes de numerar. No se cambia el validador compartido ni el RUC de clientes. El PDF y QR del back conservan el RUC histórico de cada comprobante.

El front modifica únicamente tres consumidores de producción de M1: identidad de exportación, PDF local y QR del modal. Consulta `/invoices/config`, usa `config.ruc` y recurre a la sesión si la configuración no responde; descarta respuestas de otra sesión. El formulario sigue de solo lectura para el RUC. La entrega se transporta por `ferry/m1-ruc-emisor-propio` en el repositorio back, con hashes en FERRY.md.

Migración aditiva pendiente de aplicación compartida: `prisma/migrations/20261112190000_m1_issuer_ruc/migration.sql`. SQL exacto: `ALTER TABLE "companies" ADD COLUMN "issuer_ruc" VARCHAR(11);`. SHA-256: `7fc7787c92bea3da0decee43d928f82cd6e2c5c43d5c4c6c86757f43eebad5c4`. No contiene default, relleno ni UPDATE. Solo se probó en PostgreSQL local aislado; no se aplicó a la base compartida. Ante la deriva informada, aplicar el SQL revisado y registrar la migración/checksum antes de desplegar el nuevo cliente Prisma; no ejecutar reset ni promover migraciones pendientes ajenas.

Línea base: back 326 suites aprobadas, 4 omitidas; 3155 pruebas aprobadas, 38 omitidas; 12 snapshots. Front 150 archivos y 1091 pruebas aprobadas. Final: back 327 suites aprobadas, 4 omitidas; 3191 pruebas aprobadas, 38 omitidas; 12 snapshots. Front 151 archivos y 1105 pruebas aprobadas. Regresiones nuevas: 36 back y 14 front, incluyendo certificado/firma ficticios, writer/HTTP, ambas rutas de creación, RA/RC, históricos y respaldo/cambio de sesión del front. Cobertura local del código nuevo del back: 100% de 24 líneas ejecutables y 39 ramas. Builds Nest/Vite y typecheck aprobados; lint back sin errores (dos avisos previos) y lint focal front sin errores. Sin archivos de SIRE modificados, PRs, despliegues ni emisiones reales.

## Parte 9

Bases: back `c8de3d557d648a5477c7493813ca48c8266551e2`; front `3bc4cdb01dd60ca1ac3da0667add12a6fb1810b2`. El main aprobado del back contiene cambios de Compras respecto de `fbcdc67f`, sin diferencias en invoices. La línea base se volvió a ejecutar sobre c8de3d55.

### Correcciones del back

- **B1:** ventas, base e IGV usan signo negativo para 07 y positivo para 01/03/08, también en cada agrupación. La utilidad usa base con signo menos costo únicamente cuando existe asiento de costo; los documentos y grupos sin costo muestran null. El margen usa la base de los documentos con costo; `withoutCost` cuenta exclusivamente 01/03 sin asiento. La UI y el CSV distinguen «Sin costo» de utilidad cero.
- **B2:** BillingReference usa `referenced_document_type` persistido cuando es 01/03, con respaldo por serie B/F. Se conserva el dato en generación del worker y regeneración de descarga.
- **B3:** el controlador de detracciones se registra antes del controlador genérico `GET :id`. El listado limita estados a ACEPTADO/OBSERVADO y detracción positiva; no cambia el POST del depósito. Una prueba HTTP usa el orden real de controladores declarado en el módulo.
- **B4:** ADMIN y OPERADOR_FACTURACION pueden enviar RA/RC, en coherencia con la consulta del agregado.
- **B5:** notas 07/08 con motivo distinto de 13 se normalizan a Contado y cuotas vacías antes de adaptación fiscal y guardas de crédito. Motivo 13 conserva PaymentTerms.
- **B6:** débito usa «Cargo según…»; crédito conserva «Reverso de venta según…» y 01/03 «Venta según…».
- **B7:** el PDF oficial recibe cuotas y cuenta Banco de la Nación del payload.
- **B8 (construcción inicial, sustituida por la corrección 3105 documentada más abajo):** solo facturas 01 íntegramente gratuitas con bolsas expanden su XML mediante una línea ICBPER separada; se retiran impuesto y cantidad de bolsas de las líneas gratuitas originales. No se modifica el payload persistido ni se crea un producto de inventario. PayableAmount conserva S/ 0.50 por bolsa. Las representaciones gravada+bolsas y mixta conservan sus huellas XML. Boletas 03 íntegramente gratuitas con bolsas se rechazan antes de numerar con código `BOLETA_GRATUITA_CON_BOLSAS_NO_ADMITIDA` y mensaje «Una boleta íntegramente gratuita no admite bolsas plásticas. Retire las bolsas o emita una factura.». La alternativa separada provoca 3105 en el validador 03 y la embebida puede provocar 3236 por diferencia de cantidades; las gratuitas sin bolsas y las onerosas no cambian.

### Correcciones del front

F1/F2/F7: notas con fecha propia y cliente del origen, herencia de pago solo para NC13; boletas siempre Contado; borrador inicial vacío y primer producto reemplaza esa fila. F3: permisos compartidos en ruta y controles operativos, con bloqueo y explicación para roles sin permiso de facturación. F4: pertenencia DLQ por historial independiente del origen de presentación. F5: precios coherentes con afectación, sin cobrar IGV en exoneradas/inafectas. F6/F14: catálogo completo de detracciones vigentes y motivos alineados con `noteCatalogs.ts` del back.

F8: PDF de fila usa descarga oficial del back; QR reproduce estrictamente InvoiceQrService: correlativo sin padding, fecha DD-MM-AAAA, importes con dos decimales, dos sustituciones del digest en el mismo orden y separador final. El servicio QR del back no cambia. **Deuda conservada:** contrastar la paridad normativa fina con el anexo SUNAT en una parte posterior.

F9: ICBPER visible como concepto separado en el resumen; en boletas íntegramente gratuitas se bloquean botón y celda de bolsas con el mismo mensaje del back, y la validación anterior al POST impide enviar bolsas ya presentes en el borrador. F10/F11: KPI sin «Acreditado 0» en la vista sin notas y descarga del periodo rotulada «Exportar propuesta RVIE - SIRE (CSV)»; no cambia ningún código de SIRE. F12/F13: referencia gratuita y descuento global visibles; consulta SUNAT oculta para serie B y preparación local. F15: terceros validan DNI/RUC también en edición, con las mismas reglas del alta.

### Verificación

| Suite completa | Línea base | Final |
|---|---|---|
| Back Jest | 328 suites / 3194 pruebas aprobadas | 335 suites / 3225 pruebas aprobadas |
| Front Vitest | 151 archivos / 1105 pruebas aprobadas | 155 archivos / 1153 pruebas aprobadas |

El back conserva cuatro suites y 38 pruebas opcionales omitidas y 12 snapshots aprobados. Invoices unitario: 130 suites / 1973 pruebas en la base; 137 suites / 2004 pruebas finales. Se añaden 31 pruebas back y 48 front. No hay regresiones de aserciones.

Cobertura local de código nuevo, comparada con las bases exactas (líneas ejecutables y ramas instrumentadas intersectadas con líneas añadidas): back **43/43 líneas y 87/87 ramas, 100%**; front **48/48 líneas y 142/142 ramas, 100%**. Informes originales: Jest/Istanbul `coverage-final.json` y Vitest/V8 `coverage-final.json`. No es una afirmación sobre la cobertura global del repositorio ni una ejecución del Quality Gate remoto.


Se ejecuta SFS local con certificado ficticio para una y dos unidades gratuitas con una bolsa, sin errores. Las huellas SHA-256 de fixtures gravado y mixto fijan compatibilidad estructural; no son reenvíos de los documentos beta F001-73/F001-74. El cálculo de utilidad esperado 2297.96 − 1636.00 = 661.96 coincide con la fórmula implementada. No se accedió al dataset compartido del periodo 2026-11-01..12: los valores de ventas 7265.01 y 41 documentos requieren contraste de lectura con ese dataset después de integrar; no se presentan como resultados obtenidos localmente.

Sin migraciones ni cambios de SIRE, PRs, merges, despliegues o emisiones reales. Las pruebas usan PostgreSQL aislado, certificados ficticios y transportes locales/mocks; la integración real SUNAT beta permanece deshabilitada. Entrega del front exclusivamente mediante `ferry/m1-parte9-cierre` en el repositorio back, con archivos finales y manifiesto SHA-256 en FERRY.md.

### B8 — corrección del rechazo 3105 mediante partición del producto gratuito

Base de la corrección: `dev` en `88cfeabc75ea97250a690cee1e8b418be6c449cf`. La batería en vivo del 12 de noviembre de 2026 reportó F001-00000079 rechazado por SOAP Fault 3105 del billService, ticket `1794529417139`, en la línea 2 separada de ICBPER. No hubo CDR en ZIP; los campos CDR permanecieron nulos. F001-00000073, gravada con ICBPER incrustado, estaba aceptada. Los XML completos suministrados pasan ambos el SFS distribuido local, lo que confirma la diferencia frente al servidor beta. La misma batería reportó detracciones operativas y ventas de 7265.01 para 41 documentos; esos resultados proceden de la batería desplegada, no de un acceso local a la base compartida.

**Predicados oficiales de contraste.** En `assets/sunat-sfs/commons/xsl/validation/2.X/ValidaExprRegFactura-2.0.1.xsl:3239`, 3105 evalúa en cada TaxTotal de línea:

```xpath
count(cac:TaxSubtotal/cac:TaxCategory/cac:TaxScheme/cbc:ID[
  text() = '1000' or text() = '1016' or text() = '9995' or
  text() = '9996' or text() = '7152' or text() = '9997' or text() = '9998'
]) < 1
```

La línea rechazada satisface esa versión: contiene 1000 y 7152, aunque la base IGV sea cero. El modelo estricto utilizado como contraste procede de `ValidaExprRegBoleta-2.0.1.xsl:3817`:

```xpath
count(cac:TaxSubtotal[
  cac:TaxCategory/cac:TaxScheme/cbc:ID[
    text() = '1000' or text() = '1016' or text() = '9995' or
    text() = '9996' or text() = '9997' or text() = '9998'
  ] and cbc:TaxableAmount > 0
]) < 1
```

Con este modelo F001-73 cumple y la línea 2 de F001-79 falla. No se afirma que este sea el código interno exacto del servidor. Para 3236, Factura:2888 compara `$CantidadBolsa != $CantProducto`, donde la primera variable es `cbc:BaseUnitMeasure` y la segunda `round($cntLineaProd)`. No se cambian los assets ni el ejecutor SFS.

**Construcción elegida.** Se retira exclusivamente la línea independiente que B8 añadía a las facturas 01 íntegramente gratuitas. Cada línea gratuita con cantidad q y b bolsas conserva producto, afectación y valor referencial unitario: b=0 queda sin partición; 0<b<q produce una línea con cantidad b e ICBPER incrustado y otra con q−b sin bolsas; b=q produce una sola línea con ICBPER incrustado. Los identificadores ordinales XML se renumeran. El ICBPER conserva 7152 y su monto 0.50×b; cada línea con bolsas tiene BaseUnitMeasure igual a su cantidad. La base positiva procede del producto gratuito original (9996), no de una bolsa valorada artificialmente; no se agrega otro bien, SKU, precio ni impuesto.

Las bases e IGV referenciales redondeados se conservan al céntimo: la segunda parte recibe el residuo respecto del importe original. Ese residuo es un metadato interno identificado por Symbol, exclusivamente entre la partición XML y el cálculo de referencia; no es un campo del DTO o del payload persistido y no puede introducirse mediante JSON. Se conservan las cantidades decimales, el valor unitario, TaxInclusiveAmount, PayableAmount y los totales tributarios del documento. Las representaciones gravada, exonerada, inafecta y mixta con bolsas conservan el patrón incrustado y sus hashes previos; las gratuitas sin bolsas tampoco cambian.

**Guarda anterior a numerar.** En facturas, una línea gratuita con bolsas mayores que su cantidad se rechaza con `BOLSAS_GRATUITAS_SUPERAN_CANTIDAD`: «Las bolsas de una línea gratuita no pueden superar la cantidad de la línea. Ajuste las bolsas o la cantidad.». La validación se comparte con la defensa de regeneración. Las pruebas de las entradas formulario y API fiscal verifican que no se reserva correlativo, no se crea comprobante y no se encola. El rechazo de boleta íntegramente gratuita con bolsas conserva exactamente `BOLETA_GRATUITA_CON_BOLSAS_NO_ADMITIDA` y su mensaje anterior. No se reescriben documentos guardados.

**Pruebas por el camino real.** Los datos de formulario pasan por `traducirEmision` y el payload resultante entra en `InvoiceJobConsumer.xmlDelComprobante`, con UblGeneratorService y XsdValidatorService reales. Se firma con certificado ficticio y se ejecuta el SFS local; el XML firmado coincide con la regeneración de InvoiceDownloadService, que utiliza el mismo generador. No se arma XML fiscal a mano. Además se extrae de los assets el predicado estricto de Boleta y se evalúa por línea, junto con la igualdad de 3236.

| Caso | Representación esperada | SFS Factura local | Contraste 3105 estricto / 3236 |
|---|---|---|---|
| a: gratuita ×1 + una bolsa | Una línea con bolsa incrustada; total 0.50 | Sin errores | Cumple / cumple |
| b: gratuita ×2 + una bolsa | Dos líneas de una unidad, solo una con bolsa; total 0.50 | Sin errores | Cumple / cumple |
| c: dos gratuitas, q=3/b=1 y q=4/b=2 | Cuatro líneas del producto; total 1.50 | Sin errores | Cumple / cumple |
| d: gratuita ×1 + dos bolsas | Rechazo anterior a numerar en ambas entradas | No se genera ni envía XML | Guarda de creación |

Se cubren también cantidades fraccionarias, bolsas legadas sin campo de cantidad, líneas sin bolsas dentro del documento, b=q, redondeo de referencia e IGV, afectaciones gratuitas 11/21/31 y ausencia de mutación del payload. Las siete huellas de regresión se capturaron antes del cambio desde la base indicada.

**Resultados locales finales.** Baseline completa: 336 suites / 3229 pruebas aprobadas. Final completo: 337 suites / 3252 pruebas aprobadas, sin fallos; cuatro suites y 38 pruebas opcionales omitidas en ambos, con 12 snapshots aprobados. Área unitaria invoices: 138 suites / 2006 pruebas → 139 suites / 2029 pruebas. Batería focal: cuatro suites / 117 pruebas aprobadas. Se añaden 23 pruebas, sin regresiones. Cobertura local de código nuevo respecto de dev `88cfeabc`: **28/28 líneas ejecutables y 26/26 ramas, 100%** (Jest/Istanbul, intersección de ubicaciones instrumentadas con líneas añadidas). Build Nest/TypeScript aprobado y lint sin errores, con dos avisos preexistentes en resúmenes.

Comando de suite completa: `NODE_OPTIONS=--max-old-space-size=6144 TEST_DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/sunat_test RUN_INTEGRATION_TESTS=required RUN_SUNAT_BETA_INTEGRATION=false npm test -- --runInBand --coverage --collectCoverageFrom=src/modules/invoices/freeBagXml.ts --collectCoverageFrom=src/modules/invoices/freeOperationReference.ts --collectCoverageFrom=src/modules/invoices/application/services/creationGuards.ts`. La base de pruebas es PostgreSQL local aislado. Build y suite se ejecutan secuencialmente para no regenerar el cliente Prisma mientras Jest lo lee.


**Límite de la validación:** el SFS local no garantiza aceptación del servidor SUNAT beta, cuya regla observada es más estricta que la hoja de Factura distribuida. La corrección también satisface el modelo estricto de contraste, pero el árbitro final será la reprueba en vivo posterior al despliegue, a cargo del equipo operador. En esta construcción no se realizan PRs, merges, despliegues, emisiones ni envíos reales. Sin cambios de front, SIRE ni esquema de base de datos.

## Mini-parte Notas ICBPER

Base fijada: `57e8905e9b0d87a43c9bd483379bf03cc0a3d3f7`. La auditoría en vivo informó un bloqueo local 3236 de FC01-00000020, sobre F001-00000081. El diagnóstico con datos ficticios reproduce el problema: el subtotal 7152 sí contiene BaseUnitMeasure cuando el payload trae cantidadBolsas; el error aparece cuando esa cantidad difiere de la cantidad redondeada del producto. La ausencia del nodo corresponde al error 3237, no al 3236.

Las hojas oficiales `ValidaExprRegNC-2.0.1.xsl:3707–3715` y `ValidaExprRegND-2.0.1.xsl:2042–2051` comparan `cbc:BaseUnitMeasure` con `round(CreditedQuantity)` o `round(DebitedQuantity)`, respectivamente. La condición se aplica a cualquier afectación. Además, ambas hojas leen la tasa desde `cac:TaxCategory/cbc:PerUnitAmount`; el generador compartido la situaba directamente en TaxSubtotal, representación que se conserva para facturas y boletas.

La construcción de NC/ND normaliza exclusivamente la representación XML. Si las bolsas difieren de la cantidad redondeada, divide el mismo producto en una parte de cantidad igual a las bolsas, con todo su ICBPER, y otra parte sin bolsas. Reparte base neta, IGV, descuentos y referencia gratuita a céntimos, dejando el residuo en la segunda parte; mantiene valores unitarios, afectación e importes del documento. Cuando las cantidades ya coinciden no necesita partición. El subtotal 7152 de cada nota declara BaseUnitMeasure y PerUnitAmount 0.50 dentro de TaxCategory. El total 7152 de cabecera continúa sumando exclusivamente los impuestos de las líneas.

La guarda `BOLSAS_NOTA_SUPERAN_CANTIDAD` rechaza NC/ND cuando las bolsas superan la cantidad del producto, con el mensaje «Las bolsas de una línea de la nota no pueden superar la cantidad de la línea. Ajuste las bolsas o la cantidad.». Se verifica en ambas entradas de creación, antes de reservar correlativo, persistir o publicar el trabajo, para líneas gravadas, exoneradas, inafectas y gratuitas. También protege la regeneración de históricos incompatibles. El payload persistido no se modifica. Worker y regeneración de descarga emplean el mismo generador; el XML firmado ya almacenado conserva su precedencia en la descarga.

Se fijan hashes SHA-256 anteriores a la modificación para NC/ND sin bolsas, gravadas y gratuitas, y para facturas/boletas con bolsas (incluidas factura gratuita particionada y mixta). Son regresiones sintéticas de las estructuras certificadas; no se alteran documentos históricos. Las comprobaciones locales firman XML del camino adapter → worker y ejecutan las hojas SFS oficiales para NC gravada, NC gratuita, NC parcial y ND gravada con bolsas, además de NC exonerada y ND gratuita. Comprueban nodos, cantidades, tasa, importe 7152, total por cobrar, inmutabilidad del payload y paridad exacta de la firma con la regeneración de descarga.

Hallazgo adicional fuera de esta corrección: la ND onerosa inafecta (tributo 9998) carece de Percent en el generador preexistente; la hoja ND exige ese nodo y devuelve 2992. No se modifica esta representación, para preservar el alcance y las notas sin bolsas. La guarda de exceso de bolsas sí cubre esta afectación.

La validación local no garantiza la aceptación del servidor SUNAT; la certificación en vivo corresponde a una reprueba posterior al despliegue. Esta construcción no realiza emisiones, envíos, despliegues ni acceso a producción.

Verificación final: línea base 337 suites y 3252 pruebas aprobadas; resultado 338 suites y 3298 pruebas aprobadas, con las mismas 4 suites y 38 pruebas omitidas y 12 snapshots aprobados. Cobertura local del código nuevo: 100% (37/37 líneas ejecutables y 34/34 ramas del diff); build correcto y lint sin errores (dos advertencias previas ajenas al cambio). Los ocho casos SFS de notas incluyen también dos líneas gratuitas con bolsas y el caso sin partición cuando bolsas y cantidad coinciden.

## Consolidado normativa

Base: main e4c8464b19657c14d213af328c6433df78512b31. Línea base: backend 338 suites / 3298 pruebas (4 suites / 38 pruebas omitidas, 12 snapshots); frontend dev 98963cd781e2eab269497763d832898efcdcd8ac, 158 archivos / 1235 pruebas. No se incorpora Monitor real ni se cambian lista o alertas.

### Punto 3b — Plazo del primer despacho RA

Antes del primer sendSummary, el despacho vuelve a leer las fechas de todos los miembros persistidos, acotados a la empresa, y compara cada emisión con el día actual de Lima. Un miembro fuera de los siete días (2957), futuro o no acreditado bloquea todo el agregado firmado en REVIEW con error durable y específico; no se mutila ni se reconstruye un XML ya preparado. El error identifica el documento y las fechas. No hay publicación SOAP ni reclamación de envío. Los miembros conservan su estado fiscal y el artefacto permanece intacto. Un ticket existente se sigue consultando sin reenvío ni comprobación de plazo del primer despacho. Se verifican días 0, 7, 8, fecha futura, miembros incompletos y recuperación de ticket.

### Punto 4 — ICBPER en notas de descuento

NC 04/09 acredita devolución de bolsas únicamente mediante cantidadBolsas positiva en sus propias líneas. Un importe ICBPER heredado sin esa cantidad no declara 7152 ni incrementa el total. La liquidación recalcula los importes de las altas; la defensa XML retira el tributo no acreditado y ajusta el total solo cuando el payload indica que ya lo incluía, sin mutar dicho payload. La cantidad global legada no sustituye la declaración por línea. Con devolución explícita positiva se conserva el tributo y su partición válida para 3236. El espejo de la anulación 01 queda intacto: hashes previos fijados para gravadas y gratuitas. Se validan NC 04/09 con cantidad ausente, cero y positiva contra las hojas oficiales.

### ND inafecta — tasa explícita

Solo DebitNote con tributo 9998 incorpora Percent 0.00, conservando categoría y afectación 30. Se valida con la hoja oficial ND con y sin bolsas, sin 2992. Facturas y boletas conservan su representación; no se asignan tasas a campos tributarios desconocidos.

### Notas sobre boletas — identidad acreditada

El validador admite las reglas del receptor de boleta cuando el servicio acredita tipo 03 leyendo el documento origen en la empresa. El tipo no se toma de una serie inferida por el cliente. Origen factura o no acreditado conserva RUC obligatorio. Las dos entradas atómicas conservan además la igualdad de identidad con el documento origen, antes de numerar. Las NC/ND con DNI y referencia B superan las hojas oficiales; una nota a factura sin RUC continúa rechazada. El caso de uso legado sin origen acreditado mantiene la exigencia conservadora de RUC.

### Frontera Inventario — reclasificación con pendientes M1

La guarda del PATCH de producto es aditiva y no importa servicios de M1 ni cambia el grafo de módulos. Lee, por empresa/SKU, omisiones durables aún no resueltas y obligaciones físicas acreditadas por el snapshot de creación, contrastadas contra el movimiento real y su cantidad. Incluye descargas de ventas y devoluciones físicas nuevas; no convierte notas económicas ni servicios originales en obligaciones de inventario. No deduce una clasificación histórica desde un snapshot ausente; las omisiones históricas atribuibles al SKU siguen bloqueadas hasta su resolución acreditada. Un pendiente produce 409 PRODUCTO_CON_PENDIENTES_M1 en ambos sentidos producto/servicio. Sin cambio de tipo, no se consulta la guarda; sin pendientes, se conserva el cambio solicitado.

Alta M1, ejecución del puente y reclasificación comparten una exclusión transaccional por empresa/SKU, con orden estable para varios productos. La guarda y el cambio de clasificación se confirman en la misma transacción; una carrera con un alta no elude la lectura de pendientes. El helper común solo conoce Prisma y la clave de exclusión, sin dependencia entre módulos de negocio. No se habilita ningún bypass ni se resuelven pendientes cambiando el catálogo. Pruebas PostgreSQL aisladas verifican ambas direcciones, persistencia del tipo rechazado, resolución explícita, productos sin pendientes y concurrencia con un alta M1.

### Verificación de entrega del consolidado

Resultado completo backend: 344 suites / 3363 pruebas aprobadas, frente a 338 / 3298 de la base; permanecen 4 suites y 38 pruebas omitidas y 12 snapshots aprobados. Cobertura local del código nuevo: 72/72 líneas y 105/105 ramas, 100%. Resultado completo frontend: 159 archivos / 1241 pruebas aprobadas, frente a 158 / 1235; código nuevo 4/4 líneas y 5/5 ramas, 100%. Ambos builds pasan. Lint backend sin errores, con dos avisos heredados. El modal del frontend conserva un error previo react-hooks/set-state-in-effect y un aviso only-export-components; se reprodujeron sobre el archivo de la base y no se modifican por A5.

A5 se entrega en ferry/m1-consolidado-normativa: el botón y su atajo reutilizan la primera fila vacía; cuando contiene código o descripción, agregan una nueva sin sobrescribir lo editado. Su FERRY.md detalla los cuatro archivos y sus SHA-256. El hash histórico de ND 08/30 sin bolsas se actualiza exclusivamente por la tasa cero requerida por 2992; los demás hashes de regresión y los tres espejos de anulación 01 se mantienen. No se incorporan cambios de Monitor real ni de lista o alertas. No hay migraciones nuevas, emisiones reales, acceso a producción, despliegues, PR ni merges; no se reutilizan correlativos quemados.

## Monitor real

Bases de construcción: backend main `e4c8464b19657c14d213af328c6433df78512b31` y frontend dev `98963cd781e2eab269497763d832898efcdcd8ac`. Línea base verde: backend 338 suites / 3298 pruebas (4 suites y 38 pruebas omitidas, 12 snapshots); frontend 158 archivos / 1235 pruebas.

La tarjeta de DLQ consumía los jobs actuales del servidor, pero la tabla intentaba reconstruir su membresía a partir de textos del historial. El listado de comprobantes no publica ese historial y las consultas del Monitor excluían estados finales. Por separado, el botón de propuesta RVIE estaba dentro de un TabsContent de InvoiceList que nunca se montaba: la pestaña navega a InvoiceMonitorPage.

El contrato de lista y detalle incorpora `en_dlq`, derivado de `QueueService.listDlq(companyId)`, la misma fuente de jobs vigentes de `sunat-invoice-dlq` (`queued: true`) utilizada por alertas. La lectura por lote deduplica IDs para la membresía; la consulta fiscal conserva su aislamiento por empresa y excluye jobs huérfanos. `GET /invoices?en_dlq=true` filtra antes del conteo y la paginación, sin excluir comprobantes por tener estado final; también admite `en_dlq=false`. Se rechazan valores inválidos. No hay columna nueva ni cambio de estado fiscal, de alertas, de conteo de trabajos o de reintentos. Si no puede leerse la cola, la consulta fiscal normal informa `en_dlq: null`; el filtro operativo responde 503 con `DLQ_NO_DISPONIBLE`, evitando un falso vacío.

El Monitor consulta la red, recorre todas las páginas del filtro DLQ y une por ID esos documentos con los estados operativos y los puentes pendientes. La tarjeta principal y el filtro usan exactamente los documentos únicos marcados `en_dlq`; cuando difieren de los trabajos informados por alertas, la tarjeta aclara ambas cantidades. La clasificación fiscal de preparación local, incertidumbre o puente permanece visible y la membresía DLQ es independiente. Se elimina la inferencia por texto del historial y la necesidad de cargar detalles para descubrirla. Los estados finales con job muerto aparecen bajo DLQ; no se habilita por ello un reintento fiscal no permitido.

InvoiceRvieSection monta el componente existente InvoiceOutboxMonitor en la página real del Monitor, conserva el botón «Exportar propuesta RVIE - SIRE (CSV)» y utiliza un lote fiscal paginado independiente de los documentos en vuelo, incluidos los estados finales. Conserva el criterio del CSV existente y consulta los detalles para el desglose fiscal, reutilizando la derivación de Bandeja. La propuesta cubre los comprobantes registrados consultados; no añade un filtro de período ni cambia el formato de exportación. Su fallo se muestra en la sección y no oculta la cola. Se retira limpiamente el montaje inalcanzable de InvoiceList y sus imports, sin alterar las demás pestañas.

Las pruebas del backend ejercitan la ruta HTTP real con el orden de controladores del módulo, paginación previa al conteo, estados finales, jobs duplicados, huérfanos, aislamiento por empresa, DLQ vacía, valores inválidos y cola no disponible. Las pruebas del frontend pasan respuestas con la forma real de la API por sus mapeadores: sin historial en lista, con `en_dlq`, documentos finales y varias páginas. Verifican que tres documentos con cuatro trabajos se cuenten y filtren como tres documentos, el retiro de la membresía tras rescate, la exportación desde la página real con documentos finales y la independencia del error de propuesta. La cobertura local del código nuevo es 100% en ambos frentes.

La construcción no realiza emisiones, envíos, acceso a producción, despliegues, merges ni apertura de PR. Los cambios del frontend se entregan exclusivamente en el repositorio backend mediante `ferry/m1-monitor-real`, con archivos finales bajo `frontend/` y manifiesto SHA-256 en FERRY.md.

Verificación final: backend 339 suites / 3308 pruebas aprobadas (sin cambios en las 4 suites y 38 pruebas omitidas; 12 snapshots aprobados), frente a 338 / 3298 de la base. Frontend 160 archivos / 1242 pruebas aprobadas, frente a 158 / 1235. Cobertura local del código nuevo: backend 18/18 líneas y 22/22 ramas; frontend 20/20 líneas y 21/21 ramas, 100% en ambos. Builds correctos; lint sin errores en los archivos del cambio (advertencias previas: dos en backend y cuatro en frontend). El caso paginado del frontend recorre 101 documentos, respetando páginas de 100 filas.

## Fecha fiscal en Lima

El valor por defecto de `fecha_emision` se obtenía de la fecha UTC del reloj. Entre las 19:00 y las 23:59 de Lima podía adelantar un día la emisión, afectar la validación de cuotas (3267) y desalinear la fecha del comprobante con los resúmenes y períodos locales.

`fiscalDate.ts` centraliza el día fiscal con `America/Lima`. La emisión resuelve su fecha una vez antes de las guardas y reutiliza ese valor para retención, liquidación, payload UBL y persistencia, incluso si la operación cruza medianoche. Las fechas explícitas se conservan. RA/RC, reserva de agregados, plazo del despacho RA, métricas, mes predeterminado del reporte de ventas y fallback de período contable reutilizan la misma fuente.

Los días fiscales persistidos conservan su representación existente a medianoche UTC; no se convierten como instantes ni se reescriben comprobantes históricos. Tampoco se modifican los timestamps de reintentos, certificados ni auditoría. No hay migraciones, cambios de frontend ni envíos reales.

Las pruebas cubren 18:59/19:00 y 23:59/00:00 de Lima, crédito nocturno con primera cuota al día siguiente real, cuota del mismo día rechazada, cruce de medianoche durante guardas y lectura del emisor, RA/RC nocturno, vencimiento del plazo RA al cambiar el día de Lima, fechas explícitas/históricas y cambio de mes en reportes.

Verificación local: línea base 345 suites / 3373 pruebas; resultado final 346 suites / 3389 pruebas aprobadas, con las mismas 4 suites / 38 pruebas omitidas y 12 snapshots aprobados. Build correcto; lint sin errores y con dos advertencias preexistentes. Código nuevo: 25/25 líneas y 5/5 ramas cubiertas (100%). La ejecución instrumentada superó todas las pruebas funcionales, pero una medición de latencia Outbox no alcanzó el umbral 9/10; la repetición completa sin instrumentación quedó verde, sin cambiar el test ni su límite.

## Corrección S — Servicios y unidades fiscales

Los servicios registrados con unidad ZZ llegaban al generador UBL y fallaban en preparación local porque M1 validaba la unidad contra su subconjunto de ferretería. El catálogo oficial distribuido sí incluye ZZ. El flag is_service no causaba el rechazo y no se modifican stock, costos ni clasificación de productos.

Se separa el catálogo fiscal de la función histórica esUnidadFerreteria(), cuyo comportamiento y lista de nueve códigos permanecen intactos. Generación UBL y elegibilidad del catálogo de M1 reutilizan los 2116 códigos fiscales únicos de cat_03.xml. Se excluye la fila de cabecera Code/Name y se deduplica N20, sin alterar los assets. El mensaje del generador enumera exactamente ese mismo catálogo. Una prueba de paridad contrasta todos los códigos con el XML oficial.

Inventario permite registrar la unidad como texto libre por API; por ello se incorporan los 2107 códigos oficiales ausentes, enumerados en docs/m1/unidades-fiscales-sunat.md. Además de ZZ, el menú contiene GLL, GRM, LTR, MTK, PK, SET y TNE que también faltaban. BAL, BLS, BOT, CIL, FDO y ROL del menú no figuran en este cat_03 y siguen rechazados; no se inventan equivalencias ni se modifica Inventario.

La validación oficial de los casos inafectos reveló un segundo bloqueo: la hoja de Factura, línea 3103, exige cac:TaxCategory/cbc:Percent para todo tributo distinto de 7152 (2992). Se añade Percent 0.00 a 9998 en facturas y boletas. No cambia el impuesto ni la clasificación de la operación. NC y ND conservan su representación. Los hashes previos se conservan y las regresiones de afectación 30 verifican que retirar solo ese nuevo nodo reproduce exactamente el hash anterior; las demás regresiones siguen comparando bytes sin normalización.

Pruebas: servicios gravados, exonerados e inafectos, puros y con bienes; reproducción de los tres patrones F83/F84/F85 mediante guardas reales, adaptador fiscal y el generador que usa el worker, firma ficticia y hojas SFS oficiales. Se comprueba unitCode ZZ, payload intacto, boleta inafecta, paridad del catálogo, disponibilidad fiscal de las unidades adicionales, rechazo de unidades inválidas/no oficiales y conservación de las guardas de stock, unidad y registro. No hay migraciones, emisiones, PR, merges ni despliegues.

Hallazgo fuera de S: el control histórico de factura inafecta con cantidad 2 y una bolsa, al superar 2992, expone el 3236 preexistente por BaseUnitMeasure distinto de la cantidad de línea onerosa. No se modifica la representación ni la política de bolsas de esas líneas. La prueba específica de tasa inafecta se valida sin bolsas; los hashes históricos de ICBPER se conservan con la única salvedad explícita de Percent 0.00 indicada arriba.

Verificación en la base 30dbd87d: línea base 347 suites / 3397 pruebas; final 348 suites / 3423 pruebas aprobadas. Se conservan 4 suites / 38 pruebas omitidas y 12 snapshots aprobados. Build correcto y lint sin errores, con tres advertencias preexistentes. Código nuevo local: 10/10 líneas y 18/18 ramas cubiertas (100%).

## Corrección A — QR de la representación impresa

Base: main `02627e833163b26d532461fe9ab6517a41bcb706`. Se cierra la deuda de paridad de la trama QR declarada en Parte 9. La corrección se entrega en un solo commit porque formato, codificación y elegibilidad de descarga forman el mismo contrato de representación impresa.

El Anexo 6, apartados 6.4.2 y 6.4.3, exige nivel de corrección Q y diez campos separados por `|`: RUC emisor, tipo, serie, número, IGV, total, fecha, tipo de documento del receptor, número del receptor y valor resumen. La referencia normativa es https://www.sunat.gob.pe/legislacion/superin/2019/anexo-244-2019.pdf (página 6); el formato de Factura se contrasta con https://www.sunat.gob.pe/legislacion/superin/2022/anexo-123-2022.pdf (página 1).

`InvoiceQrService` conserva el número tal como figura en este sistema en XML y PDF (ocho dígitos), la fecha fiscal guardada en AAAA-MM-DD y dos decimales en IGV y total. Se conserva el relleno Base64 del DigestValue; solo se retira espacio de formato Base64. No se añade un undécimo campo vacío. Tanto la salida PNG Base64 como Buffer utilizan Q. `tramaValida` comprueba la estructura de diez segmentos y admite los dos campos vacíos del receptor anónimo.

La descarga PDF permite QR de boleta sin identificación del receptor, con sus campos ausentes representados como cadenas vacías, sin fabricar DNI/RUC ni nombres. Se conserva la precedencia del digest del XML firmado: si falta dentro de un XML conservado, no se sustituye por el payload. Las identidades históricas, fechas fiscales, importes, XML firmado y payload persistido permanecen intactos; el cambio solo afecta la representación generada en la descarga. No se recalculan días fiscales ni se consulta la configuración actual para reemplazar el RUC histórico.

AddressTypeCode queda verificado y no se modifica: `xmlPartiesHelper.ts` emite el ubigeo en RegistrationAddress/cbc:ID y el local anexo en cbc:AddressTypeCode, conservando `0000` como cadena. La preparación exige seis dígitos de ubigeo y cuatro de anexo; no se añade ningún valor por defecto cuando falta el dato. Evidencia SFS de fase 0: XML generado por el camino común y firmado con certificado ficticio para 01/03/07/08, ubigeo 150101 y anexo 0000, sin errores; al retirar AddressTypeCode de Factura aparece 3030. El código identifica local anexo, no ubigeo.

Pruebas: trama completa exacta, número con ocho dígitos, fecha ISO sin conversión de zona, importes a dos decimales, relleno Base64 de uno y dos signos igual, normalización del espacio Base64, rechazo de estructura anterior de once segmentos, nivel Q en ambas salidas y generación PNG real. Se verifican boletas anónimas con valores ausentes/null/vacíos, digest del XML por encima del payload, ausencia de digest y conservación de todos los datos registrados. Una boleta de prueba con representación XML de consumidor final 0/-, generada y firmada localmente, pasa SFS y produce el QR con los campos de identidad vacíos de la fila, usando exactamente el DigestValue firmado.

Hallazgo independiente, sin ampliar esta corrección: si payload.cliente está completamente ausente, el generador actual omite AccountingCustomerParty y su XML no supera el XSD de Invoice. La prueba de representación anónima válida utiliza explícitamente en su fixture XML el consumidor final admitido por SFS (0/-); no se añade esa identidad como fallback de producción. La generación UBL se conserva sin modificaciones.

Línea base medida en 02627e83 con PostgreSQL local habilitado: 349 suites / 3430 pruebas aprobadas; 4 suites / 38 pruebas omitidas y 12 snapshots aprobados. Frente a la referencia 348/3423, el main fijado añade una suite y siete pruebas de permisos de almacén (cinco en warehouseAccessService.spec.ts y dos en authController.spec.ts), sin cambios de esta corrección en esas áreas. Resultado final: 349 suites / 3439 pruebas aprobadas (+9); mismas 4 suites / 38 pruebas omitidas y 12 snapshots aprobados. La suite completa se ejecuta con PostgreSQL local y cobertura sobre ambos archivos afectados. Cobertura del servicio QR: 100% de líneas, ramas, funciones y sentencias. Cobertura de código nuevo contra la base: 4/4 líneas ejecutables y 8/8 ramas instrumentadas (100%); las líneas históricas no cubiertas de descarga no pertenecen al cambio. Build correcto y lint sin errores, con tres advertencias preexistentes. La primera ejecución con el límite de memoria predeterminado de Node agotó el heap; las mediciones completas comparables se realizaron con un límite de 6144 MiB y la misma configuración local de integración, sin activar SUNAT beta.

Sin migraciones nuevas, cambios de AddressTypeCode, modificaciones del frontend, emisiones reales, PR, merges ni despliegues.

## Reenvío masivo del Monitor — fase 0 y construcción

Bases: backend main 19de0ebe6372d3949c51f7830c8e64aaef7d6d8f (349 suites / 3439 pruebas aprobadas) y frontend dev da8f3874b03e46a8f0f1d29c0e69d9dcdcc21431 (166 archivos / 1276 pruebas aprobadas).

Fase 0: InvoiceQueryService.reintentarCdr admite rescate de EN_COLA/PENDIENTE y reintento de ERROR_RED/ENVIADO, sin reabrir RECHAZADO. Reutiliza QueueService.reenqueueInvoiceIfIdle, que verifica jobs activos/DLQ, invoca una guarda M1 y publica con singletonKey por comprobante. Los marcadores históricos nulos se vuelven inciertos antes de publicar, obligando al camino conservador de consulta del worker. No existía una operación masiva. La página real es InvoiceMonitorPage, que ya monta RVIE y el Monitor de agregados; no se utiliza el tab inalcanzable de InvoiceList.

Se añaden GET y POST /api/v1/invoices/retry-batch, ambos exclusivamente ADMIN y aislados por la empresa del token. GET obtiene una vista previa sin escrituras ni publicación; POST reevalúa la selección completa de estados EN_COLA/PENDIENTE/ERROR_RED/ENVIADO/RECHAZADO/PROCESANDO de la empresa. Los documentos finales aceptados/anulados no son candidatos. Los RECHAZADO locales y los SUNAT se distinguen con presentarResultado, el CDR y el historial persistido, no solo por su código numérico.

Exclusiones duras: transport_uncertain=true nunca llega a publicación; rechazo definitivo comprobado por CDR o SOAP Fault de SUNAT no se reabre; validación XSL local, preparación local no recuperable o de recuperabilidad desconocida, y evidencia local mal formada exigen revisión/corrección y se omiten. Los rechazos de origen no confirmado y los estados no reintentables se omiten sin atribuirlos a SUNAT. Una preparación explícitamente recuperable conserva el camino individual existente. Cada candidato se relee bajo bloqueo de su fila antes de autorizarlo; una transición a incertidumbre o estado final queda excluida. Los marcadores nulos se tratan como en el rescate individual: se confirma transport_uncertain=true antes de publicar, para que el worker consulte y no suponga que jamás se abrió red.

La publicación reutiliza exactamente QueueService.reenqueueInvoiceIfIdle con rescatarDlq=true. No duplica firma, generación UBL, transporte ni reglas del worker. La autorización de cada rescate y el marcador conservador se confirman en una transacción breve antes de publicar; queda una entrada de historial con el prefijo manual existente. No se modifica la cola, el reintento individual, la proyección de lista/detalle, las alertas ni el reenvío forzado.

Hallazgo de concurrencia: la prueba real en PostgreSQL mostró que dos llamadas simultáneas podían superar la comprobación de jobs de la compuerta actual y publicar dos trabajos pese a singletonKey. Sin cambiar Resiliencia, M1 añade pg_try_advisory_xact_lock por empresa durante la ejecución del lote. Una segunda solicitud simultánea no espera ocupando el pool ni vuelve a publicar: informa EN_CURSO por documento elegible, además de conservar las exclusiones. Un clic posterior comprueba explícitamente trabajos created/retry/active antes de publicar; la consulta queued:true de la compuerta por sí sola no incluye active. El cierre de este caso queda descrito en la precisión de idempotencia siguiente. La prueba concurrente real confirma un único job y ninguna publicación para otra empresa o documentos excluidos. No hay consumidor ni conexiones a SUNAT en esa prueba.

La respuesta incluye fase PREVIA/EJECUTADA y conteos de elegibles, encolados efectivos, omitidos por incertidumbre, rechazo definitivo y bloqueo local, ya en cola, en curso en otro lote, omitidos por estado y no confirmados. Incluye id, número, estado, resultado y motivo por documento. Un fallo individual no detiene el resto; NO_CONFIRMADO no afirma que no exista job y solicita actualizar el Monitor antes de repetir. La ejecución no es una transacción fiscal de todo o nada: se devuelve el resultado individual comprobado de cada documento.

El frontend añade Reenviar encolados en InvoiceMonitorPage, visible solo para ADMIN mediante useRolePermissions. La confirmación consulta el GET real y muestra sus conteos/detalles antes de permitir POST; se puede cancelar. La respuesta POST sustituye los conteos previstos por los resultados reevaluados de la API, refresca el Monitor y permanece visible tras Actualizar. Un ref bloquea la doble activación inmediata y el servidor protege solicitudes concurrentes. Se informan errores de previa y ejecución sin inferir éxito desde la grilla. La operación no invoca autorización de reenvío forzado. El front se transporta por ferry/m1-reenvio-masivo con archivos bajo frontend/ y hashes SHA-256.

Pruebas backend: políticas por estado/origen, marcadores true/false/null, CDR y SOAP Fault, datos inválidos/causa desconocida, preparación recuperable, cambios concurrentes bajo bloqueo, respuesta real de la compuerta, errores por documento, tenant ausente, lote vacío; HTTP con el orden real del módulo, AuthGuard y RolesGuard, solo ADMIN y tenant del token. Los dos harness HTTP previos incorporan los tokens explícitos de @Inject además de design:paramtypes, conservando todos los controladores en su orden real. PostgreSQL/PgBoss reales verifican dos lotes concurrentes, un job único y exclusiones. Pruebas frontend: componente montado en el Monitor real, contrato snake_case de API sin historial, roles, previa/confirmación/cancelación, cero elegibles, errores, doble clic y persistencia del resultado tras actualizar.

Resultados: backend 352 suites / 3470 pruebas aprobadas (+3 suites y +31 pruebas), mismas 4 suites / 38 pruebas omitidas y 12 snapshots aprobados; frontend 167 archivos / 1284 pruebas aprobadas (+1 archivo y +8 pruebas), sin fallos ni omisiones. Cobertura nueva backend: 63/63 líneas ejecutables y 41/41 ramas instrumentadas (100%), incluyendo el registro del módulo; servicio y controlador nuevos tienen 100% en líneas, ramas, funciones y sentencias. Frontend: 30/30 líneas ejecutables y 17/17 ramas instrumentadas nuevas (100%). Builds correctos. Lint backend sin errores, con tres advertencias preexistentes. Lint frontend en archivos cambiados sin errores, con dos advertencias preexistentes de exportaciones del Monitor; el lint global de la base ya contiene 139 errores y 28 advertencias, ajenos a este cambio.

Sin migraciones, emisiones reales, PR, merges, despliegues ni acceso a producción.


## Reenvío masivo — precisión y cierre de idempotencia con job activo

Base de esta corrección: fix/m1-reenvio-masivo, commit 4ba00d3cf14337f2dbf468b570ce289a79e2a93c. La exclusión mutua de empresa ya incluida en ese commit cubre dos lotes simultáneos entre procesos: pg_try_advisory_xact_lock(hashtextextended(M1_BATCH_RETRY:<companyId>,0)) se mantiene hasta terminar procesar(), incluida cada publicación. El segundo lote superpuesto devuelve EN_CURSO y no procesa candidatos.

La garantía anterior era incompleta para una segunda solicitud posterior al fin del lote, cuando el worker ya había reclamado el job pero todavía no actualizaba Invoice. PgBoss 12.36.0 implementa findJobs(queued:true) como state < active (dist/plans.js:4131); por tanto no ve un trabajo active. Se reprodujo en PostgreSQL local: Invoice ERROR_RED y transport_uncertain=false, un job active, y un segundo POST generaba un nuevo job. El control anterior sin consumidor solo comprobaba el trabajo todavía en cola.

Se conserva el bloqueo del lote y se añade una lectura aditiva QueueService.hasLiveInvoiceJob: consulta los trabajos del comprobante sin queued:true y reconoce created, retry y active. M1 la ejecuta dentro de su guarda, después de releer y bloquear la fila propia y antes de cambiar marcadores, registrar la solicitud o permitir la publicación. Un trabajo vivo produce YA_EN_COLA y la guarda retorna false a reenqueueInvoiceIfIdle. Si falla la lectura, no se autoriza publicación y se informa NO_CONFIRMADO. Los trabajos completed/cancelled/failed no se consideran vivos. No se cambia la política de PgBoss, el contador de alertas, el mecanismo individual, el transporte, la firma ni el frontend.

La combinación garantiza que dos POST al reintento masivo de la misma empresa no publiquen dos jobs simultáneamente vivos del mismo documento: el bloqueo de empresa protege la comprobación/publicación entre lotes, y la lectura de estados vivos cubre la transición created/retry a active entre solicitudes. No se presenta como una garantía de entrega exactamente una vez ante SUNAT; el worker conserva sus guardas de identidad, estado e incertidumbre.

Pruebas: batch-retry.integration.spec.ts envía ahora dos POST HTTP simultáneos al controlador con PostgreSQL/PgBoss reales y verifica suma de encolados=1 y un job único. Mantiene exclusiones y aislamiento de empresa. Un segundo caso simula únicamente el claim del worker en pgboss.job, sin consumidor ni envío: queued:true ya no encuentra el job, Invoice continúa elegible y un nuevo POST responde encolados=0, ya_en_cola=1, con exactamente un trabajo vivo en estado active. El caso nuevo falló sobre 4ba00d3c y pasa con la corrección. Las pruebas unitarias cubren todos los estados vivos/terminales, vacío, fallos de lectura y ausencia de escrituras/publicación cuando ya existe trabajo.

Verificación: línea base de la rama 352 suites / 3470 pruebas aprobadas; final 352 suites / 3481 pruebas aprobadas (+11). Se conservan 4 suites / 38 pruebas omitidas y 12 snapshots aprobados. Build correcto y lint sin errores, con tres advertencias preexistentes. Cobertura del código nuevo contra 4ba00d3c: 5/5 líneas ejecutables y 2/2 ramas instrumentadas (100%). La integración HTTP y las pruebas unitarias de compuerta pasan sin transporte externo.

Sin PR, merges, despliegues, emisiones reales ni acceso a producción. No se continúa otro punto dentro de esta corrección.
## Boleta íntegramente gratuita con bolsas — fase 0 y construcción

Base fijada: main 19de0ebe6372d3949c51f7830c8e64aaef7d6d8f. Línea base medida: 349 suites / 3439 pruebas aprobadas; 4 suites / 38 pruebas omitidas y 12 snapshots aprobados.

La orientación oficial de SUNAT reconoce la adquisición gratuita de bolsas dentro del ámbito del ICBPER (https://orientacion.sunat.gob.pe/02-impuesto-al-consumo-de-las-bolsas-de-plastico y https://www.gob.pe/7941-impuesto-al-consumo-de-las-bolsas-de-plastico-icbp). La R.S. 150-2019/SUNAT exige consignar cantidad e impuesto y lo separa de la base imponible del IGV (https://www.sunat.gob.pe/legislacion/superin/2019/150-2019.pdf). No se asigna un precio ni un valor referencial nuevo a la bolsa; la representación utiliza el valor referencial del producto registrado que se entrega gratuitamente. La afectación original 31/32 se conserva según cat_07.xml, sin convertir todos los retiros en bonificaciones.

Evidencia oficial en assets/sunat-sfs: CatalogoErrores.xml, entradas 3105 (al menos un tributo de afectación IGV por línea), 3236 (BaseUnitMeasure no corresponde al esperado) y 3237 (BaseUnitMeasure obligatorio a nivel de ítem). 7152 es el identificador del tributo ICBPER en cat_05.xml, no un error de ese catálogo. ValidaExprRegBoleta-2.0.1.xsl:3274 exige BaseUnitMeasure; :3306 compara su valor con round(cantidad de producto); :3817 exige al menos un subtotal con base positiva de los esquemas 1000/1016/9995/9996/9997/9998. El subtotal 7152 por sí solo no satisface 3105. La hoja lee la tasa por unidad dentro de TaxCategory (:3258 y :3321).

Fase 0, generador común y firma ficticia, sin modificar producción: afectaciones 31 y 32, cantidad 1 y una bolsa, sin errores SFS; cantidad 2 y una bolsa sin partir, error 3236; la misma cantidad 2 partida en dos líneas del mismo producto, una con bolsa y otra sin ella, sin errores SFS. La evidencia sostiene la admisibilidad con doble TaxSubtotal y partición cuando corresponda; no sostiene una línea independiente de solo ICBPER con base cero.

Estructura de la línea con bolsa: InvoicedQuantity=1; LineExtensionAmount=35.00, valor referencial ya registrado; PriceAmount=0.00. TaxTotal=0.50 contiene un TaxSubtotal de afectación con TaxableAmount=35.00, TaxAmount=0.00, categoría Z, Percent=0.00, TaxExemptionReasonCode=31 o 32 y TaxScheme=9996/GRA/FRE. Su segundo TaxSubtotal contiene TaxAmount=0.50, BaseUnitMeasure unitCode=NIU con valor 1, y TaxCategory S con PerUnitAmount currencyID=PEN de 0.50 y TaxScheme=7152/ICBPER/OTH. No se agrega TaxableAmount al subtotal 7152 ni se inventa IGV. El encabezado suma el ICBPER una sola vez a TaxTotal, TaxInclusiveAmount y PayableAmount; con una bolsa ambos últimos son 0.50. Conserva la leyenda 1002 de transferencia gratuita y la base referencial gratuita, sin cobrarla.

La construcción extiende la partición B8 exclusivamente al XML de boletas íntegramente gratuitas, reutilizando el reparto y la guarda BOLSAS_GRATUITAS_SUPERAN_CANTIDAD. Ambas rutas de alta rechazan el exceso antes de reservar, persistir o encolar. En las boletas gratuitas nuevas, PerUnitAmount se ubica donde lo lee su hoja; facturas, notas y boletas onerosas conservan su representación. La identificación del documento íntegramente gratuito exige todas sus líneas gratuitas; una boleta mixta no entra en esa ruta. No se reescribe el payload ni documentos históricos. El XML gratuito sin bolsas y la representación certificada de facturas permanecen fijados por hashes de regresión.

Validación de construcción: afectaciones 31/32 con cantidad igual y mayor que bolsas, una o varias líneas gratuitas, líneas sin bolsas dentro del conjunto gratuito y gratuita gravada 11, mediante el camino real del worker, firma ficticia y XSD/XSL oficiales; cabecera, leyenda, suma de bases y paridad de descarga. Controles negativos conservan los errores oficiales 3236 y 3237. La validación local no garantiza la aceptación del servidor SUNAT, cuya regla real fue más estricta que la hoja distribuida; la certificación en vivo corresponde al tren posterior.

Resultado final: 350 suites / 3455 pruebas aprobadas (+1 suite y +16 pruebas); mismas 4 suites / 38 pruebas omitidas y 12 snapshots aprobados. Build correcto y lint sin errores, con tres advertencias preexistentes. Cobertura del código nuevo contra la base: 5/5 líneas ejecutables y 19/19 ramas instrumentadas, 100%. Los cuatro archivos productivos afectados tienen 100% de cobertura de líneas en la suite completa.

## Decisión aceptada — RA de despacho diferido

Se registra la aceptación expresa de Jhordy: si algún documento del agregado RA venció el plazo antes del primer despacho, el agregado completo permanece bloqueado en REVIEW con error auditable, sin envío parcial. Esta decisión acepta la desviación del consolidado ya construida; no modifica su código, sus estados, sus reglas de plazo ni su despacho.

## Punto 4 — consulta RUC del receptor en emisión y registro de clientes

Fase 0: backend main bfd51637397abefb87f08e6a9092d67d0f0cc03e; frontend dev da8f3874b03e46a8f0f1d29c0e69d9dcdcc21431. Bases medidas con suites completas: back 351 suites / 3459 pruebas aprobadas, 4 suites / 38 pruebas omitidas y 12 snapshots; front 166 archivos / 1276 pruebas aprobadas. GET /api/v1/sunat/ruc/:ruc ya existe con AuthGuard y devuelve razonSocial, direccionFiscal, ubigeo, estadoContribuyente y condicionDomicilio. No se cambia el proveedor ni su configuración y no se accede a Decolecta real.

El recorrido completo reveló una carencia adicional: EmitirComprobanteDto y traducirEmision no recibían dirección del receptor; el front mantenía clienteDireccion en el borrador pero su serializador la descartaba. Esta rama aditiva desde main añade customer_address opcional (string, máximo 1500 caracteres), conserva el valor útil recortado en payload_ubl.cliente.direccion y lo representa exclusivamente en AccountingCustomerParty/PartyLegalEntity/RegistrationAddress. El texto se escapa mediante el helper existente; no se inventa ubigeo, estado ni condición de domicilio. El país PE corresponde al formulario doméstico de emisión. Sin dirección útil se conserva exactamente el payload y XML previos. No se reescriben históricos ni se altera AccountingSupplierParty o la configuración del emisor. No requiere migración.

El front se entrega por ferry/m1-consulta-ruc, con ocho archivos productivos, dos archivos de pruebas, FERRY.md y SHA256SUMS. La página real /invoices/emision consulta al completar un RUC válido de 11 dígitos y módulo 11 vigente, con espera de 300 ms y el apiClient autenticado central. Rellena razón social y dirección editables; la edición viaja al contrato opcional nuevo. La selección del maestro conserva sus permisos, y los datos consultados no otorgan crédito, descuento ni indicadores tributarios.

El registro de clientes de Facturación (/invoices/clientes) y el alta desde emisión reutilizan PartnerFormDialog. Los únicos cambios compartidos fuera de invoices son aditivos y documentados: enableRucLookup=false por defecto, activado en Facturación; consulta solo RUC de cliente domiciliado PE. No se activa en proveedores ni terceros extranjeros. Las ediciones del documento, nombre o dirección, la selección del maestro y el desmontaje descartan respuestas tardías; tipo, país y roles también invalidan la consulta del registro. La apertura de una edición o formulario precargado no consulta por sí sola: la consulta sigue a la edición del RUC. Error, ausencia de RUC o respuesta inválida muestran aviso no bloqueante y mantienen entrada manual. Dirección ausente nunca se inventa.

Pruebas nuevas con dobles: contrato de API, documento incompleto/inválido/DNI, debounce, respuesta incorrecta, errores 404/503/red, dirección ausente, respuestas fuera de orden, edición manual y desmontaje; montaje de página real, payload de emisión, alta/guardado de cliente y registro desde emisión, aislamiento del emisor, preservación del maestro y exclusión por país/rol/tipo/opción. Backend verifica whitelist estricto, longitud/tipo del campo opcional, omisión/espacios vacíos sin cambios y dirección editada con escape XML; documento con firma ficticia validado por hoja oficial SUNAT local. Sin consumidores ni emisiones externas.

Verificación final: backend 352 suites / 3469 pruebas aprobadas (+1 suite / +10 pruebas contra main), mismas 4 suites / 38 pruebas omitidas y 12 snapshots aprobados. Frontend 168 archivos / 1308 pruebas aprobadas (+2 archivos / +32 pruebas), sin fallos ni omisiones. Cobertura local del código nuevo contra las bases: backend 1/1 líneas ejecutables con inicio instrumentado y 4/4 ramas nuevas (100%); frontend 47/47 líneas ejecutables y 48/48 ramas nuevas (100%). Los módulos nuevos useRucAutofill y rucApi tienen 100% en líneas, sentencias, funciones y ramas. Medición desde coverage-final.json y diff; no es una ejecución de SonarCloud. Builds correctos, siempre posteriores a Jest. Lint backend sin errores, con las mismas tres advertencias. ESLint de archivos front modificados conserva un error preexistente react-hooks/set-state-in-effect en InvoiceEmissionPage y tres advertencias preexistentes de Fast Refresh; el error se reprodujo en un checkout separado de da8f387 sin cambios. No se amplía el alcance para corregir deuda de lint. Front local ca356ce37e592f09edb5326d548708e7f1d36a92, sin push a ese repo.

Dependencia de promoción: desplegar primero fix/m1-receptor-direccion-ruc para aceptar customer_address; después aplicar el ferry sobre la base frontend verificada. No se crean PR ni se hace merge, despliegue, emisión real o acceso a producción. El token del proveedor no se reproduce ni se incorpora al repositorio.

## Paquete de auditoría M1 — fase 0

Rama única de entrega: fix/m1-paquete-auditoria. Bases confirmadas antes de modificar código: backend main ddaec671295a043ef4e6a7550c7e25c0ac17770d; frontend main 04c137fcba62b24e907876e5f646158c92f57461. Front trabajado en checkout separado sin crear otra rama; sus archivos se transportan bajo frontend/. No se crean PR ni se despliega.

Líneas base medidas: backend 343 suites / 3461 pruebas aprobadas, 17 suites / 93 pruebas optativas omitidas y 12 snapshots; frontend 170 archivos / 1318 pruebas aprobadas, sin omisiones. Comandos: NODE_OPTIONS=--max-old-space-size=6144 npm test -- --runInBand (back), npm test (front). Sin variables de integración, base compartida, migraciones ni envíos externos. Las pruebas nuevas usarán dobles.

1. **Confirmado.** liquidarComprobante, calcularFlujo, InvoiceEmissionPage e InvoiceEmitResumen permiten descontar ambos regímenes. El backend no solo declara: traducirEmision calcula la retención sobre el total cuando agente_retencion=true; calcularTotales acepta montoRetencion y lo resta junto con detracción. El XML usa los totales para retención, neto y cuotas; la leyenda 2006 corresponde a SPOT. Se corregirá la exclusión en cálculo, interfaz, serialización y servidor. Fundamento: R.S. 037-2002/SUNAT, art. 5, operación sujeta al sistema de detracciones excluida de retención: https://www.sunat.gob.pe/legislacion/superin/2002/037.htm . Los casos con un solo régimen conservarán su resultado.
2. **Detenido por contradicción normativa.** El defecto de retener sobre exoneradas/inafectas sí existe, también en el adaptador backend. Sin embargo, la norma citada en el encargo, R.S. 203-2003/SUNAT, trata percepciones en importación: https://www.sunat.gob.pe/legislacion/superin/2003/203.htm . Para retenciones rige la R.S. 037-2002/SUNAT: art. 2 delimita operaciones gravadas; art. 3 establece la excepción por pago y comprobantes de hasta S/700; art. 7 sitúa la retención en el pago y contempla pagos parciales. SUNAT confirma que los comprobantes comprendidos en retenciones no deben incluir operaciones no gravadas: https://orientacion.sunat.gob.pe/76-comprobante-de-pago-y-notas-de-credito-y-debito . Por ello no se presenta el ejemplo mixto de retención S/35.40 como un documento normativamente admitido ni se inventa una regla de umbral mixto. Se detiene este punto completo conforme a la regla de sorpresas, sin cambiar base/tasa/umbral. Requiere definir el tratamiento documental de operaciones mixtas antes de construirlo. El punto 1 solo suprime retención cuando hay SPOT efectivo.
3. **Confirmado para factura.** El front usa siete días para ambos tipos. CatalogoErrores.xml:2108 indica presentación fuera de fecha, sin fijar cifra. La cifra vigente se confirma en R.S. 000003-2023/SUNAT y orientación actual SEE del contribuyente: tres días calendario desde el siguiente a la emisión (https://www.sunat.gob.pe/legislacion/superin/2023/000003-2023.pdf y https://cpe.sunat.gob.pe/sistema_emision/see_contribuyente). Se parametrizará validación y mínimo por tipo. El catálogo local describe 2957 como exceso de plazo para baja, no como regla general de emisión; el texto y los siete días de boleta se conservan expresamente por instrucción del encargo, sin extrapolarlos a factura. Futuro y hoy en Lima permanecen iguales.
4. **Premisa de persistencia ausente no sostenida; sin cambio productivo.** Direcciones, Contactos y Bancos usan POST /master-data/partners/:id/addresses, /contacts y /bank-accounts y posterior GET /partners/:id. El backend comprueba empresa en getPartner antes de insertar en partner_addresses, partner_contacts o partner_bank_accounts, y el GET incluye las tres relaciones. El front no inserta filas optimistas: invalida y relee tras éxito; ante fallo conserva el formulario y muestra error. Esquema y migración histórica 20261105090000 ya contienen las tablas. Se añadirán pruebas con dobles de guardado/recarga y fallo sin fila ficticia. No es posible demostrar que el incidente externo fue de sesión con el código: causa concreta no confirmada. No se consulta la base compartida ni se ejecuta o crea migración.
5. **Confirmado parcialmente.** El alta envía email y phone y CreatePartnerDto los conserva; createPartner los asigna a business_partners. Los demás campos enviados (razón social, nombre comercial, país, dirección, moneda, roles, condiciones, crédito y descuento) también están mapeados. La pérdida de phone del tercero auditado no es reproducible en esta base y no se atribuye a una causa sin evidencia. Sí falta el contacto principal cuando hay email/teléfono sin contactName: el contacto solo se crea si existe contactName, campo que el alta de Facturación no solicita. Se extenderá esa condición usando como nombre de respaldo la razón social del tercero, sin inventar una persona; edición sin cambios. Se verificará el transporte y conservación del teléfono con dobles.
6. **Premisa no sostenida; sin cambio productivo.** PartnersPage ya distingue partners.isLoading de una lista vacía y muestra «No hay terceros registrados.». getPartners devuelve el array real del GET; no transforma una lista vacía en carga. Se probará búsqueda pendiente y posterior respuesta vacía sin tocar la lógica ni atribuir el incidente externo a una causa no probada.
7. **Confirmado.** PartnersPage interpola payment_terms sin formato y PartnerDetailDrawer también lo muestra crudo. Se incorporará un formateador único reutilizado en esos lugares y en las opciones del alta, conservando los valores enviados al backend y los términos personalizados.

### Paquete — punto 1: exclusión SPOT / retención

Se suprime la retención ante detracción efectiva en liquidarComprobante, flujo, resumen y página real. RetencionMaestro mantiene el indicador del maestro, pero no permite aplicar retención mientras haya SPOT, con explicación visible; al retirar SPOT vuelve a habilitarse. El serializador tampoco transmite ambas aplicaciones. El adaptador backend calcula cero retención con SPOT y el cálculo común protege también payloads fiscales que declaren ambos importes. No se modifica la base/tasa/umbral del régimen (punto 2 detenido).

Archivos back: ublTotalesHelper.ts, application/services/emitirComprobanteAdapter.ts, test/unit/invoices/paqueteSpotRetencion.spec.ts, test/fixtures/m1-paquete-regimenes-hashes.json. Front transportado: invoiceRetentions.ts, invoiceFlujoPago.ts, invoiceEmitPayload.ts, InvoiceEmissionPage.tsx, InvoiceEmitModal.tsx, InvoiceEmitResumen.tsx, RetencionMaestro.tsx y paqueteSpotRetencion.test.tsx (rutas completas en frontend/).

Verificación dirigida: 6 pruebas backend y 5 pruebas nuevas front aprobadas; suite de cálculos front existente también aprobada (38 pruebas combinadas). Dos hashes SHA-256 se obtuvieron ejecutando el adaptador y generador en un checkout separado de ddaec671, con fecha fija y fixtures: la respuesta serializada completa y el XML de SPOT solo y retención sola siguen byte a byte iguales. No intervienen firma ni transporte externos.

### Paquete — punto 2: detenido

No hay cambio productivo ni pruebas que legitimen los importes incorrectos actuales. El caso exonerada S/1000 + inafecta S/500 sigue siendo un defecto pendiente: sin SPOT, el código actual retiene S/45 por no discriminar la base. El ejemplo gravada S/1000 + IGV S/180 + exonerada S/500 plantea además el conflicto de comprobante mixto comprendido en retenciones descrito en fase 0. La decisión pendiente es separar los documentos gravados/no gravados y definir el alcance del cálculo al momento del pago; no basta cambiar silenciosamente el umbral dentro del mismo documento mixto. La evidencia normativa se limita a las fuentes oficiales enlazadas en fase 0. No se usa R.S. 203-2003 como sustento del régimen de retenciones.

### Paquete — punto 3: fecha por tipo

La validación y el mínimo del calendario reciben el tipo elegido: factura 01 permite tres días calendario y explica el error 2108; boleta 03 conserva siete días y su mensaje heredado íntegro. Las firmas conservan los parámetros existentes y añaden tipo al final, de modo que los consumidores anteriores siguen funcionando. Se conectan la página real, el modal y su campo de fecha. Las notas mantienen su validación previa de siete días: este punto no cambia reglas de notas ni el backend. Hoy en America/Lima, máximo de fecha y regla futura se conservan.

Archivos front: invoiceEmitFecha.ts, InvoiceEmissionPage.tsx, InvoiceEmitModal.tsx, InvoiceEmitCampos.tsx y paqueteFechaTipo.test.tsx. Pruebas dirigidas: 21 aprobadas, incluidas cinco nuevas por tipo, bordes de tres/siete días y cambio real del mínimo al elegir boleta/factura. Referencias oficiales y precisión sobre la etiqueta 2957 registradas en fase 0.

### Paquete — punto 4: persistencia existente verificada con dobles

Sin cambio productivo. Cuatro pruebas HTTP backend montan MasterDataController, AuthGuard, ValidationPipe y el servicio real sobre un doble de Prisma: POST de BCP/USD seguido de GET conserva la cuenta y las relaciones de ficha; sesión ausente/expirada devuelve 401 sin escritura; otro tenant devuelve 404; un fallo del almacenamiento devuelve 503 sin guardado aparente. Dos pruebas del drawer real y masterDataApi verifican endpoint/payload, recarga y reapertura, y que un rechazo 401 mantiene los campos y no agrega una fila. Esto no certifica la base desplegada ni prueba la causa histórica del incidente.

Archivos de pruebas: test/unit/customs/paqueteBancos.spec.ts y frontend/test/unit/modules/invoices/paqueteBancos.test.tsx. Seis pruebas aprobadas. Punto detenido para cambios de persistencia porque la premisa de ausencia no se sostiene. No se ejecutó migración alguna, ni se inspeccionó o alteró la base compartida.

### Paquete — punto 5: contacto principal del alta

createPartner crea el contacto principal si hay nombre de contacto, email o teléfono útiles. Sin nombre explícito utiliza la razón social existente como identificación del contacto, manteniendo email/teléfono y el patrón de OFICINA_CENTRAL; sin datos de contacto no crea registros ficticios. Se reutiliza partner_contacts existente: sin migraciones ni cambios en updatePartner. Los campos generales del alta permanecen en sus columnas actuales.

Archivos: src/modules/customs/application/services/masterDataService.ts, test/unit/customs/paqueteContactoPrincipal.spec.ts y frontend/test/unit/modules/invoices/paqueteContactoAlta.test.tsx. Seis pruebas nuevas backend (email solo, teléfono solo, ambos, nombre explícito/dirección, ausencia de datos y mapeo general) y una prueba del formulario real aprobadas; el conjunto con masterDataService.spec.ts suma 23 pruebas backend aprobadas. DTO con whitelist conserva phone. No se corrige a ciegas el teléfono de un tercero real ni se modifica edición: no hay pérdida reproducible en esa ruta de la base actual.

### Paquete — punto 6: estado vacío existente

Sin cambio productivo: una prueba del PartnersPage real con masterDataApi confirma que una búsqueda en Facturación muestra «Cargando terceros...» mientras su promesa está pendiente, y al responder el GET con [] termina mostrando «No hay terceros registrados.» sin indicador de carga. Verifica también el filtro CLIENTE y el texto q enviados. Archivo: frontend/test/unit/modules/invoices/paqueteBusquedaVacia.test.tsx; una prueba aprobada. No se reproduce la premisa en 04c137fc y se detiene la corrección de lógica para no alterar un comportamiento ya presente. Una solicitud real que nunca termina exige evidencia de red/sesión para diagnosticarla; no se afirma una causa externa con estas pruebas.

### Paquete — punto 7: etiquetas de condiciones de pago

Un único formateador traduce CONTADO, 15_DIAS, 30_DIAS, 45_DIAS, 60_DIAS y CARTA_CREDITO a etiquetas humanas. Lo reutilizan tabla, ficha y opciones del alta; los valores de las opciones y del payload no cambian. Conserva términos personalizados y textos de ausencia según la vista, sin resolver propiedades heredadas del objeto como etiquetas.

Archivos front: src/modules/customs/lib/paymentTerms.ts, pages/PartnersPage.tsx, components/PartnerDetailDrawer.tsx, components/PartnerFormDialog.tsx y test/unit/modules/invoices/paquetePaymentTerms.test.tsx. Trece pruebas nuevas aprobadas; junto con clientesRoute.test.tsx, 32 pruebas aprobadas. El contexto compartido mantiene permisos y acciones previas.

### Paquete — cierre de verificación y entrega

Una rama única fix/m1-paquete-auditoria, un commit por punto más registro inicial y cierre del ferry. Los ajustes de regresiones se integran en sus commits correspondientes: punto 1 incorpora también test/unit/invoices/m1-retencion-unificada.spec.ts, test/unit/invoices/m1-spot-credito-regresion.spec.ts y los tests front invoiceRetencionUnificada.test.tsx / invoiceSpotCentimos.test.tsx para validar cuotas sin doble régimen; punto 3 ajusta el fixture de factura de invoiceCazaForm.test.tsx a hoy en Lima, conservando su comprobación de errores del formulario. No se retiran pruebas ni controles de rechazo. FERRY.md contiene los SHA y las rutas completas por punto.

Resultado final backend: 346 suites / 3477 pruebas aprobadas (+3 suites / +16 pruebas frente a fase 0), mismas 17 suites / 93 pruebas optativas omitidas y 12 snapshots aprobados. Frontend: 176 archivos / 1345 pruebas aprobadas (+6 archivos / +27 pruebas), sin omisiones. Suites completas finales sin fallos. Ambos builds correctos, ejecutados secuencialmente después de terminar Jest, sin regeneración concurrente de Prisma. Las pruebas nuevas emplean dobles y fixtures; no hay emisiones reales ni acceso a SUNAT productiva.

Lint backend sin errores, con tres advertencias preexistentes. ESLint de los archivos front modificados tiene tres errores y tres advertencias idénticos a los reproducidos en un checkout intacto de 04c137fc: effects/ref de React y Fast Refresh. El formateador nuevo pasa lint. No se afirma que el lint global esté verde.

Entrega: 22 archivos de frontend (13 productivos y 9 de pruebas) bajo frontend/, FERRY.md y SHA256SUMS. Manifiesto generado después de las verificaciones y cotejo byte a byte con el front probado. Sin nuevas dependencias, cambios de esquema, migraciones ejecutadas o nuevas, base compartida, PR, despliegues ni modificación de documentos históricos.

Límites expresos: punto 2 detenido completo por contradicción normativa y necesidad de decidir el tratamiento documental del caso mixto; su defecto sobre exoneradas/inafectas queda pendiente. Puntos 4 y 6 sin corrección productiva porque sus premisas no se sostienen, con pruebas que demuestran la conducta actual y sin atribuir una causa a incidentes externos. En punto 5, contacto principal corregido y transporte de teléfono demostrado con dobles; no se repara ni se afirma diagnosticar el tercero real auditado. Boletas y notas conservan su regla previa de fecha; la ventana de tres días se conecta solo a factura 01.

## Retención en documentos sin operación gravada — fase 0

Rama fix/m1-retencion-sin-gravada creada directamente desde fix/m1-paquete-auditoria, commit 38a6402371b7969cce005315eabad72ca1c34079. El front de trabajo reconstruye exactamente el main 04c137fcba62b24e907876e5f646158c92f57461 más los 22 archivos de frontend/ del paquete; no se crea rama de entrega en el repo front.

Base medida de nuevo antes de cambiar código: backend 346 suites / 3477 pruebas aprobadas, mismas 17 suites / 93 pruebas optativas omitidas y 12 snapshots; front 176 archivos / 1345 pruebas aprobadas. Dependencias y locks coinciden byte a byte con los ya instalados para el paquete; se reutilizan esas instalaciones tras retirar únicamente instalaciones incompletas por falta de espacio, sin cambiar dependencias.

Premisa confirmada y ambas capas distinguibles. Front: liquidarComprobante conoce opGravada; calcularFlujo, InvoiceEmissionPage e InvoiceEmitResumen disponen del gravado de liquidarDescuentoGlobal. El helper escalar calcularRetencion solo recibía total/indicador/moneda/SPOT, por lo que debe recibir también la base gravada desde sus consumidores documentales. Backend: traducirEmision conoce bases.gravado después de descuentos; calcularTotales usa el desglose tributario o montoGravado agregado; el puente contable M1 también conoce gravadoR en sus dos caminos antes de leer montoRetencion. No se infiere la ausencia de operación gravada a partir del total o del IGV aislado.

Regla acotada: con base gravada exactamente cero, retención cero, aun con agente de retención y total mayor al umbral. Se mantiene la exclusión por SPOT del paquete. No se modifica base, umbral, tasa ni comportamiento de los mixtos: gravada 1000 + IGV 180 + exonerada 500 conserva retención 50.40 sobre total 1680; gravada pura 1000 + IGV 180 conserva 35.40. El punto 2 del paquete sigue detenido exclusivamente para el tratamiento de documentos mixtos; este encargo resuelve el caso puro sin reabrirlo. No hay capas detenidas.

### Retención sin operación gravada — construcción

El front informa la base gravada al helper escalar desde liquidarComprobante, flujo, resumen y página de emisión. La fábrica de comprobantes de demostración también distingue su afectación y transmite base cero en los casos no gravados; no se cambian sus restantes importes ni su política previa. El parámetro adicional del helper es opcional por compatibilidad con usos escalares sin contexto, mientras todos sus consumidores documentales ahora aportan la base conocida.

El adaptador backend solo calcula retención cuando la base gravada no es cero y no hay SPOT efectivo. Los totales UBL suprimen la retención declarada si su base gravada es cero, tanto con desglose como con agregado. Los dos caminos del puente contable M1 aplican la misma exclusión antes de leer la retención, evitando que sobreviva una declaración entrante positiva sin operación gravada. No se cambian tasa, umbral, moneda, neto de mixtos ni cálculos de otros regímenes.

Pruebas dirigidas con dobles/fixtures: 11 backend y 12 front aprobadas. Se prueban exonerada sola, inafecta sola, exo+inafecta, gratuita, gratuita con bolsas e ICBPER superior al umbral, base agregada cero, caminos del puente, helper, liquidación, flujo, resumen, fábrica y página real. Las regresiones fijan gravada pura 1180/35.40/1144.60 y mixto 1680/50.40/1629.60 (total/retención/neto), manteniendo el comportamiento previo del paquete. Sin emisiones externas, migraciones, cambios de configuración ni reparación de documentos persistidos.

### Retención sin operación gravada — verificación final y ferry

Backend final: 347 suites / 3488 pruebas aprobadas (+1 suite / +11 pruebas contra 38a64023), mismas 17 suites / 93 pruebas optativas omitidas y 12 snapshots. Front final: 177 archivos / 1357 pruebas aprobadas (+1 archivo / +12 pruebas contra la composición del paquete), sin omisiones. Ambas suites completas sin fallos. Los builds back y front pasan, ejecutados secuencialmente después de terminar Jest; no se regenera Prisma mientras se ejecutan las pruebas.

Lint backend sin errores, con las tres advertencias preexistentes. En los cinco archivos productivos del front de este encargo, ESLint conserva el error preexistente react-hooks/set-state-in-effect de InvoiceEmissionPage; no se modifica esa deuda ni se declara el lint global verde.

Archivos backend: src/modules/invoices/application/services/emitirComprobanteAdapter.ts, src/modules/invoices/ublTotalesHelper.ts, src/modules/invoices/application/services/invoiceBridgeCoordinatorService.ts y test/unit/invoices/retencionSinGravada.spec.ts. Front delta: src/modules/invoices/lib/invoiceRetentions.ts, src/modules/invoices/lib/invoiceFlujoPago.ts, src/modules/invoices/components/InvoiceEmitResumen.tsx, src/modules/invoices/pages/InvoiceEmissionPage.tsx, src/modules/invoices/data/invoiceDemoTypes.ts y test/unit/modules/invoices/retencionSinGravada.test.tsx, todos bajo frontend/ en la rama backend. FERRY.md explica aplicación incremental de esas seis rutas o aplicación completa sobre el main front base más paquete. SHA256SUMS se regenera para todos los 24 archivos transportados y FERRY.md; cada archivo se coteja contra el checkout probado.

No hay capas detenidas. El ejemplo auditado exonerada 1000 + inafecta 500 queda con total/neto 1500 y retención cero. Mixto y gravado puro conservan los importes fijados en fase 0; el caso mixto no se reabre. Sin PR, despliegue, emisiones reales, migraciones, cambios de dependencias ni modificaciones de registros históricos. La auditoría del paquete se conserva íntegra y estas secciones son aditivas.

## Pulidos M1 — fase 0

Rama única fix/m1-pulidos creada desde main backend c663ea3ee0d3a5c34c97af9993d284a14892da3f. Frontend main confirmado: 3e4497367363c70d7c774c1d9dc0b65b221a120f. Las bases ya contienen el paquete de auditoría y la exclusión de retención sin gravada. Front trabajado en checkout separado sin rama de entrega; los cambios se transportan bajo frontend/ en la misma rama backend.

Líneas base medidas antes de modificar código: backend 347 suites / 3489 pruebas aprobadas, 17 suites / 93 pruebas optativas omitidas y 12 snapshots; frontend 177 archivos / 1357 pruebas aprobadas, sin omisiones. Comandos: NODE_OPTIONS=--max-old-space-size=6144 npm test -- --runInBand y npm test. Dependencias reutilizadas tras cotejar package.json y package-lock.json sin diferencias. Sin credenciales reales ni emisiones externas.

A — Confirmado. GET /invoices/alertas existe y solo informa certificado y DLQ. Invoice.fecha_emision y tipo_comprobante permiten calcular plazos de facturas 01 (3 días) y boletas 03 (7 días), usando el día civil de emisión persistido y hoy en America/Lima. Se añadirán documentos PENDIENTE/EN_COLA/PROCESANDO/ENVIADO/ERROR_RED/RECHAZADO, con aislamiento de empresa, fecha límite y días restantes, ordenados por urgencia. Se excluyen ACEPTADO/OBSERVADO/ANULADO y tipos sin ventana definida en este encargo (notas/agregados). Son avisos de plazo, no autorizaciones de reenvío; no se escribe ni encola. Se mantienen las ventanas y etiquetas 2108/2957 que ya aplica el sistema; no se reinterpreta aquí el catálogo de bajas.

B — Confirmado con distinción fiable en el contrato existente. RucConsultaService convierte HTTP 404/422 en RUC_NO_ENCONTRADO; una respuesta válida exige RUC coincidente, razón social, estado y condición no vacíos. Un inactivo se representa como consulta exitosa con estado distinto de ACTIVO; no se confunde una excepción de consulta con un estado tributario. Se reutilizará ese servicio configurado, sin llamar Decolecta en pruebas. La ruta HTTP real de emisión pasa por AtomicInvoiceCreationService, que construye manualmente el servicio de emisión dentro de una transacción: el aviso debe consultarse después de resolver la transacción, con espera acotada, sin modificar persistencia, encolado ni respuesta fiscal guardada por idempotencia. Error, timeout, ausencia de RUC o respuesta inválida no producirán aviso ni impedirán la emisión. Solo se consulta al receptor RUC, nunca al emisor.

C — Confirmado parcialmente y alcance precisado. La pantalla InvoiceSettingsPage, useInvoiceConfig y InvoiceIssuerConfigForm ya ejecutan un PUT real y recargan configuración para los campos editables. El defecto es específico del RUC: el campo es readOnly, ConfiguracionInput no tiene issuer_ruc y el front no presenta origen_ruc. El backend ya admite issuer_ruc de 11 dígitos exactos o null para limpiar; devuelve ruc efectivo y origen_ruc (issuer_config/company). Se añadirá edición del RUC M1 y su origen, guardado por el PUT existente, limpieza con null y presentación de errores del servidor. No se modifica el RUC compartido de empresa/sesión ni backend en este punto. No hay puntos detenidos.

### Pulidos — punto A: antigüedad de envío

GET /invoices/alertas añade antiguedad con evaluado, gravedad, mensaje y documentos (id, número, tipo, estado, fechaEmision, fechaLimite y diasRestantes). Se leen únicamente facturas/boletas de la empresa del token en estados pendientes o de error; no hay escrituras ni encolado. Se conserva el día fiscal persistido sin desplazarlo por zona horaria y se compara con hoy en Lima. Se ordena por días restantes, fecha de emisión e id; los vencidos tienen días negativos. Plazo hasta mañana/hoy/vencido es CRITICO, resto pendiente AVISO y lista vacía evaluada OK. Fallo de lectura o tenant ausente produce SIN_DATOS, nunca una falsa lista vacía evaluada.

El Monitor muestra una tarjeta de plazo con los diez documentos más urgentes y el total; el endpoint incluye todos los elegibles. El resumen de facturación incorpora el motivo de plazo para no atribuir una gravedad nueva al certificado o DLQ. El normalizador tolera respuestas anteriores sin el campo. Notas/agregados no reciben una ventana inventada. RECHAZADO se incluye como error sin inferir que sea recuperable o autorizar reenvío.

Archivos backend: invoiceSendAge.ts, invoiceAlertService.ts y pulidosAntiguedad.spec.ts. Front: invoiceAlertas.ts, InvoiceSendAgeAlert.tsx, InvoiceMonitorPage.tsx, InvoicesDashboardPage.tsx y pulidosAntiguedad.test.tsx; rutas completas en el ferry. Siete pruebas nuevas backend y tres front aprobadas; conjuntos con las regresiones anteriores, 29 y 11 pruebas respectivamente. Bordes 3/7 días, cambio UTC/Lima, vencimiento, orden mixto, estados finales, aislamiento, fallo y montaje real del Monitor verificados con dobles.

### Pulidos — punto B: aviso de padrón del receptor

AtomicInvoiceCreationService.emitir conserva primero el resultado fiscal confirmado y después consulta RucConsultaService para el RUC del receptor. La consulta está fuera de la transacción y de la respuesta fiscal almacenada por idempotencia, con espera máxima de 2000 ms. Solo una respuesta completa y coincidente permite avisar: estado distinto de ACTIVO y/o condición NO HABIDO. Se agregan los avisos sin sustituir los anteriores; no se modifica el documento, su número, sus importes ni su cola. En una repetición idempotente se conserva la emisión y el aviso se consulta nuevamente con la caché existente, sin repetir persistencia.

404/422, 503, error de red, datos inválidos, timeout o RUC inexistente mantienen exactamente la respuesta confirmada sin añadir aviso. DNI, tipo extranjero o RUC inválido no disparan consulta. El proveedor puede completar su caché después del límite; ese resultado tardío no altera la respuesta ya devuelta. No se consulta identidad del emisor. La UI ya presenta avisos de la respuesta de emisión, por lo que este punto no requiere cambios front.

Archivos: atomicInvoiceCreationService.ts, receiverRucWarning.ts y pulidosPadronReceptor.spec.ts. Catorce pruebas nuevas aprobadas; junto con creación atómica y Decolecta anteriores, 78 pruebas aprobadas. Se demuestra con el adaptador real y fetch doble que HTTP 200 con BAJA DEFINITIVA genera aviso y que 404/422 no lo generan; también orden posterior a confirmación, espera acotada y conservación de avisos. No se llama al proveedor real en pruebas ni se cambian sus variables o credenciales.
