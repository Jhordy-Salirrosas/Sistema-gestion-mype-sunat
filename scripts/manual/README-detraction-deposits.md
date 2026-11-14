# Aplicación manual de movimientos de detracción

Detener temporalmente las escrituras de depósitos durante la aplicación y desplegar back/front en el mismo tren. Respaldar antes la base elegida. El script no lee .env, no usa DATABASE_URL ni ejecuta la cola de migraciones. Requiere Node y la dependencia pg ya instalada, permisos DDL y de escritura en _prisma_migrations, y una base cuyo esquema contenga las columnas actuales de depósitos y la clave única (company_id,id) de invoices.

1. Revisar `prisma/migrations/20261116100000_invoice_detraction_deposits/migration.sql` y verificar `sha256sum -c scripts/manual/detraction-deposits.sha256`.
2. Definir MANUAL_DATABASE_URL mediante el mecanismo seguro del entorno, sin incluir su valor en documentos ni commits.
3. Ejecutar `node scripts/manual/apply-detraction-deposits.cjs --check`. Es solo lectura. Detiene ante migraciones sin finalizar, tabla no registrada, datos incompletos o importes incompatibles.
4. Aplicación explícita: `node scripts/manual/apply-detraction-deposits.cjs --apply`. Bloquea escrituras de invoices, crea solo la tabla y su índice/restricciones, copia literalmente los depósitos previos, verifica resumen y límite, y registra el checksum del SQL en _prisma_migrations. Todo es una transacción; si falla se revierte también el registro de migración. No crea eventos ficticios por la copia histórica.
5. Repetir `--check`: verifica también resumen y restricciones de la tabla aplicada. Repetir `--apply` con el mismo checksum solo verifica y no duplica movimientos ni registros. Una tabla preexistente sin registro o un checksum distinto exigen revisión manual y no se certifican automáticamente.
6. Generar Prisma y desplegar backend y ferry. Verificar en la lista de Detracciones los depósitos, total y saldo; no se requiere emitir documentos fiscales.

La marca legacy permite conservar constancias históricas no numéricas. No es un campo del payload de escritura: altas/ediciones del servicio siempre la fijan a false y validan la constancia. El resumen mantiene el importe acumulado y fecha/constancia del movimiento más reciente por fecha, creación e id. No borrar movimientos mediante SQL ni reutilizar el antiguo backend que sobrescribía el resumen. La reversión tras haber registrado movimientos exige un plan de datos; no se entrega un DROP destructivo.

Este encargo prepara los archivos y los verifica exclusivamente en PostgreSQL local aislado. La aplicación a la base compartida queda pendiente de la operación manual del tren.
