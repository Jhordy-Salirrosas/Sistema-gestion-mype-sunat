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
