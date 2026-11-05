# M1 — resto declarado: cola offline D12

La recuperación automática tras indisponibilidad de SUNAT no queda demostrada ni habilitada por este cambio. No ejecutar una emisión para comprobarla hasta coordinar el contrato con Resiliencia y verificarlo con pruebas e integración.

## Costura actual

`InvoiceJobConsumer.procesar` llama a `InvoiceRetryService.processWithRetry`. Si el circuito está abierto, el resultado lleva `circuitoAbierto: true`, pero el consumidor retorna normalmente. `QueueService.registerInvoiceWorker` espera el handler y al terminar pg-boss completa el trabajo. El mensaje del servicio que dice que queda en cola no garantiza que exista otro job. La cola se crea con `retryLimit: 0`; lanzar una excepción genérica tampoco garantiza una reprogramación: puede mandar el trabajo a la DLQ. `enqueueInvoiceInTx` crea un trabajo inmediato y no expone demora ni identificación del job en curso. Por tanto, M1 no puede garantizar reprogramación durable y sin duplicados usando la API actual.

## Contrato para coordinar con Resiliencia

Exponer al handler de facturas una operación explícita y durable para diferir el trabajo actual hasta una fecha, con identidad del trabajo y resultado comprobable. La operación debe impedir que el wrapper lo marque completado al diferirlo, preservar `invoice_id` y `company_id`, y garantizar que un fallo o reinicio no pierda el trabajo ni genere copias activas. Debe acordarse con el dueño cómo usar las garantías transaccionales y de idempotencia de pg-boss, sin duplicar el backoff ni reiniciar indefinidamente su presupuesto de intentos.

El contrato también debe definir el estado persistido y el contador por tenant para el Monitor mientras espera, el intervalo de prueba del circuito, la conciliación antes de repetir un envío de resultado incierto y el tratamiento de facturas ya terminales. Deben probarse la caída, reinicio, apertura/cierre del circuito, reanudación, duplicados, aislamiento de tenant y transición a DLQ; además debe prepararse una guía de demostración que el operador ejecute voluntariamente con datos autorizados. Hasta entonces no se afirma que D12 está listo.
