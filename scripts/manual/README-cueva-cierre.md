# SQL manual — Cueva cierre

Base back: 646fa51a9e1862efc9265c529d0d33b81f44d978.
No se aplicó a producción ni a la base compartida. El ensayo y las pruebas usan
el contenedor efímero `cueva-ci-local`, PostgreSQL 17, expuesto solo en loopback.

1. Desde la raíz del repo: `sha256sum -c scripts/manual/cueva-commercial-defaults.SHA256SUMS`.
2. Antes de una aplicación futura, comprobar backup, empresa objetivo, existencia
   de `public.companies`, tipo texto de su id y que no haya una tabla homónima
   con otro contrato. Revisar el script en una sesión de solo lectura primero:
   `SELECT to_regclass('public.invoice_commercial_defaults');`. Si existe, verificar
   company_id text PK/FK a companies, forma_pago y medio_pago con sus checks.
3. Aplicación autorizada únicamente al PostgreSQL local de este encargo:
   `docker exec -i cueva-ci-local psql -U postgres -d ta13_test -v ON_ERROR_STOP=1 < scripts/manual/cueva-commercial-defaults.sql`.
4. Verificar aislamiento por empresa y roundtrip GET/PUT con los tests de
   cueva-commercial-defaults.integration.spec.ts. El script es transaccional;
   no actualiza comprobantes, clientes, roles, series ni asientos existentes.
5. Reversa manual: exportar la configuración que se quiera conservar y ejecutar
   DROP TABLE invoice_commercial_defaults dentro de BEGIN/COMMIT, solo tras
   retirar/revertir el código consumidor. No revierte cobros ni comprobantes.

La tabla se consulta mediante SQL parametrizado desde Prisma; no se modifica
el archivo auth.prisma porque se cruza con la entrega en revisión de roles.
La aplicación deberá coordinarse con el despliegue antes de usar estos endpoints.
No se desbloquea ni se ejecuta la cola oficial de migraciones sobre la base
compartida desde este paquete. Los checksums y este procedimiento son insumos
de revisión; no constituyen una aplicación a una base compartida.
