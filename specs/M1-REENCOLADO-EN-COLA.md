# M1: reconciliación de comprobantes en cola — diagnóstico pendiente

## Evidencia reportada

Según la observación de producción comunicada el 5 de noviembre, F001-00000057 quedó firmada y en estado EN_COLA; su job agotó los reintentos y los reinicios posteriores no la retomaron. Esta rama no ha consultado la base ni los logs de producción y no modifica comprobantes.

## Costura encontrada

`PrismaInvoiceRepository.saveWithTransactionalOutbox` llama a `QueueService.enqueueInvoiceInTx` y descarta el identificador devuelto. El modelo `Invoice` no almacena un identificador de job. La cola solo guarda `invoice_id` y `company_id` en el payload de pg-boss. `QueueService` pertenece a Resiliencia, mantiene `boss` privado y no expone una operación para verificar por comprobante jobs vivos y en DLQ y encolar de forma atómica e idempotente. La URL de pg-boss puede diferir de la base de Prisma.

Consultar primero y encolar después no garantiza unicidad entre dos instancias, un reintento manual y el reconciliador. Filtrar solo por estado de factura tampoco demuestra que el comprobante no esté en DLQ. Por esas razones no se implementó un reencolado que pudiera producir envíos duplicados ni saltarse la revisión manual.

## Coordinación necesaria

El dueño de Resiliencia debe acordar una operación de reconciliación que consulte la cola real y su DLQ por `invoice_id`, con una garantía atómica de exclusión frente a otros reconciliadores y productores, y que exponga un resultado seguro a M1. Debe contemplar instalaciones con bases de cola y aplicación separadas y el identificador de job realmente disponible. La selección de M1 debe limitarse a estados de espera autorizados, comprobar nuevamente su estado antes de encolar y registrar serie y correlativo. Un fallo debe registrarse sin impedir el arranque.

La recuperación automática de F001-00000057 **no está implementada ni verificada**; su estado real, la presencia en DLQ y la idempotencia del envío requieren confirmación antes de cualquier reintento.
