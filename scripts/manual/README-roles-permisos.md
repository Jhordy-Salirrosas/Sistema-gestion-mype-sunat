# Roles y permisos: SQL de aplicación manual

Estos SQL acompañan a las migraciones Prisma. No se ejecutan automáticamente durante el arranque. No se aplicaron a una base compartida.

1. `role-action-permissions.sql`: crea la tabla aditiva `role_action_permissions`, su clave única y la relación con la empresa.
2. El cambio de correo global se documentará al completar P3.

Para la base de destino autorizada, revisar primero el SQL y utilizar una transacción y parada ante error, por ejemplo `psql "$MANUAL_DATABASE_URL" -v ON_ERROR_STOP=1 --single-transaction -f scripts/manual/role-action-permissions.sql`. No ejecutar además la misma migración mediante otro mecanismo. No aplicar la cola completa de migraciones para este paquete.

En las pruebas se emplea exclusivamente una base efímera local `roles_test`, con `ROLES_TEST_DATABASE_URL` explícita. Los SQL manuales y sus migraciones correspondientes deben mantenerse idénticos. La integración verifica restricciones reales y separación por empresa.
