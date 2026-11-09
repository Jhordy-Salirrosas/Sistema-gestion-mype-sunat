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

### Límite de alcance pendiente para Parte 2

No se modificó Resiliencia ni Contabilidad. El reintento manual solicitado en
2.1 llama boss.retry(INVOICE_DLQ, id) dentro de QueueService.retryDlq; la política
de INVOICE_QUEUE (2.2) también se declara en ese archivo de Resiliencia.
La conciliación antes de cada reintento de transporte (2.4) vive dentro del
bucle de InvoiceRetryService, también en Resiliencia. Se solicitó aclarar si
se autorizan esos cambios puntuales, dado el límite explícito de usar solo
interfaces existentes. Las Partes 2 y 3 no se declaran implementadas.

Validación de cierre Parte 1: backend 238 suites/2105 pruebas aprobadas;
4 suites/20 pruebas optativas omitidas. Frontend 96 archivos/753 pruebas
aprobados. Build y lint de ambos repos aprobados; control de secretos aprobado.
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
