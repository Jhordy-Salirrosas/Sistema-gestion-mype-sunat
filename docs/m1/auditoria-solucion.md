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
precio obsoleto. Los descuentos siguen su contrato existente. Las notas 07/08
quedan expresamente fuera del cotejo de precio de catálogo y no se reprecian:
conservan las líneas/precios del origen, incluso si hoy no hay sale_price.

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

**Decisión y persistencia sin migración:** M1 clasifica el historial COMPLETO
(`transaction_history`, sin límite de filas). Un evento explícito de bloqueo
previo XSL, sin inicio/resultado de transporte posterior, es
BLOQUEO_PREVIO_PROBADO: se resuelve el marcador presunto y se permite el envío.
Un inicio/resultado de transporte sin resultado final es ENVIO_INCIERTO.
Lo demás es EVIDENCIA_INSUFICIENTE: conserva la protección y exige consulta.
Un empate de fecha entre bloqueo y transporte no autoriza a descartar el envío.
Ni el número de intento ni la ausencia de eventos de red prueban por sí solos
que nunca salió. Rescates manuales y consultas inconclusas no se cuentan como
intentos de transporte.

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
al origen, sin ofrecer productos no vendibles para nuevas ventas. Conservar
precios/unidad/afectación del origen; advertencia específica cuando sea histórico,
y nunca afirmar inexistencia si la consulta falla o todavía carga.
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
