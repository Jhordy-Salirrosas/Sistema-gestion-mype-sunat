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

La validación oficial completa sigue BLOQUEADA por dependencias XSL ausentes. No se afirma que las comprobaciones internas sean XSD oficial. Hasta resolver esa dependencia, los despachos externos quedan bloqueados de forma explícita. Tampoco se ha desplegado ese cambio.

## Parte 6: cotejo de CDR y consulta segura

Se verifica ReferenceID al recibir y recuperar CDR. Un CDR ajeno/ausente no acepta la factura: deja resultado incierto, auditado y no reintentable automáticamente. Las escrituras de persistencia del CDR también condicionan el estado para no degradar un final concurrente.

Nueva ruta autenticada `POST /api/v1/invoices/:id/consultar-sunat`: selecciona el documento por tenant, usa exclusivamente getStatusCdr y devuelve metadatos, sin cola ni emisión. La verificación SOL real de F001-00000060 queda pendiente de acceso al sistema desplegado; la ruta nueva no está desplegada.

La política de reenvío tras una consulta incierta y la transición atómica a DLQ siguen bloqueadas: requieren modificar InvoiceRetryService/InvoiceDlqService de Resiliencia. La unicidad común de efectos contables requiere Contabilidad. No se modificaron esos módulos.

## Parte 7: precisión, redondeo e ICBPER

Se centraliza HALF_UP decimal (Prisma.Decimal): dos decimales para importes, diez para bases unitarias. Se preserva el precio final ingresado y se desglosa por línea, evitando redondear primero la base unitaria. PriceAmount conserva precisión; los bloques TaxTotal de cabecera no duplican ICBPER.

`cantidadBolsas` permite declarar cantidades enteras: el servidor liquida S/ 0.50 por bolsa. El importe legado solo se acepta si coincide con cantidades enteras comprobables. No se infiere que un producto es bolsa; falta un indicador persistido en el maestro para imponer ese control desde producto, fuera de esta parte. SPOT se mantiene APARCADO: la base en operaciones mixtas queda pendiente de definición normativa de Jhordy, sin cambio de algoritmo ni de tasas.
