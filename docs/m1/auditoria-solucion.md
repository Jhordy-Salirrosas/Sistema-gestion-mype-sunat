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
