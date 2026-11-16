# Roles y permisos: SQL de aplicación manual

Estos SQL acompañan a las migraciones Prisma. No se ejecutan automáticamente durante el arranque. No se aplicaron a una base compartida.

1. `role-action-permissions.sql`: crea la tabla aditiva `role_action_permissions`, su clave única y la relación con la empresa.
2. `users-email-global.sql`: comprueba duplicados, crea `users_email_key` y después retira `users_company_id_email_key`. No elimina, reasigna ni normaliza filas existentes. Si el preflight encuentra correos repetidos, abortar y resolver esos datos antes de aplicar. No reintentar saltando el preflight.

Para la base de destino autorizada, revisar primero el SQL y utilizar una transacción y parada ante error, por ejemplo `psql "$MANUAL_DATABASE_URL" -v ON_ERROR_STOP=1 --single-transaction -f scripts/manual/role-action-permissions.sql`. No ejecutar además la misma migración mediante otro mecanismo. No aplicar la cola completa de migraciones para este paquete.

En las pruebas se emplea exclusivamente una base efímera local `roles_test`, con `ROLES_TEST_DATABASE_URL` explícita. Los SQL manuales y sus migraciones correspondientes deben mantenerse idénticos. La integración verifica restricciones reales y separación por empresa.


Antes de P3, revisar los correos duplicados en la base de destino con `SELECT email, COUNT(*) FROM users GROUP BY email HAVING COUNT(*) > 1;`. Una revisión de los seeds/fixtures no sustituye esa comprobación sobre la base de destino. La migración repite la comprobación para no depender de una revisión manual previa.

Aplicar P1 antes de desplegar el código que consulta permisos por acción. Para P3 usar el mismo procedimiento transaccional con `scripts/manual/users-email-global.sql` antes de desplegar el cliente Prisma que declara `email @unique`. No se necesita agregar parámetros de empresa al login: el identificador es ahora único global. Los nuevos correos se guardan recortados y en minúsculas; las contraseñas no se recortan y pasan la política vigente.

`roles-permisos.sha256` contiene los checksums de ambos SQL manuales. Cada copia es idéntica a su migración Prisma correspondiente. Los casos de prueba de duplicados viven en un esquema local efímero y verifican rollback; no son datos conocidos del sistema ni del seed demo.
