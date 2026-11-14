# Registro de depósitos de detracción

## Fase 0

Rama: `fix/m1-detracciones-registro`.

- Back main: `9f61bc553955d6e2c332bc35780c5865aeb62e6d`.
- Front main: `8393ea1c72b865d2c4442147e2453f479e11c84b`.
- Líneas base verdes antes de modificar código: back 401 suites / 4034 pruebas (4 suites y 38 pruebas omitidas; 12 snapshots); front 182 archivos / 1404 pruebas. Back usa PostgreSQL local con las migraciones existentes, sin aplicar cambios nuevos.

### Veredictos

1. Confirmado. `InvoiceDetractionService.registerDeposit` recorta la constancia pero admite texto libre. El formulario `InvoiceDetractionsPage` tampoco limita su contenido. Se valida únicamente en nuevos guardados; lecturas históricas sin normalización.
2. Confirmado. El guardado sobrescribe los tres campos simples sin evento ni actor. Existe `transaction_history`, expuesto por `InvoiceQueryService.detalle` y mostrado por `InvoiceAuditTrail`. Se reutiliza con un evento local que conserva el estado fiscal, valores anteriores/nuevos y actor autenticado. Escritura y evento atómicos.
3. Confirmado y viable. No hay tabla de movimientos: solo `invoices.detraccion_deposited_at`, `detraccion_deposited_amount` y `detraccion_constancia`. El único consumidor operativo de estos tres campos es `InvoiceDetractionService.list`, usado por la pantalla Detracciones. No los consumen XML, PDF, puentes contables ni otros módulos. Se mantienen como resumen derivado: suma de montos y fecha/constancia del movimiento más reciente por fecha, creación e identificador. La API añade movimientos y saldo, sin retirar los campos anteriores.

Se entrega esquema, SQL y script manual con checksum. El SQL preserva los registros previos como movimientos históricos, incluidas constancias no numéricas; las nuevas altas/ediciones exigen solo dígitos o vacío. Una comprobación previa detiene la aplicación ante datos históricos incompletos o importes inválidos para evitar pérdidas silenciosas. La suma se protege en el servidor bajo bloqueo de la factura, dentro de la misma transacción que el movimiento, el resumen y el evento. No se crean tablas de historial ni se realizan emisiones.

No se ejecutará la cola oficial de migraciones ni se aplicará el cambio a una base compartida. Las pruebas del esquema nuevo usarán SQL explícito y una base PostgreSQL exclusivamente local y aislada. El despliegue del backend que utiliza la tabla requiere la aplicación manual previa.

El ferry de este encargo se compone sobre el main frontend indicado; reemplaza el inventario histórico heredado de otros encargos y transporta solo los archivos de este registro.

## Punto 1 — constancia numérica

Back y formulario admiten vacío o dígitos ASCII, conservando ceros iniciales; recortan espacios exteriores. Texto no numérico se rechaza con «La constancia debe contener solo dígitos o quedar vacía.». Las lecturas no se modifican. Pruebas dirigidas: back 22 pruebas, front 18 pruebas. El ferry contiene únicamente los archivos de este encargo, sobre el main frontend confirmado.

## Punto 2 — historial del depósito

El guardado bloquea la factura de la empresa autenticada y escribe el depósito y un evento `M1_DETRACTION_DEPOSIT` en una sola transacción. El evento conserva el estado fiscal y registra actor, fecha, monto y constancia anteriores/nuevos; el detalle lo presenta con texto legible en su historial existente. No se crea tabla de auditoría. El controlador exige actor autenticado. Pruebas dirigidas: 3 suites / 26 pruebas, incluyendo la ruta real y el formato mostrado por el detalle.

## Punto 3 — movimientos complementarios

Se añade `InvoiceDetractionDeposit`, con clave foránea compuesta por empresa/factura, índice de consulta y restricciones de monto positivo y constancia nueva numérica. La marca interna `legacy` conserva las constancias anteriores; no se acepta desde el payload. Cada edición la desactiva tras validar los valores nuevos. El back permite alta mediante `POST /invoices/detractions/:id` y edición de un movimiento mediante `PUT /invoices/detractions/:id/deposits/:depositId`. Monto y fecha son explícitos; monto positivo con hasta dos decimales. No se ofrece eliminación.

Todas las altas/ediciones bloquean la misma fila de factura antes de leer los movimientos. La suma se calcula con Decimal; nunca puede superar la detracción. Movimiento, resumen y evento se confirman o revierten juntos. La edición verifica pertenencia del movimiento a la factura/empresa. El resumen conserva los nombres y tipos anteriores: monto acumulado y fecha/constancia del último movimiento por fecha, creación e id. La lista agrega `deposits`, `depositedTotal` y `balance`.

El formulario muestra los movimientos, su constancia, acumulado y saldo; permite agregar complementos con constancia nueva y editar un movimiento elegido. Bloquea importes sobre el saldo disponible (al editar, añade el importe previo al tope) y presenta la validación del servidor ante concurrencia. El historial local se excluye de la clasificación de errores fiscales/reintentos para que no oculte una evidencia anterior; sigue visible en el detalle.

### Aplicación manual del esquema

- SQL: `prisma/migrations/20261116100000_invoice_detraction_deposits/migration.sql`.
- Aplicador: `scripts/manual/apply-detraction-deposits.cjs`.
- Instrucciones: `scripts/manual/README-detraction-deposits.md`.
- Checksum SQL: `scripts/manual/detraction-deposits.sha256`.
- SHA-256 del SQL: `1ebdceeaf2077684fef22a8e46f626587f3b3b938afc9d85b8803054551ba8ef`.

Con `MANUAL_DATABASE_URL` definido explícitamente, `node scripts/manual/apply-detraction-deposits.cjs --check` solo verifica; `--apply` aplica únicamente este SQL en una transacción y registra su checksum en `_prisma_migrations`. No lee `.env` ni ejecuta `migrate deploy`. El backend nuevo requiere esta aplicación antes de desplegar. No se ha aplicado a ninguna base compartida.

Prueba operativa local del aplicador: un resumen histórico por encima de su detracción detuvo la ejecución sin crear tabla; tras retirar exclusivamente ese fixture inválido, la aplicación preservó literalmente un depósito de 40.00 y constancia `ABC-histórica`. Una segunda aplicación verificó el estado sin duplicar el movimiento ni la entrada de `_prisma_migrations`. Se comprobaron restricciones, índice, acumulado y resumen posterior. La copia histórica no genera eventos ficticios de usuario. Las pruebas de integración cubren también concurrencia, rollback del historial y edición de una constancia histórica.


## Cierre

Los tres puntos quedan construidos; no hay puntos detenidos. Bases confirmadas: back `9f61bc553955d6e2c332bc35780c5865aeb62e6d`, front `8393ea1c72b865d2c4442147e2453f479e11c84b`.

| Capa | Línea base | Final |
| --- | --- | --- |
| Back con PostgreSQL local | 401 suites / 4034 pruebas | 403 suites / 4049 pruebas |
| Front | 182 archivos / 1404 pruebas | 183 archivos / 1417 pruebas |

Suites completas verdes: +15 pruebas back y +13 front. Back conserva 4 suites / 38 pruebas omitidas y 12 snapshots aprobados. La primera pasada conjunta falló únicamente en la aserción de tiempo de outbox (respuestas por encima de 800 ms); la repetición completa del back, sin front en paralelo, pasó en 221.45 segundos. No se cambió el código de outbox ni su umbral. Builds completos back/front y lint backend OK. Prisma se generó fuera de las suites. El chequeo general `tsc --noEmit` también incluye el ferry y pruebas históricas ajenas al build; no constituye un check verde de esta base. El build oficial del back usa tsconfig.build.json y pasó.

Entrega en orden: fase 0 `5a41aa79`, punto 1 `baa2e614`, punto 2 `95753dfb`, punto 3 en el commit de movimientos que contiene este cierre. El ferry transporta cuatro archivos frontend y FERRY.md: cinco entradas SHA-256 verificadas. El SQL lleva su checksum separado y script manual probado. No se aplicó el esquema a bases compartidas ni se ejecutó la cola oficial de migraciones. Sin PR, despliegues ni emisiones reales.
