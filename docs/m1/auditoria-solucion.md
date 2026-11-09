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
